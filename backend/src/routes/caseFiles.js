'use strict';

// Health-tourism Case File routes (GECE-2-BRIEFI.md Bölüm E). Mounted at
// /api/case-files, not /api/cases — that path is already taken by
// routes/cases.js (CareDental's unrelated treatment_cases/payment flow).
// See services/caseFileStore.js's header comment for the full story.
//
// GECE-3-BRIEFI.md Bölüm E.4 — role-based authorization matrix (previously
// this router only enforced tenant scoping, no role checks at all):
//   Vaka görüntüleme              → hepsi (tercüman: tıbbi dosya hariç)
//   Uygunluk kararı verme         → sadece doktor
//   awaiting_doctor → ileri geçiş → sadece doktor
//   Seyahat/program düzenleme     → koordinator, operasyon_muduru, klinik_sahibi
//   Kullanıcı/rol yönetimi        → klinik_sahibi (enforced in routes/clinics.js, not here)
// "Teklif oluşturma/gönderme" and "Fatura/ödeme" have no corresponding
// endpoint in this router yet (no quote/billing model exists in the
// backend — Bölüm H's quotes are frontend-only demo data tonight), so
// there is nothing to gate for those two rows; noted rather than skipped
// silently.

const express = require('express');
const router = express.Router();
const store = require('../services/caseFileStore');
const {
  DOKTOR, KOORDINATOR, OPERASYON_MUDURU, KLINIK_SAHIBI, TERCUMAN,
  SUPER_ADMIN, ADMIN,
} = require('../utils/roles');

// A platform user (super_admin/admin) may act cross-tenant via an explicit
// ?tenantId= — the same convention routes/cases.js already uses
// (resolveTenant). A clinic user's tenantId always comes from their own
// token, never from client input, so a clinic user can't widen their own
// scope by passing a different tenantId in the query string.
function resolveTenant(req) {
  const isPlatform = [SUPER_ADMIN, ADMIN].includes(req.user.role);
  if (isPlatform) return req.query.tenantId || req.body?.tenantId || null;
  return req.user.tenantId || null;
}

// Pure permission checks (GECE-3-BRIEFI.md Bölüm E.4) — factored out so
// they're testable without spinning up Express (see
// __tests__/caseFiles.test.js), same pattern as branchTemplates.js's
// canEditTemplate.
function canReadMedicalFile(role) {
  return role !== TERCUMAN;
}
function canDecideEligibility(role) {
  return [DOKTOR, SUPER_ADMIN, ADMIN].includes(role);
}
function canLeaveAwaitingDoctor(role) {
  return [DOKTOR, SUPER_ADMIN, ADMIN].includes(role);
}
function canEditTravel(role) {
  return [KOORDINATOR, OPERASYON_MUDURU, KLINIK_SAHIBI, SUPER_ADMIN, ADMIN].includes(role);
}

router.get('/', async (req, res, next) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const { status, branchKey, limit, offset } = req.query;
    const rows = await store.listCases(tenantId, {
      status, branchKey,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json({ cases: rows });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const item = await store.getCaseById(tenantId, req.params.id);
    // Same response whether the case doesn't exist or belongs to another
    // tenant — see getCaseById's own comment on why 403 is the wrong choice.
    if (!item) return res.status(404).json({ error: 'Case not found' });
    const events = await store.listCaseEvents(tenantId, req.params.id);
    res.json({ case: item, events });
  } catch (err) { next(err); }
});

// "Tıbbi dosya okuma" — hepsi EXCEPT tercüman (M8: interpreter's chat
// access is explicitly "tıbbi dosya kısıtlı" — medical file restricted).
router.get('/:id/medical-file', async (req, res, next) => {
  try {
    if (!canReadMedicalFile(req.user.role)) {
      return res.status(403).json({ error: 'Interpreters cannot access the medical file.' });
    }
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const media = await store.listMedia(tenantId, req.params.id);
    if (media === undefined) return res.status(404).json({ error: 'Case not found' });
    const assessments = await store.listAssessments(tenantId, req.params.id);
    res.json({ media, assessments });
  } catch (err) { next(err); }
});

// "Uygunluk kararı verme" — sadece doktor.
router.patch('/:id/eligibility', async (req, res, next) => {
  try {
    if (!canDecideEligibility(req.user.role)) {
      return res.status(403).json({ error: 'Only doktor may record an eligibility decision.' });
    }
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const { medicalEligibility, eligibilityNote } = req.body;
    if (!store.ELIGIBILITY_VALUES.includes(medicalEligibility)) {
      return res.status(400).json({ error: `Invalid medicalEligibility. Must be one of: ${store.ELIGIBILITY_VALUES.join(', ')}` });
    }
    const updated = await store.setEligibility(tenantId, req.params.id, { medicalEligibility, eligibilityNote }, req.user.sub);
    if (!updated) return res.status(404).json({ error: 'Case not found' });
    res.json({ case: updated });
  } catch (err) { next(err); }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const { status } = req.body;
    if (!store.VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${store.VALID_STATUSES.join(', ')}` });
    }
    // "awaiting_doctor → ileri durum geçişi: sadece doktor" — only checked
    // when the case is actually leaving awaiting_doctor; every other
    // transition stays open to any tenant member (brief's table doesn't
    // restrict them).
    const current = await store.getCaseById(tenantId, req.params.id);
    if (!current) return res.status(404).json({ error: 'Case not found' });
    if (current.status === 'awaiting_doctor' && status !== 'awaiting_doctor' && !canLeaveAwaitingDoctor(req.user.role)) {
      return res.status(403).json({ error: 'Only doktor may move a case out of awaiting_doctor.' });
    }
    const updated = await store.updateCaseStatus(tenantId, req.params.id, status, req.user.sub);
    if (!updated) return res.status(404).json({ error: 'Case not found' });
    res.json({ case: updated });
  } catch (err) { next(err); }
});

router.post('/:id/media', async (req, res, next) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const media = await store.addMedia(tenantId, req.params.id, req.body, req.user.sub);
    if (!media) return res.status(404).json({ error: 'Case not found' });
    res.status(201).json({ media });
  } catch (err) { next(err); }
});

router.post('/:id/assessment', async (req, res, next) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const { templateKey, answers, completed } = req.body;
    const assessment = await store.upsertAssessment(tenantId, req.params.id, templateKey, answers, completed);
    if (!assessment) return res.status(404).json({ error: 'Case not found' });
    res.status(201).json({ assessment });
  } catch (err) { next(err); }
});

// "Seyahat/program düzenleme" — koordinator, operasyon_muduru, klinik_sahibi.
router.post('/:id/timeline', async (req, res, next) => {
  try {
    if (!canEditTravel(req.user.role)) {
      return res.status(403).json({ error: 'Only koordinator/operasyon_muduru/klinik_sahibi may edit travel/schedule.' });
    }
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const entry = await store.addTimelineEntry(tenantId, req.params.id, req.body);
    if (!entry) return res.status(404).json({ error: 'Case not found' });
    res.status(201).json({ entry });
  } catch (err) { next(err); }
});

router._internal = { canReadMedicalFile, canDecideEligibility, canLeaveAwaitingDoctor, canEditTravel };
module.exports = router;

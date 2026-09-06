'use strict';

// Health-tourism Case File routes (GECE-2-BRIEFI.md Bölüm E). Mounted at
// /api/case-files, not /api/cases — that path is already taken by
// routes/cases.js (CareDental's unrelated treatment_cases/payment flow).
// See services/caseFileStore.js's header comment for the full story.

const express = require('express');
const router = express.Router();
const store = require('../services/caseFileStore');

// A platform user (super_admin/admin) may act cross-tenant via an explicit
// ?tenantId= — the same convention routes/cases.js already uses
// (resolveTenant). A clinic user's tenantId always comes from their own
// token, never from client input, so a clinic user can't widen their own
// scope by passing a different tenantId in the query string.
function resolveTenant(req) {
  const isPlatform = ['super_admin', 'admin'].includes(req.user.role);
  if (isPlatform) return req.query.tenantId || req.body?.tenantId || null;
  return req.user.tenantId || null;
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

router.patch('/:id/status', async (req, res, next) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const { status } = req.body;
    if (!store.VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${store.VALID_STATUSES.join(', ')}` });
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

router.post('/:id/timeline', async (req, res, next) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const entry = await store.addTimelineEntry(tenantId, req.params.id, req.body);
    if (!entry) return res.status(404).json({ error: 'Case not found' });
    res.status(201).json({ entry });
  } catch (err) { next(err); }
});

module.exports = router;

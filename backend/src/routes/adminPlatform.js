'use strict';

// Read-only platform endpoints for the Super Admin Console (admin.carenova.ai).
// Every route here is platform-only (super_admin / admin): these are
// cross-tenant views by definition, so a clinic user must never reach them.
//
// DEMO VS REAL (ASAMA-3A Görev 0). Every row that belongs to a tenant carries
// `isDemo`, and every count is split into demo and real. A demo clinic folded
// into a plain total ("11 klinik") is a misstatement: the panel would present
// example clinics as customers. `?includeDemo=false` shows what the platform
// looks like with only real tenants — the day-one empty state.
//
// All figures are DERIVED from rows that exist (see services/adminPlatformData.js)
// and none of these routes write. The audit log in particular is append-only
// by design ("bu kayıtlar silinemez — KVKK denetim izi"): there is deliberately
// no DELETE or PATCH route for it anywhere.

const express = require('express');
const router = express.Router();
const { pool } = require('../db/index');
const { requireRole } = require('../middleware/auth');
const ai = require('../services/ai');
const promptCompiler = require('../services/promptCompiler');
const {
  parseIncludeDemo, loadClinics, derivationBasis, AI_PRICING,
} = require('../services/adminPlatformData');

router.use(...requireRole('super_admin', 'admin'));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** { total, demo, real } for any list of rows carrying isDemo. */
function split(rows) {
  const demo = rows.filter(r => r.isDemo).length;
  return { total: rows.length, demo, real: rows.length - demo };
}

function sumBy(rows, pick) {
  return rows.reduce((s, r) => s + (Number(pick(r)) || 0), 0);
}

// ── Overview ──────────────────────────────────────────────────────────────────
router.get('/overview', async (req, res, next) => {
  try {
    const clinics = await loadClinics(pool, { includeDemo: parseIncludeDemo(req.query) });
    const real = clinics.filter(c => !c.isDemo);
    const demo = clinics.filter(c => c.isDemo);
    res.json({
      counts: {
        clinics: split(clinics),
        activeCases: { demo: sumBy(demo, c => c.activeCases), real: sumBy(real, c => c.activeCases) },
        mrrEur: { demo: sumBy(demo, c => c.mrrEur), real: sumBy(real, c => c.mrrEur) },
      },
      clinics,
      basis: derivationBasis(),
    });
  } catch (err) { next(err); }
});

// ── Clinics ───────────────────────────────────────────────────────────────────
router.get('/clinics', async (req, res, next) => {
  try {
    const clinics = await loadClinics(pool, { includeDemo: parseIncludeDemo(req.query) });
    res.json({ counts: split(clinics), clinics, basis: derivationBasis() });
  } catch (err) { next(err); }
});

router.get('/clinics/:id', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Clinic not found' });
    const [clinic] = await loadClinics(pool, { tenantId: req.params.id });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    const [{ rows: users }, { rows: audit }] = await Promise.all([
      pool.query(CLINIC_USERS_SQL, [true, clinic.id]),
      pool.query(`${AUDIT_SQL} LIMIT 50`, [true, clinic.id]),
    ]);
    res.json({ clinic, users: users.map(mapUser), auditEvents: audit.map(mapAudit), basis: derivationBasis() });
  } catch (err) { next(err); }
});

// ── Clinic users ──────────────────────────────────────────────────────────────
const CLINIC_USERS_SQL = `
  SELECT u.id, u.first_name, u.last_name, u.email, u.last_login_at, u.is_active,
         r.name AS role, t.id AS tenant_id, t.name AS tenant_name, t.is_demo
  FROM users u
  JOIN roles r   ON r.id = u.role_id
  JOIN tenants t ON t.id = u.tenant_id AND t.deleted_at IS NULL
  WHERE u.deleted_at IS NULL
    AND ($1::boolean OR t.is_demo = false)
    AND ($2::uuid IS NULL OR t.id = $2::uuid)
  ORDER BY t.is_demo, t.name, u.first_name
`;

function mapUser(r) {
  return {
    id: r.id,
    isDemo: r.is_demo === true,
    name: `${r.first_name} ${r.last_name === '-' ? '' : r.last_name}`.trim(),
    email: r.email,
    role: r.role,
    isActive: r.is_active,
    clinicId: r.tenant_id,
    clinicName: r.tenant_name,
    lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
  };
}

router.get('/clinics/:id/users', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Clinic not found' });
    const { rows } = await pool.query(CLINIC_USERS_SQL, [true, req.params.id]);
    res.json({ users: rows.map(mapUser) });
  } catch (err) { next(err); }
});

// All clinic users across tenants — the Users screen's "Klinik" tab lists them
// together. Platform users stay on /api/admin/platform-users.
router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await pool.query(CLINIC_USERS_SQL, [parseIncludeDemo(req.query), null]);
    const users = rows.map(mapUser);
    res.json({ counts: split(users), users });
  } catch (err) { next(err); }
});

// ── Compliance ────────────────────────────────────────────────────────────────
router.get('/compliance', async (req, res, next) => {
  try {
    const includeDemo = parseIncludeDemo(req.query);
    const [clinics, { rows: events }] = await Promise.all([
      loadClinics(pool, { includeDemo }),
      pool.query(
        `SELECT e.id, e.rule, e.blocked_text, e.language, e.actor, e.created_at,
                t.id AS tenant_id, t.name AS tenant_name, t.is_demo
         FROM compliance_events e
         JOIN tenants t ON t.id = e.tenant_id
         WHERE ($1::boolean OR t.is_demo = false)
         ORDER BY e.created_at DESC LIMIT 20`,
        [includeDemo],
      ),
    ]);
    res.json({
      counts: split(clinics),
      clinics: clinics.map(c => ({
        id: c.id, isDemo: c.isDemo, name: c.name,
        licenseNumber: c.licenseNumber, licenseExpiry: c.licenseExpiry,
        compliance: c.compliance,
      })),
      recentEvents: events.map(e => ({
        id: e.id, isDemo: e.is_demo === true, clinicId: e.tenant_id, clinicName: e.tenant_name,
        rule: e.rule, blockedText: e.blocked_text, language: e.language, actor: e.actor,
        at: new Date(e.created_at).toISOString(),
      })),
    });
  } catch (err) { next(err); }
});

// ── Audit log (read-only) ─────────────────────────────────────────────────────
const AUDIT_SQL = `
  SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at,
         u.first_name, u.last_name,
         t.id AS tenant_id, t.name AS tenant_name, COALESCE(t.is_demo, false) AS is_demo
  FROM audit_logs a
  LEFT JOIN users u   ON u.id = a.user_id
  LEFT JOIN tenants t ON t.id = a.tenant_id
  WHERE ($1::boolean OR COALESCE(t.is_demo, false) = false)
    AND ($2::uuid IS NULL OR a.tenant_id = $2::uuid)
  ORDER BY a.created_at DESC
`;

function mapAudit(r) {
  return {
    id: r.id,
    isDemo: r.is_demo === true,
    // No user (a system action, or a seeded demo event) -> null, never a guessed name.
    actor: r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : null,
    action: r.action,
    entityType: r.entity_type,
    clinicId: r.tenant_id,
    clinicName: r.tenant_name,
    at: new Date(r.created_at).toISOString(),
  };
}

function csvCell(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

router.get('/audit', async (req, res, next) => {
  try {
    const includeDemo = parseIncludeDemo(req.query);
    const tenantId = UUID_RE.test(req.query.tenantId || '') ? req.query.tenantId : null;

    if (req.query.format === 'csv') {
      const { rows } = await pool.query(AUDIT_SQL, [includeDemo, tenantId]);
      const lines = rows.map(mapAudit).map(e => [
        // A demo row identifies itself in the exported file too — the file
        // leaves the screen (and its banner) behind.
        e.isDemo ? 'DEMO' : '', e.actor, e.action, e.clinicName, e.at,
      ].map(csvCell).join(','));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="carenova-audit-log.csv"');
      return res.send(['demo,actor,action,clinic,at', ...lines].join('\n'));
    }

    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const [{ rows }, { rows: [{ n }] }] = await Promise.all([
      pool.query(`${AUDIT_SQL} LIMIT $3 OFFSET $4`, [includeDemo, tenantId, limit, (page - 1) * limit]),
      pool.query(
        `SELECT count(*)::int AS n FROM audit_logs a LEFT JOIN tenants t ON t.id = a.tenant_id
         WHERE ($1::boolean OR COALESCE(t.is_demo, false) = false) AND ($2::uuid IS NULL OR a.tenant_id = $2::uuid)`,
        [includeDemo, tenantId],
      ),
    ]);
    res.json({ total: n, page, limit, events: rows.map(mapAudit) });
  } catch (err) { next(err); }
});

// ── AI usage & quota ──────────────────────────────────────────────────────────
router.get('/ai-usage', async (req, res, next) => {
  try {
    const clinics = await loadClinics(pool, { includeDemo: parseIncludeDemo(req.query) });
    const cost = rows => Math.round(sumBy(rows, c => c.aiUsage.costUsdThisMonth) * 100) / 100;
    res.json({
      counts: split(clinics),
      clinics: clinics.map(c => ({ id: c.id, isDemo: c.isDemo, name: c.name, aiUsage: c.aiUsage })),
      totals: {
        costUsdThisMonth: { demo: cost(clinics.filter(c => c.isDemo)), real: cost(clinics.filter(c => !c.isDemo)) },
      },
      // Shown on screen: the cost is computed from these, not typed in.
      pricing: AI_PRICING,
    });
  } catch (err) { next(err); }
});

// ── Platform health ───────────────────────────────────────────────────────────
// Derived from messages. What CAN'T be derived is returned as null and shown as
// "henüz ölçülmüyor" — a made-up rate is worse than an empty box.
router.get('/health', async (req, res, next) => {
  try {
    const includeDemo = parseIncludeDemo(req.query);
    const [{ rows: [w] }, { rows: [r] }, { rows: errors }] = await Promise.all([
      pool.query(
        `SELECT count(*) FILTER (WHERE m.direction = 'outbound')::int AS outbound,
                count(*) FILTER (WHERE m.direction = 'outbound' AND m.status = 'failed')::int AS outbound_failed,
                count(*) FILTER (WHERE m.ai_generated)::int AS ai_total,
                count(*) FILTER (WHERE m.ai_generated AND m.status = 'failed')::int AS ai_failed
         FROM messages m JOIN tenants t ON t.id = m.tenant_id
         WHERE m.created_at >= now() - interval '24 hours' AND ($1::boolean OR t.is_demo = false)`,
        [includeDemo],
      ),
      pool.query(
        `SELECT avg(EXTRACT(EPOCH FROM (o.first_out - i.first_in)))::float AS avg_first_reply_seconds,
                count(*)::int AS samples
         FROM (
           SELECT m.lead_id, min(m.created_at) AS first_in
           FROM messages m JOIN tenants t ON t.id = m.tenant_id
           WHERE m.direction = 'inbound' AND m.created_at >= now() - interval '7 days'
             AND ($1::boolean OR t.is_demo = false)
           GROUP BY m.lead_id
         ) i
         CROSS JOIN LATERAL (
           SELECT min(o.created_at) AS first_out FROM messages o
           WHERE o.lead_id = i.lead_id AND o.direction = 'outbound' AND o.ai_generated AND o.created_at >= i.first_in
         ) o
         WHERE o.first_out IS NOT NULL`,
        [includeDemo],
      ),
      pool.query(
        `SELECT m.id, m.error_code, m.error_message, m.created_at, t.id AS tenant_id, t.name AS tenant_name, t.is_demo
         FROM messages m JOIN tenants t ON t.id = m.tenant_id
         WHERE m.status = 'failed' AND ($1::boolean OR t.is_demo = false)
         ORDER BY m.created_at DESC LIMIT 5`,
        [includeDemo],
      ),
    ]);

    const pct = (part, whole) => (whole > 0 ? Math.round((1 - part / whole) * 1000) / 10 : null);
    res.json({
      // Delivery success of outbound messages (Meta's status callbacks). This is
      // NOT a true inbound-webhook success rate: a webhook request that failed
      // before a messages row was written leaves no trace to count.
      deliverySuccessRate: pct(w.outbound_failed, w.outbound),
      aiErrorRate: w.ai_total > 0 ? Math.round((w.ai_failed / w.ai_total) * 1000) / 10 : null,
      avgFirstReplySeconds: r.samples > 0 ? Math.round(r.avg_first_reply_seconds * 10) / 10 : null,
      sampleSizes: { outbound24h: w.outbound, aiMessages24h: w.ai_total, firstReplyLeads7d: r.samples },
      recentErrors: errors.map(e => ({
        id: e.id, isDemo: e.is_demo === true, clinicId: e.tenant_id, clinicName: e.tenant_name,
        code: e.error_code, message: e.error_message, at: new Date(e.created_at).toISOString(),
      })),
    });
  } catch (err) { next(err); }
});

// ── WhatsApp lines ────────────────────────────────────────────────────────────
router.get('/whatsapp', async (req, res, next) => {
  try {
    const clinics = await loadClinics(pool, { includeDemo: parseIncludeDemo(req.query) });
    res.json({
      counts: split(clinics),
      // access_token / webhook_verify_token are never selected, let alone returned.
      clinics: clinics.map(c => ({ id: c.id, isDemo: c.isDemo, name: c.name, whatsapp: c.whatsapp })),
    });
  } catch (err) { next(err); }
});

// ── Billing ───────────────────────────────────────────────────────────────────
// From subscriptions + the package price list. NOT the invoices table: that is
// clinic -> patient invoicing (patient_name, treatment_description), unrelated
// to what a clinic pays CareNova.
router.get('/billing', async (req, res, next) => {
  try {
    const clinics = await loadClinics(pool, { includeDemo: parseIncludeDemo(req.query) });
    const mrr = rows => sumBy(rows, c => c.mrrEur);
    res.json({
      counts: split(clinics),
      clinics: clinics.map(c => ({ id: c.id, isDemo: c.isDemo, name: c.name, plan: c.plan, mrrEur: c.mrrEur, billing: c.billing })),
      totals: {
        mrrEur: { demo: mrr(clinics.filter(c => c.isDemo)), real: mrr(clinics.filter(c => !c.isDemo)) },
      },
      basis: derivationBasis(),
    });
  } catch (err) { next(err); }
});

// ── Onboarding ────────────────────────────────────────────────────────────────
router.get('/onboarding', async (req, res, next) => {
  try {
    const clinics = await loadClinics(pool, { includeDemo: parseIncludeDemo(req.query) });
    res.json({
      counts: split(clinics),
      clinics: clinics.map(c => ({ id: c.id, isDemo: c.isDemo, name: c.name, status: c.status, onboarding: c.onboarding })),
      basis: derivationBasis(),
    });
  } catch (err) { next(err); }
});

// GECE-4-BRIEFI.md Bölüm A — "AI neden böyle cevap verdi" sorusunun tek
// cevap yeri. super_admin ONLY (tighter than this router's default
// super_admin+admin gate — this exposes the compiled system prompt, the
// clinic's own knowledge base content, and the branch's pricing-authority
// rule verbatim, all more sensitive than the read-only aggregates above).
// Re-runs the EXACT same compiler generateFollowUp uses in production
// (promptCompiler.compileSystemPrompt via ai.js's loaders) — this is a
// debug tool, not a re-implementation, so it can never drift from what a
// real message actually saw.
router.post('/prompt-preview', ...requireRole('super_admin'), async (req, res, next) => {
  try {
    const { tenantId, branchKey, caseId, patientName } = req.body || {};
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required' });

    const [knowledgeContext, aiSettings, branchTemplate] = await Promise.all([
      ai.loadKnowledge(tenantId),
      ai.loadAiSettings(tenantId),
      branchKey ? ai.loadBranchTemplate(branchKey) : Promise.resolve(null),
    ]);

    let caseRow = null;
    if (caseId) {
      const { rows } = await pool.query(
        `SELECT * FROM cases WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [caseId, tenantId],
      );
      caseRow = rows[0] || null;
    }

    const mediaReadiness = caseRow ? await ai.loadCaseMediaReadiness(caseRow.id) : { hasQualifyingPhoto: false, hasImaging: false };

    const prompt = promptCompiler.compileSystemPrompt({
      tone: aiSettings?.tone || 'professional',
      knowledgeContext,
      patientName: patientName || '',
      branchTemplate,
      patientCountry: caseRow?.patient_country || null,
      patientLanguage: caseRow?.patient_language || null,
      patientTimezone: caseRow?.patient_timezone || null,
      clinicTimezone: aiSettings?.tenant_timezone || aiSettings?.timezone || 'Europe/Istanbul',
    });

    res.json({
      prompt,
      resolvedInputs: {
        branchKey: branchTemplate?.key || null,
        aiPricingAuthority: branchTemplate?.aiPricingAuthority || null,
        caseFound: Boolean(caseRow),
        mediaReadiness,
        knowledgeContextLength: knowledgeContext.length,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;

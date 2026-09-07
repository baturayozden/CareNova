'use strict';

// Read-only platform-overview endpoints for the Super Admin Console
// (GECE-2-BRIEFI.md Bölüm C), scaffolded in Bölüm E. The admin console
// itself runs entirely on frontend/src/data/adminDemoData.ts tonight (no
// wiring yet — that's a separate future task); these endpoints exist so
// that wiring has a real backend contract to target instead of starting
// from zero. Every route here is platform-only: tenant scoping doesn't
// apply because these are cross-tenant aggregates by definition.

const express = require('express');
const router = express.Router();
const { pool } = require('../db/index');
const { requireRole } = require('../middleware/auth');
const ai = require('../services/ai');
const promptCompiler = require('../services/promptCompiler');

router.use(...requireRole('super_admin', 'admin'));

router.get('/overview', async (req, res, next) => {
  try {
    const [{ rows: tenantCounts }, { rows: caseCounts }] = await Promise.all([
      pool.query(`SELECT count(*)::int AS total FROM tenants`),
      pool.query(`SELECT status, count(*)::int AS n FROM cases WHERE deleted_at IS NULL GROUP BY status`),
    ]);
    res.json({
      totalClinics: tenantCounts[0]?.total ?? 0,
      casesByStatus: caseCounts,
    });
  } catch (err) { next(err); }
});

router.get('/clinics', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.created_at,
              (SELECT count(*)::int FROM cases c WHERE c.tenant_id = t.id AND c.deleted_at IS NULL) AS active_cases
       FROM tenants t ORDER BY t.created_at DESC`,
    );
    res.json({ clinics: rows });
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

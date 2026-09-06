'use strict';

// Branch template routes (GECE-2-BRIEFI.md Bölüm E, schema in
// migrations/058_branch_templates.sql). Mounted at /api/branch-templates.
//
// 🔴 Güvenlik kuralı (CARENOVA-STRATEJI.md Bölüm 7/M2, mirrors Bölüm C.6's
// admin-console rule): a SYSTEM template (is_system = true, tenant_id NULL)
// may only be edited by super_admin. A clinic may only edit its OWN custom
// template (is_system = false, tenant_id = their tenant). ai_pricing_authority
// is a closed enum at the DB level (CHECK constraint) — this route does not
// re-validate it beyond that, matching the frontend's closed <select>.

const express = require('express');
const router = express.Router();
const { pool } = require('../db/index');

const AUTHORITY_VALUES = ['full', 'range_from_photo', 'range_after_imaging', 'qualification_only', 'logistics_only'];

function isPlatformAdmin(req) {
  return ['super_admin', 'admin'].includes(req.user.role);
}

// A template is editable by this request if: the caller is a platform admin
// (can edit anything, including system templates), OR the template is a
// non-system template owned by the caller's own tenant. Exported standalone
// so it's testable without a DB (see __tests__/branchTemplates.test.js).
function canEditTemplate(user, template) {
  if (['super_admin', 'admin'].includes(user.role)) return true;
  if (template.is_system) return false;
  return template.tenant_id === user.tenantId;
}

router.get('/', async (req, res, next) => {
  try {
    // Every clinic sees the system templates plus its own custom ones only —
    // never another tenant's custom template.
    const { rows } = await pool.query(
      `SELECT * FROM branch_templates WHERE is_system = true OR tenant_id = $1 ORDER BY key`,
      [req.user.tenantId || null],
    );
    res.json({ templates: rows });
  } catch (err) { next(err); }
});

router.get('/:key', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM branch_templates WHERE key = $1`, [req.params.key]);
    const template = rows[0];
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (!template.is_system && template.tenant_id !== req.user.tenantId && !isPlatformAdmin(req)) {
      return res.status(404).json({ error: 'Template not found' }); // don't confirm another tenant's template exists
    }
    res.json({ template });
  } catch (err) { next(err); }
});

router.patch('/:key', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM branch_templates WHERE key = $1`, [req.params.key]);
    const template = rows[0];
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (!canEditTemplate(req.user, template)) {
      return res.status(403).json({ error: 'Only super_admin may edit a system branch template' });
    }
    const { aiPricingAuthority, doctorApprovalScope, typicalStayDays, typicalCycleDays } = req.body;
    if (aiPricingAuthority !== undefined && !AUTHORITY_VALUES.includes(aiPricingAuthority)) {
      return res.status(400).json({ error: `ai_pricing_authority must be one of: ${AUTHORITY_VALUES.join(', ')}` });
    }
    const { rows: updatedRows } = await pool.query(
      `UPDATE branch_templates SET
         ai_pricing_authority = COALESCE($1, ai_pricing_authority),
         doctor_approval_scope = COALESCE($2, doctor_approval_scope),
         typical_stay_days = COALESCE($3, typical_stay_days),
         typical_cycle_days = COALESCE($4, typical_cycle_days),
         updated_at = now()
       WHERE key = $5
       RETURNING *`,
      [aiPricingAuthority ?? null, doctorApprovalScope ? JSON.stringify(doctorApprovalScope) : null,
        typicalStayDays ?? null, typicalCycleDays ?? null, req.params.key],
    );
    res.json({ template: updatedRows[0] });
  } catch (err) { next(err); }
});

router._internal = { canEditTemplate };
module.exports = router;

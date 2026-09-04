const express = require('express');
const { pool } = require('../db');

const router = express.Router({ mergeParams: true });

function resolveTenant(req) {
  return req.user?.tenantId || req.query.tenantId || null;
}

// GET /api/patients/:leadId/checklist-manual
router.get('/', async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const { leadId } = req.params;

    const { rows } = await pool.query(
      `SELECT pcm.*,
              CASE WHEN u.id IS NOT NULL
                   THEN trim(u.first_name || ' ' || u.last_name)
                   ELSE NULL
              END AS checked_by_name
         FROM patient_checklist_manual pcm
         LEFT JOIN users u ON u.id = pcm.checked_by
        WHERE pcm.lead_id = $1 AND pcm.tenant_id = $2`,
      [leadId, tenantId],
    );

    res.json({ items: rows });
  } catch (err) {
    // Migration 049 not yet run — return empty rather than crashing the page
    if (err.code === '42P01') {
      return res.json({ items: [] });
    }
    console.error('[PatientChecklist] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch checklist.' });
  }
});

// PATCH /api/patients/:leadId/checklist-manual
// body: { item_key: 'physical_id_check', checked: true|false }
router.patch('/', async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const { leadId } = req.params;
    const { item_key, checked } = req.body;

    if (!item_key?.trim()) return res.status(400).json({ error: 'item_key is required.' });
    if (typeof checked !== 'boolean') return res.status(400).json({ error: 'checked must be a boolean.' });

    // Verify patient belongs to this tenant
    const { rows: leadRows } = await pool.query(
      `SELECT id FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [leadId, tenantId],
    );
    if (!leadRows.length) return res.status(404).json({ error: 'Patient not found.' });

    const checkedBy = checked ? req.user.sub : null;
    const checkedAt = checked ? 'NOW()' : 'NULL';

    const { rows } = await pool.query(
      `INSERT INTO patient_checklist_manual (tenant_id, lead_id, item_key, checked, checked_by, checked_at)
       VALUES ($1, $2, $3, $4, $5, ${checkedAt})
       ON CONFLICT (lead_id, item_key) DO UPDATE
         SET checked    = EXCLUDED.checked,
             checked_by = EXCLUDED.checked_by,
             checked_at = ${checkedAt}
       RETURNING *`,
      [tenantId, leadId, item_key.trim(), checked, checkedBy],
    );

    const item = rows[0];

    // Fetch name for audit display
    let checked_by_name = null;
    if (item.checked_by) {
      const { rows: uRows } = await pool.query(
        `SELECT trim(first_name || ' ' || last_name) AS name FROM users WHERE id = $1`,
        [item.checked_by],
      );
      checked_by_name = uRows[0]?.name ?? null;
    }

    res.json({ item: { ...item, checked_by_name } });
  } catch (err) {
    console.error('[PatientChecklist] PATCH error:', err.message);
    res.status(500).json({ error: 'Failed to update checklist.' });
  }
});

module.exports = router;

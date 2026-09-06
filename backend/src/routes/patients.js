const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { requireRole } = require('../middleware/auth');

const ORDER_MAP = {
  created_desc: 'l.created_at DESC',
  created_asc:  'l.created_at ASC',
  name_asc:     'l.first_name ASC, l.last_name ASC',
  assigned_asc: 'u.first_name ASC NULLS LAST, u.last_name ASC NULLS LAST',
};

// GET /api/patients — leads with per-lead aggregates, tenant-scoped.
// No requireRole: mirrors GET /api/leads (any authenticated user sees their tenant's data).
router.get('/', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    const q          = req.query.q          ? `%${req.query.q}%` : null;
    const sort       = ORDER_MAP[req.query.sort] ? req.query.sort : 'created_desc';
    const assignedTo = req.query.assignedTo?.trim() || null;
    const dateFrom   = req.query.dateFrom?.trim()   || null;
    const dateTo     = req.query.dateTo?.trim()     || null;
    const orderBy    = ORDER_MAP[sort];

    // Build shared WHERE extras (used by both COUNT and main SELECT)
    const baseParams   = [tenantId];
    const whereClauses = [];

    if (q) {
      baseParams.push(q);
      const n = baseParams.length;
      whereClauses.push(
        `(l.first_name ILIKE $${n} OR l.last_name ILIKE $${n} OR l.phone ILIKE $${n} OR l.email ILIKE $${n})`
      );
    }
    if (assignedTo) {
      baseParams.push(assignedTo);
      whereClauses.push(`l.assigned_to = $${baseParams.length}`);
    }
    if (dateFrom) {
      baseParams.push(dateFrom);
      whereClauses.push(`l.created_at >= $${baseParams.length}::date`);
    }
    if (dateTo) {
      baseParams.push(dateTo);
      whereClauses.push(`l.created_at < ($${baseParams.length}::date + interval '1 day')`);
    }
    const whereExtra = whereClauses.length ? 'AND ' + whereClauses.join(' AND ') : '';

    // Count
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM leads l
       WHERE l.tenant_id = $1 AND l.deleted_at IS NULL ${whereExtra}`,
      baseParams,
    );
    const total = parseInt(countRes.rows[0].count, 10);

    // Main query: correlated subqueries for aggregates — no GROUP BY, no cross-join multiplication.
    const selectParams = [...baseParams, limit, offset];
    const lim = selectParams.length - 1;
    const off = selectParams.length;

    const { rows } = await pool.query(`
      SELECT
        l.id,
        l.first_name,
        l.last_name,
        l.phone,
        l.email,
        l.status,
        l.language,
        l.treatment_interest,
        l.assigned_to,
        l.created_at,
        u.first_name AS staff_first,
        u.last_name  AS staff_last,
        (
          SELECT COUNT(*)
          FROM treatment_deals
          WHERE lead_id = l.id AND tenant_id = l.tenant_id AND deleted_at IS NULL
        ) AS deal_count,
        (
          SELECT COALESCE(SUM(agreed_amount), 0)
          FROM treatment_deals
          WHERE lead_id = l.id AND tenant_id = l.tenant_id AND deleted_at IS NULL
        ) AS total_agreed,
        EXISTS(
          SELECT 1 FROM treatment_cases
          WHERE lead_id = l.id AND tenant_id = l.tenant_id AND deleted_at IS NULL
            AND status IN ('signed','payment_sent','paid')
        ) AS contract_signed,
        (
          EXISTS(
            SELECT 1 FROM treatment_deals
            WHERE lead_id = l.id AND tenant_id = l.tenant_id AND deleted_at IS NULL AND deposit_amount > 0
          ) OR EXISTS(
            SELECT 1 FROM treatment_cases
            WHERE lead_id = l.id AND tenant_id = l.tenant_id AND deleted_at IS NULL AND paid_at IS NOT NULL
          )
        ) AS payment_arranged,
        EXISTS(
          SELECT 1 FROM treatment_deals
          WHERE lead_id = l.id AND tenant_id = l.tenant_id AND deleted_at IS NULL
            AND expected_start_date IS NOT NULL
        ) AS treatment_date_set
      FROM leads l
      LEFT JOIN users u ON u.id = l.assigned_to
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL ${whereExtra}
      ORDER BY ${orderBy}
      LIMIT $${lim} OFFSET $${off}
    `, selectParams);

    const patients = rows.map(r => ({
      id:               r.id,
      firstName:        r.first_name,
      lastName:         r.last_name,
      phone:            r.phone,
      email:            r.email,
      status:           r.status,
      language:         r.language,
      treatmentInterest: r.treatment_interest,
      assignedTo:       r.assigned_to,
      staffName:        r.staff_first ? `${r.staff_first} ${r.staff_last}`.trim() : null,
      dealCount:        parseInt(r.deal_count, 10),
      totalAgreed:      parseFloat(r.total_agreed),
      contractSigned:   r.contract_signed   ?? false,
      paymentArranged:  r.payment_arranged  ?? false,
      treatmentDateSet: r.treatment_date_set ?? false,
      createdAt:        r.created_at,
    }));

    res.json({ patients, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[Patients] GET / error:', err.message);
    res.status(500).json({ error: 'Failed to fetch patients.' });
  }
});

// GET /api/patients/:leadId/delete-preview — counts of linked active records (admin only)
router.get('/:leadId/delete-preview', ...requireRole('klinik_sahibi', 'super_admin'), async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });
    const { leadId } = req.params;

    const exist = await pool.query(
      `SELECT id FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [leadId, tenantId],
    );
    if (!exist.rows.length) return res.status(404).json({ error: 'Patient not found.' });

    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM treatment_deals   WHERE deleted_at IS NULL AND tenant_id = $2
            AND (lead_id = $1 OR case_id IN (SELECT id FROM treatment_cases WHERE lead_id = $1 AND tenant_id = $2))) AS deals,
         (SELECT COUNT(*) FROM treatment_cases   WHERE lead_id = $1 AND tenant_id = $2 AND deleted_at IS NULL) AS cases,
         (SELECT COUNT(*) FROM patient_documents WHERE lead_id = $1 AND tenant_id = $2 AND deleted_at IS NULL) AS documents,
         (SELECT COUNT(*) FROM invoices          WHERE deleted_at IS NULL AND tenant_id = $2
            AND (lead_id = $1 OR case_id IN (SELECT id FROM treatment_cases WHERE lead_id = $1 AND tenant_id = $2))) AS invoices`,
      [leadId, tenantId],
    );
    const r = rows[0];
    res.json({
      deals:     parseInt(r.deals,     10),
      cases:     parseInt(r.cases,     10),
      documents: parseInt(r.documents, 10),
      invoices:  parseInt(r.invoices,  10),
    });
  } catch (err) {
    console.error('[Patients] GET /:leadId/delete-preview error:', err.message);
    res.status(500).json({ error: 'Failed to fetch patient summary.' });
  }
});

// DELETE /api/patients/:leadId — soft-delete patient and all linked records (admin only)
router.delete('/:leadId', ...requireRole('klinik_sahibi', 'super_admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const tenantId = req.query.tenantId || req.user.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });
    const { leadId } = req.params;

    await client.query('BEGIN');

    const exist = await client.query(
      `SELECT id FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [leadId, tenantId],
    );
    if (!exist.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const now = new Date();

    // Soft-delete cases first so the subquery in deals/invoices sees all of them.
    const caseRes = await client.query(
      `UPDATE treatment_cases SET deleted_at = $1 WHERE lead_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [now, leadId, tenantId],
    );

    // Deals and invoices may be linked by lead_id OR by case_id (walk-in / case-only flows).
    const [invRes, docRes, dealRes] = await Promise.all([
      client.query(
        `UPDATE invoices SET deleted_at = $1
         WHERE deleted_at IS NULL AND tenant_id = $3
           AND (lead_id = $2 OR case_id IN (
                 SELECT id FROM treatment_cases WHERE lead_id = $2 AND tenant_id = $3))`,
        [now, leadId, tenantId],
      ),
      client.query(
        `UPDATE patient_documents SET deleted_at = $1 WHERE lead_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
        [now, leadId, tenantId],
      ),
      client.query(
        `UPDATE treatment_deals SET deleted_at = $1
         WHERE deleted_at IS NULL AND tenant_id = $3
           AND (lead_id = $2 OR case_id IN (
                 SELECT id FROM treatment_cases WHERE lead_id = $2 AND tenant_id = $3))`,
        [now, leadId, tenantId],
      ),
    ]);

    await client.query(
      `UPDATE leads SET deleted_at = $1, deleted_by = $4 WHERE id = $2 AND tenant_id = $3`,
      [now, leadId, tenantId, req.user.sub],
    );

    await client.query('COMMIT');

    res.json({
      archived: {
        invoices:  invRes.rowCount,
        documents: docRes.rowCount,
        deals:     dealRes.rowCount,
        cases:     caseRes.rowCount,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Patients] DELETE /:leadId error:', err.message);
    res.status(500).json({ error: 'Failed to archive patient.' });
  } finally {
    client.release();
  }
});

// GET /api/patients/archived — list soft-deleted patients with linked record counts
router.get('/archived', ...requireRole('klinik_sahibi', 'super_admin'), async (req, res) => {
  try {
    const tenantId = req.query.tenantId || req.user.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const { search = '', limit = '50', offset = '0' } = req.query;
    const params = [tenantId];
    let whereSearch = '';
    if (search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      whereSearch = `AND (LOWER(l.first_name || ' ' || l.last_name) LIKE $${params.length} OR l.phone LIKE $${params.length})`;
    }

    const { rows } = await pool.query(
      `SELECT
         l.id, l.first_name, l.last_name, l.phone, l.deleted_at,
         u.first_name AS deleted_by_first, u.last_name AS deleted_by_last,
         (SELECT COUNT(*) FROM treatment_deals
           WHERE deleted_at IS NOT NULL AND tenant_id = l.tenant_id
             AND (lead_id = l.id OR case_id IN (
               SELECT id FROM treatment_cases WHERE lead_id = l.id AND tenant_id = l.tenant_id))) AS deals,
         (SELECT COUNT(*) FROM treatment_cases
           WHERE lead_id = l.id AND tenant_id = l.tenant_id AND deleted_at IS NOT NULL) AS cases,
         (SELECT COUNT(*) FROM patient_documents
           WHERE lead_id = l.id AND tenant_id = l.tenant_id AND deleted_at IS NOT NULL) AS documents,
         (SELECT COUNT(*) FROM invoices
           WHERE deleted_at IS NOT NULL AND tenant_id = l.tenant_id
             AND (lead_id = l.id OR case_id IN (
               SELECT id FROM treatment_cases WHERE lead_id = l.id AND tenant_id = l.tenant_id))) AS invoices
       FROM leads l
       LEFT JOIN users u ON u.id = l.deleted_by
       WHERE l.tenant_id = $1 AND l.deleted_at IS NOT NULL ${whereSearch}
       ORDER BY l.deleted_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), Number(offset)],
    );

    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*) AS total FROM leads l
       WHERE l.tenant_id = $1 AND l.deleted_at IS NOT NULL ${whereSearch}`,
      params,
    );

    res.json({ patients: rows, total: Number(total) });
  } catch (err) {
    console.error('[Patients] GET /archived error:', err.message);
    res.status(500).json({ error: 'Failed to load archived patients.' });
  }
});

// POST /api/patients/:leadId/restore — restore a soft-deleted patient
// Only restores records archived at the SAME timestamp as the lead (same cascade batch).
router.post('/:leadId/restore', ...requireRole('klinik_sahibi', 'super_admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const tenantId = req.query.tenantId || req.user.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });
    const { leadId } = req.params;

    await client.query('BEGIN');

    const { rows: [lead] } = await client.query(
      `SELECT id, deleted_at FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NOT NULL FOR UPDATE`,
      [leadId, tenantId],
    );
    if (!lead) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Archived patient not found.' });
    }

    const ts = lead.deleted_at;

    // Restore cases first (same timestamp guard) so the subquery below works.
    const caseRes = await client.query(
      `UPDATE treatment_cases SET deleted_at = NULL
       WHERE lead_id = $1 AND tenant_id = $2 AND deleted_at = $3`,
      [leadId, tenantId, ts],
    );

    const [invRes, docRes, dealRes] = await Promise.all([
      client.query(
        `UPDATE invoices SET deleted_at = NULL
         WHERE tenant_id = $2 AND deleted_at = $3
           AND (lead_id = $1 OR case_id IN (
                 SELECT id FROM treatment_cases WHERE lead_id = $1 AND tenant_id = $2))`,
        [leadId, tenantId, ts],
      ),
      client.query(
        `UPDATE patient_documents SET deleted_at = NULL
         WHERE lead_id = $1 AND tenant_id = $2 AND deleted_at = $3`,
        [leadId, tenantId, ts],
      ),
      client.query(
        `UPDATE treatment_deals SET deleted_at = NULL
         WHERE tenant_id = $2 AND deleted_at = $3
           AND (lead_id = $1 OR case_id IN (
                 SELECT id FROM treatment_cases WHERE lead_id = $1 AND tenant_id = $2))`,
        [leadId, tenantId, ts],
      ),
    ]);

    await client.query(
      `UPDATE leads SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND tenant_id = $2`,
      [leadId, tenantId],
    );

    await client.query('COMMIT');

    res.json({
      restored: {
        deals:     dealRes.rowCount,
        cases:     caseRes.rowCount,
        documents: docRes.rowCount,
        invoices:  invRes.rowCount,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Patients] POST /:leadId/restore error:', err.message);
    res.status(500).json({ error: 'Failed to restore patient.' });
  } finally {
    client.release();
  }
});

module.exports = router;

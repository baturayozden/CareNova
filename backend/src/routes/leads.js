const express                    = require('express');
const router                     = express.Router();
const leadStore                  = require('../services/leadStore');
const whatsapp                   = require('../services/whatsapp');
const ai                         = require('../services/ai');
const { pool }                   = require('../db/index');
const { scoreLead }              = require('../services/leadScoring');
const { requireRole }            = require('../middleware/auth');
const { parse: csvParse }        = require('csv-parse/sync');

// Roles that can be the target of a lead assignment (used in validation + assign endpoint)
const ASSIGNABLE_ROLES = ['hasta_danismani'];

// GET /api/leads/stats — aggregate stats for the dashboard cards
router.get('/stats', async (req, res) => {
  try {
    const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const isConsultant    = req.user.role === 'hasta_danismani';

    // Tenant isolation: platform admins (tenantId = null) see all tenants;
    // every other role is scoped to their own tenant.
    const params = [];
    const tenantClause = isPlatformAdmin
      ? ''
      : (params.push(req.user.tenantId), `AND tenant_id = $${params.length}`);
    const salesClause = isConsultant
      ? (params.push(req.user.sub), `AND assigned_to = $${params.length}`)
      : '';

    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                             AS total,
        COUNT(*) FILTER (WHERE status = 'booked')           AS booked,
        COUNT(*) FILTER (WHERE status = 'attended')         AS attended,
        COALESCE(SUM(ai_follow_up_count), 0)                AS ai_messages,
        ROUND(
          COUNT(*) FILTER (WHERE status IN ('booked','attended'))::numeric
          / NULLIF(COUNT(*), 0) * 100
        , 1)                                                AS recovery_rate
      FROM leads
      WHERE deleted_at IS NULL ${tenantClause} ${salesClause}
    `, params);

    const r = rows[0];

    // Clinic-wide performance metrics are not exposed to hasta_danismani
    // (patient consultants) — matches CARENOVA-STRATEJI.md M8's 'kendi
    // vakaları' (own cases only) scoping.
    // Operational counts (total leads, AI messages) are always included.
    const response = {
      total:      parseInt(r.total, 10),
      aiMessages: parseInt(r.ai_messages, 10),
    };
    if (!isConsultant) {
      response.booked       = parseInt(r.booked, 10);
      response.recoveryRate = parseFloat(r.recovery_rate) || 0;
    }

    res.json(response);
  } catch (err) {
    console.error('[Leads] stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/leads — manually create a lead (director / clinic_admin / TC / receptionist)
router.post('/', ...requireRole('operasyon_muduru', 'klinik_sahibi', 'hasta_danismani', 'koordinator'), async (req, res) => {
  try {
    const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user.role);
    // Platform admin must specify which clinic; everyone else is locked to their own tenant.
    const tenantId = isPlatformAdmin ? req.body.tenantId : req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required.' });
    }

    const { firstName, lastName, phone, email, treatmentInterest, notes,
            language = 'en', aiFollowUpEnabled = false, gdprConsentGiven = false } = req.body;

    if (!firstName || !phone) {
      return res.status(400).json({ error: 'First name and phone are required.' });
    }
    // If AI follow-up is enabled, GDPR consent is mandatory.
    if (aiFollowUpEnabled && !gdprConsentGiven) {
      return res.status(400).json({ error: 'GDPR consent is required to enable AI follow-up.' });
    }

    const lead = await leadStore.createLead({
      tenantId, firstName, lastName, phone, email, treatmentInterest, notes,
      language, source: 'manual', aiFollowUpEnabled, gdprConsentGiven,
      gdprConsentMethod: gdprConsentGiven ? 'verbal' : null,
      assignedTo: req.user.sub,
    });

    res.status(201).json({ lead });
  } catch (err) {
    if (err.code === 'DUPLICATE_PHONE') {
      return res.status(409).json({ error: err.message });
    }
    console.error('[Leads] create error:', err.message);
    res.status(500).json({ error: 'Failed to create lead.' });
  }
});

// POST /api/leads/bulk — bulk lead import from CSV
// MUST be declared before /:id routes so Express doesn't treat 'bulk' as a dynamic ID.
router.post('/bulk', ...requireRole('operasyon_muduru', 'klinik_sahibi', 'hasta_danismani', 'koordinator'), async (req, res) => {
  try {
    const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const tenantId = isPlatformAdmin ? req.body.tenantId : req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required.' });
    }

    const { csv, columnMapping } = req.body;
    if (!csv || !csv.trim()) {
      return res.status(400).json({ error: 'csv is required.' });
    }
    if (!columnMapping || !columnMapping.firstName || !columnMapping.phone) {
      return res.status(400).json({ error: 'Name and phone columns must be mapped.' });
    }

    // Parse CSV on the backend — same approach as commissions.js
    let parsed;
    try {
      parsed = csvParse(csv, { columns: true, skip_empty_lines: true, trim: true });
    } catch (parseErr) {
      return res.status(400).json({ error: 'Could not parse CSV. Check the file format.' });
    }

    if (parsed.length === 0) {
      return res.status(400).json({ error: 'The file contains no data rows after the header.' });
    }
    if (parsed.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 rows per upload. Please split your file.' });
    }

    // Map each CSV row to canonical lead fields using the column mapping
    const rows = parsed.map(row => ({
      firstName:         row[columnMapping.firstName]         || '',
      lastName:          columnMapping.lastName          ? (row[columnMapping.lastName]          || '') : '',
      phone:             row[columnMapping.phone]             || '',
      email:             columnMapping.email             ? (row[columnMapping.email]             || null) : null,
      treatmentInterest: columnMapping.treatmentInterest ? (row[columnMapping.treatmentInterest] || null) : null,
      notes:             columnMapping.notes             ? (row[columnMapping.notes]             || null) : null,
      language:          columnMapping.language          ? (row[columnMapping.language]          || 'en') : 'en',
    }));

    const result = await leadStore.bulkCreateLeads(tenantId, rows, { assignedTo: req.user.sub });

    // Return counts + skipped detail only — inserted list omitted (can be large)
    res.json({
      insertedCount: result.insertedCount,
      skippedCount:  result.skippedCount,
      skipped:       result.skipped,
    });
  } catch (err) {
    console.error('[Leads] bulk error:', err.message);
    res.status(500).json({ error: 'Bulk import failed.' });
  }
});

// GET /api/leads?page=1&limit=20 — paginated list
router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const isConsultant = req.user?.role === 'hasta_danismani';
    const assignedTo = isConsultant ? req.user.sub : null;
    const result = await leadStore.getAllLeads(req.user?.tenantId, { page, limit, assignedTo });
    res.json(result);
  } catch (err) {
    console.error('[Leads] GET / error:', err.message);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /api/leads/:id/cases — treatment cases linked to this lead
router.get('/:id/cases', ...requireRole('operasyon_muduru', 'klinik_sahibi', 'hasta_danismani', 'koordinator'), async (req, res) => {
  try {
    const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const tenantId = isPlatformAdmin ? req.query.tenantId : req.user.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const { rows } = await pool.query(
      `SELECT id, patient_name, treatment_description, amount_due, payment_method,
              status, paid_at, signed_at, signwell_document_id, created_at
       FROM treatment_cases
       WHERE lead_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [req.params.id, tenantId],
    );
    res.json({ cases: rows });
  } catch (err) {
    console.error('[Leads] GET /:id/cases error:', err.message);
    res.status(500).json({ error: 'Failed to fetch cases.' });
  }
});

// GET /api/leads/:id/messages — full conversation thread
router.get('/:id/messages', async (req, res) => {
  try {
    const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user?.role);
    if (!isPlatformAdmin) {
      const { rows: lr } = await pool.query(
        `SELECT assigned_to FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [req.params.id, req.user.tenantId],
      );
      if (!lr.length) return res.status(404).json({ error: 'Lead not found.' });
    }
    const messages = await leadStore.getMessages(req.params.id);
    res.json({ messages, total: messages.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/leads/:id — single lead detail with tenant isolation + sales ownership check
router.get('/:id', async (req, res) => {
  try {
    const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const tenantId = isPlatformAdmin ? null : req.user.tenantId;

    const lead = await leadStore.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });

    // Tenant isolation for non-platform-admins
    if (tenantId && lead.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    res.json({ lead });
  } catch (err) {
    console.error('[Leads] GET /:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch lead.' });
  }
});

// POST /api/leads/score-all — score every lead sequentially (super_admin / admin only)
router.post('/score-all', ...requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    // Fetch all non-deleted leads
    const { rows: leadRows } = await pool.query(
      `SELECT id FROM leads WHERE deleted_at IS NULL ORDER BY created_at DESC`,
    );

    // Respond immediately with the total so the UI can show progress
    res.json({ started: true, total: leadRows.length });

    // Process sequentially in the background — don't await res (already sent)
    let scored = 0;
    let failed = 0;
    for (const { id } of leadRows) {
      try {
        const messages = await leadStore.getMessages(id);
        await scoreLead(id, messages);
        scored++;
      } catch (err) {
        failed++;
        console.error(`[ScoreAll] lead ${id} failed:`, err.message);
      }
      // Small delay between Claude calls to avoid rate limits
      await new Promise(r => setTimeout(r, 300));
    }
    console.log(`[ScoreAll] done — scored=${scored} failed=${failed} total=${leadRows.length}`);
  } catch (err) {
    console.error('[ScoreAll] error:', err.message);
    // Only send error if we haven't flushed yet (res may already be sent)
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/:id/score — manually trigger AI lead scoring
router.post('/:id/score', async (req, res) => {
  try {
    const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user?.role);
    const tenantId = isPlatformAdmin ? null : req.user.tenantId;
    const lead = await leadStore.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (tenantId && lead.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const messages = await leadStore.getMessages(lead.id);
    const result   = await scoreLead(lead.id, messages);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Leads] score error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/:id/reactivate — send a cold-lead AI follow-up
router.post('/:id/reactivate', async (req, res) => {
  try {
    const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user?.role);
    const tenantId = isPlatformAdmin ? null : req.user.tenantId;
    const lead = await leadStore.getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (tenantId && lead.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const history = await leadStore.getMessages(lead.id);
    const reply   = await ai.generateFollowUp({
      incomingText:   'Re-engagement follow-up',
      language:       lead.language || 'en',
      scenario:       ai.SCENARIOS.COLD_LEAD,
      patientName:    lead.firstName,
      messageHistory: history,
    });

    const { rows: cfgRows } = await pool.query(
      `SELECT phone_number_id, access_token FROM whatsapp_configs
       WHERE tenant_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1`,
      [lead.tenantId],
    ).catch(() => ({ rows: [] }));
    const waConfig = cfgRows[0]
      ? { phoneNumberId: cfgRows[0].phone_number_id, accessToken: cfgRows[0].access_token }
      : {};

    const sendResult = await whatsapp.sendText(`+${lead.phone}`, reply, waConfig);

    await leadStore.saveMessage({
      leadId:            lead.id,
      direction:         'outbound',
      content:           reply,
      aiGenerated:       true,
      whatsappMessageId: sendResult.messages?.[0]?.id || null,
      status:            'sent',
    });

    await leadStore.updateLeadAiFields(lead.id, {
      aiFollowUpCount: (lead.aiFollowUpCount || 0) + 1,
      lastAiMessageAt: new Date().toISOString(),
    });

    res.json({ success: true, reply, whatsapp: sendResult });
  } catch (err) {
    console.error('[Leads] reactivate error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// ─── PATCH /api/leads/:id/resolve — clear action_required, re-enable AI ───────
router.patch('/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const isSuperAdmin = req.user?.role === 'super_admin';
  const scopeFilter  = isSuperAdmin ? '' : 'AND tenant_id = $2';
  const scopeParams  = isSuperAdmin ? [id] : [id, req.user.tenantId];

  try {
    const { rows } = await pool.query(`
      UPDATE leads
      SET action_required      = FALSE,
          ai_follow_up_enabled = TRUE,
          updated_at           = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
        ${scopeFilter}
      RETURNING id
    `, scopeParams);

    if (!rows.length) return res.status(404).json({ error: 'Lead not found' });

    console.log(`[Leads] Resolved action_required for lead ${id}`);
    res.json({ success: true, leadId: rows[0].id });
  } catch (err) {
    console.error('[Leads] PATCH /:id/resolve error:', err.message);
    res.status(500).json({ error: 'Failed to resolve lead' });
  }
});

// ─── PATCH /api/leads/:id/assign — reassign lead + cascade to cases ──────────
router.patch('/:id/assign', ...requireRole('operasyon_muduru', 'klinik_sahibi', 'super_admin', 'admin'), async (req, res) => {
  try {
    const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const tenantId = isPlatformAdmin ? req.body.tenantId : req.user.tenantId;
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const { assignedTo = null } = req.body;

    // Validate assignedTo: must be an active sales user in the same tenant (or null to unassign)
    if (assignedTo !== null && assignedTo !== undefined) {
      const { rows: userRows } = await pool.query(
        `SELECT u.id FROM user_tenants ut
         JOIN users u ON u.id = ut.user_id
         JOIN roles r ON r.id = ut.role_id
         WHERE u.id = $1 AND ut.tenant_id = $2 AND r.name = ANY($3) AND u.deleted_at IS NULL`,
        [assignedTo, tenantId, ASSIGNABLE_ROLES],
      );
      if (!userRows.length) {
        return res.status(400).json({ error: 'assignedTo must be an active treatment coordinator or sales user in the same clinic.' });
      }
    }

    // Update lead
    const { rows: leadRows } = await pool.query(
      `UPDATE leads SET assigned_to = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
       RETURNING id, assigned_to`,
      [assignedTo || null, req.params.id, tenantId],
    );
    if (!leadRows.length) return res.status(404).json({ error: 'Lead not found.' });

    // Cascade: update all cases linked to this lead
    await pool.query(
      `UPDATE treatment_cases SET assigned_to = $1, updated_at = NOW()
       WHERE lead_id = $2 AND tenant_id = $3`,
      [assignedTo || null, req.params.id, tenantId],
    );

    res.json({ success: true, leadId: leadRows[0].id, assignedTo: leadRows[0].assigned_to });
  } catch (err) {
    console.error('[Leads] PATCH /:id/assign error:', err.message);
    res.status(500).json({ error: 'Failed to reassign lead.' });
  }
});

// ─── PATCH /api/leads/:id — edit lead fields ─────────────────────────────────
// Placed AFTER all /:id/verb routes so Express resolves those first.
router.patch('/:id', ...requireRole('operasyon_muduru', 'klinik_sahibi', 'hasta_danismani', 'koordinator'), async (req, res) => {
  try {
    const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const tenantId = isPlatformAdmin ? req.body.tenantId : req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required.' });
    }

    const { firstName, lastName, phone, email, language, treatmentInterest, notes,
            aiFollowUpEnabled, gdprConsentGiven, status, assignedTo } = req.body;

    // Enabling AI follow-up requires GDPR consent. Check against the resulting state:
    // if aiFollowUpEnabled is being set true, consent must be true (either provided now or already on record).
    if (aiFollowUpEnabled === true) {
      const existing = await leadStore.getLeadById(req.params.id);
      if (!existing || existing.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Lead not found.' });
      }
      const consentAfter = gdprConsentGiven === true || (gdprConsentGiven === undefined && existing.gdprConsentGiven === true);
      if (!consentAfter) {
        return res.status(400).json({ error: 'GDPR consent is required to enable AI follow-up.' });
      }
    }

    const VALID_STATUSES = ['new', 'contacted', 'responded', 'qualified', 'booked', 'attended', 'lost', 'archived'];
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    const lead = await leadStore.updateLead(req.params.id, tenantId, {
      firstName, lastName, phone, email, language, treatmentInterest, notes,
      aiFollowUpEnabled, gdprConsentGiven, status, assignedTo,
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    res.json({ lead });
  } catch (err) {
    if (err.code === 'DUPLICATE_PHONE') {
      return res.status(409).json({ error: err.message });
    }
    console.error('[Leads] update error:', err.message);
    res.status(500).json({ error: 'Failed to update lead.' });
  }
});

module.exports = router;

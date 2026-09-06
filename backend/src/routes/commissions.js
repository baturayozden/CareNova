'use strict';

/**
 * Commission API — /api/commissions
 *
 * ── Sections ──────────────────────────────────────────────────────────────────
 * 1. Scheme management   (schemes, tiers, thresholds, team-bonus-tiers, targets)
 * 2. Treatment deals     (CRUD, TC ownership enforcement)
 * 3. Periods             (open, calculate, approve, report JSON + CSV)
 * 4. Payment import & matching (CSV import, fuzzy matching, manual review)
 *
 * ── Auth / tenant isolation ───────────────────────────────────────────────────
 * All routes require authenticate (applied at mount in index.js).
 * Every DB query is scoped to a resolved tenantId:
 *   - Platform admin (super_admin | admin, tenantId NULL) → tenantId from query/body.
 *   - Tenant user → user.tenantId from JWT.
 * A tenant user can NEVER touch another tenant's records.
 *
 * ── Permissions matrix ────────────────────────────────────────────────────────
 * Scheme CRUD:      director, clinic_admin, + platform admins
 * Deal CRUD:        treatment_coordinator (own deals only), director, clinic_admin,
 *                   + platform admins
 * Period calculate: director, clinic_admin, + platform admins
 * Period approve:   director + platform admins ONLY (clinic_admin cannot approve)
 * Payment import / matching / review: director, clinic_admin, + platform admins (no TC)
 *
 * ── Schema notes ──────────────────────────────────────────────────────────────
 * commission_records.total_commission is GENERATED ALWAYS AS — never in INSERT/UPDATE.
 * treatment_deals.verification_status added by migration 019:
 *   'unverified' | 'auto_matched' | 'manually_approved' | 'rejected'
 * calculate: requireVerification param (default true) filters deals by
 *   verification_status IN ('auto_matched','manually_approved').
 */

const express    = require('express');
const router     = express.Router();
const { pool }   = require('../db/index');
const { calculateCommission } = require('../services/commissionEngine');
const { matchPayments }       = require('../services/paymentMatcher');
const { parse: csvParse }     = require('csv-parse/sync');
const caseStore  = require('../services/caseStore');
const { isHastaDanismani, validateAssignableStaff } = require('../utils/staff');

// ── Role constants ─────────────────────────────────────────────────────────────

const PLATFORM_ROLES      = ['super_admin', 'admin'];
const SCHEME_MGR_ROLES    = ['super_admin', 'admin', 'operasyon_muduru', 'klinik_sahibi'];
const DEAL_ROLES          = ['super_admin', 'admin', 'operasyon_muduru', 'klinik_sahibi', 'hasta_danismani', 'muhasebe'];
const PERIOD_CALC_ROLES   = ['super_admin', 'admin', 'operasyon_muduru', 'klinik_sahibi', 'muhasebe'];
const PERIOD_APPROVE_ROLES = ['super_admin', 'admin', 'operasyon_muduru'];
const PAYMENT_MGR_ROLES    = ['super_admin', 'admin', 'operasyon_muduru', 'klinik_sahibi', 'muhasebe'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPlatformAdmin(user) {
  return PLATFORM_ROLES.includes(user.role);
}


/**
 * Resolve effective tenantId for a request.
 * Platform admins must supply tenantId in query or body.
 */
function resolveTenant(user, source = {}) {
  if (isPlatformAdmin(user)) {
    const t = source.tenantId;
    if (!t) {
      const err = new Error('tenantId is required for platform admins');
      err.status = 400;
      throw err;
    }
    return t;
  }
  return user.tenantId;
}

/** Throw 403 if recordTenantId ≠ effectiveTenantId. */
function assertTenant(recordTenantId, effectiveTenantId) {
  if (recordTenantId !== effectiveTenantId) {
    const err = new Error('Access denied: tenant mismatch');
    err.status = 403;
    throw err;
  }
}

/** Centralised error handler. Respects err.status if set. */
function handleErr(res, tag, err) {
  console.error(`[Commissions] ${tag}:`, err.message);
  return res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
}

/**
 * Commission-eligible revenue for a deal.
 * Only agreed_amount counts — quoted_amount is merely an offer and must never
 * inflate commission figures. A deal with agreed_amount NULL contributes €0.
 */
function dealRevenue(deal) {
  return deal.agreed_amount !== null && deal.agreed_amount !== undefined
    ? Number(deal.agreed_amount)
    : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: SCHEME MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /schemes?tenantId= ────────────────────────────────────────────────────
router.get('/schemes', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.query);
    const { rows } = await pool.query(
      `SELECT cs.*,
         (SELECT json_agg(t ORDER BY t.tier_order)
            FROM commission_tiers t
           WHERE t.scheme_id = cs.id)                                 AS tiers,
         (SELECT json_agg(p ORDER BY p.target_percent)
            FROM commission_performance_thresholds p
           WHERE p.scheme_id = cs.id)                                 AS thresholds,
         (SELECT json_agg(tb ORDER BY tb.tier_order)
            FROM team_bonus_tiers tb
           WHERE tb.tenant_id = cs.tenant_id)                         AS team_bonus_tiers
        FROM commission_schemes cs
       WHERE cs.tenant_id = $1
       ORDER BY cs.is_active DESC, cs.effective_from DESC`,
      [tenantId],
    );
    return res.json({ schemes: rows });
  } catch (err) { return handleErr(res, 'GET /schemes', err); }
});

// ── POST /schemes ─────────────────────────────────────────────────────────────
router.post('/schemes', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { name, description, type, tier_application = 'flat', is_active = true, effective_from, effective_to } = req.body;

    if (!name?.trim())    return res.status(400).json({ error: 'name required' });
    if (!effective_from)  return res.status(400).json({ error: 'effective_from required' });
    if (!['flat_rate', 'tiered', 'target_based'].includes(type))
      return res.status(400).json({ error: 'type must be flat_rate | tiered | target_based' });
    if (!['flat', 'marginal'].includes(tier_application))
      return res.status(400).json({ error: 'tier_application must be flat | marginal' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Only one active scheme per tenant at a time
      if (is_active) {
        await client.query(
          `UPDATE commission_schemes SET is_active = FALSE
            WHERE tenant_id = $1 AND is_active = TRUE`,
          [tenantId],
        );
      }
      const { rows } = await client.query(
        `INSERT INTO commission_schemes
           (tenant_id, name, description, type, tier_application, is_active, effective_from, effective_to)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [tenantId, name.trim(), description || null, type, tier_application, is_active,
          effective_from, effective_to || null],
      );
      await client.query('COMMIT');
      return res.status(201).json({ scheme: rows[0] });
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch (err) { return handleErr(res, 'POST /schemes', err); }
});

// ── PUT /schemes/:id ──────────────────────────────────────────────────────────
router.put('/schemes/:id', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { rows: found } = await pool.query(
      `SELECT tenant_id FROM commission_schemes WHERE id = $1`, [req.params.id],
    );
    if (!found.length) return res.status(404).json({ error: 'Scheme not found' });
    assertTenant(found[0].tenant_id, tenantId);

    const { name, description, type, tier_application, is_active, effective_from, effective_to } = req.body;
    if (tier_application !== undefined && !['flat', 'marginal'].includes(tier_application))
      return res.status(400).json({ error: 'tier_application must be flat | marginal' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (is_active === true) {
        await client.query(
          `UPDATE commission_schemes SET is_active = FALSE
            WHERE tenant_id = $1 AND is_active = TRUE AND id != $2`,
          [tenantId, req.params.id],
        );
      }
      const { rows } = await client.query(
        `UPDATE commission_schemes
            SET name             = COALESCE($1, name),
                description      = COALESCE($2, description),
                type             = COALESCE($3, type),
                tier_application = COALESCE($4, tier_application),
                is_active        = COALESCE($5, is_active),
                effective_from   = COALESCE($6, effective_from),
                effective_to     = COALESCE($7, effective_to)
          WHERE id = $8 RETURNING *`,
        [name || null, description !== undefined ? description : null,
          type || null, tier_application || null, is_active ?? null,
          effective_from || null,
          effective_to !== undefined ? (effective_to || null) : undefined,
          req.params.id],
      );
      await client.query('COMMIT');
      return res.json({ scheme: rows[0] });
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch (err) { return handleErr(res, 'PUT /schemes/:id', err); }
});

// ── POST /schemes/:id/tiers ───────────────────────────────────────────────────
router.post('/schemes/:id/tiers', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { rows: scheme } = await pool.query(
      `SELECT tenant_id FROM commission_schemes WHERE id = $1`, [req.params.id],
    );
    if (!scheme.length) return res.status(404).json({ error: 'Scheme not found' });
    assertTenant(scheme[0].tenant_id, tenantId);

    const { tier_order, min_revenue = 0, max_revenue, rate_percent, flat_bonus = 0 } = req.body;
    if (tier_order == null) return res.status(400).json({ error: 'tier_order required' });
    if (rate_percent == null) return res.status(400).json({ error: 'rate_percent required' });

    const { rows } = await pool.query(
      `INSERT INTO commission_tiers
         (scheme_id, tier_order, min_revenue, max_revenue, rate_percent, flat_bonus)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, tier_order, min_revenue, max_revenue ?? null, rate_percent, flat_bonus],
    );
    return res.status(201).json({ tier: rows[0] });
  } catch (err) { return handleErr(res, 'POST /schemes/:id/tiers', err); }
});

// ── PUT /tiers/:id ────────────────────────────────────────────────────────────
router.put('/tiers/:id', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { rows } = await pool.query(
      `SELECT ct.*, cs.tenant_id FROM commission_tiers ct
         JOIN commission_schemes cs ON cs.id = ct.scheme_id
        WHERE ct.id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Tier not found' });
    assertTenant(rows[0].tenant_id, tenantId);

    const { tier_order, min_revenue, max_revenue, rate_percent, flat_bonus } = req.body;
    const { rows: updated } = await pool.query(
      `UPDATE commission_tiers
          SET tier_order   = COALESCE($1, tier_order),
              min_revenue  = COALESCE($2, min_revenue),
              max_revenue  = COALESCE($3, max_revenue),
              rate_percent = COALESCE($4, rate_percent),
              flat_bonus   = COALESCE($5, flat_bonus)
        WHERE id = $6 RETURNING *`,
      [tier_order ?? null, min_revenue ?? null,
        max_revenue !== undefined ? (max_revenue ?? null) : rows[0].max_revenue,
        rate_percent ?? null, flat_bonus ?? null, req.params.id],
    );
    return res.json({ tier: updated[0] });
  } catch (err) { return handleErr(res, 'PUT /tiers/:id', err); }
});

// ── DELETE /tiers/:id ─────────────────────────────────────────────────────────
router.delete('/tiers/:id', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.query);
    const { rows } = await pool.query(
      `SELECT ct.id, cs.tenant_id FROM commission_tiers ct
         JOIN commission_schemes cs ON cs.id = ct.scheme_id
        WHERE ct.id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Tier not found' });
    assertTenant(rows[0].tenant_id, tenantId);
    await pool.query(`DELETE FROM commission_tiers WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) { return handleErr(res, 'DELETE /tiers/:id', err); }
});

// ── POST /schemes/:id/thresholds ──────────────────────────────────────────────
router.post('/schemes/:id/thresholds', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { rows: scheme } = await pool.query(
      `SELECT tenant_id FROM commission_schemes WHERE id = $1`, [req.params.id],
    );
    if (!scheme.length) return res.status(404).json({ error: 'Scheme not found' });
    assertTenant(scheme[0].tenant_id, tenantId);

    const { target_percent, multiplier = 1.0, label } = req.body;
    if (target_percent == null) return res.status(400).json({ error: 'target_percent required' });

    const { rows } = await pool.query(
      `INSERT INTO commission_performance_thresholds (scheme_id, target_percent, multiplier, label)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, target_percent, multiplier, label || null],
    );
    return res.status(201).json({ threshold: rows[0] });
  } catch (err) { return handleErr(res, 'POST /schemes/:id/thresholds', err); }
});

// ── PUT /thresholds/:id ───────────────────────────────────────────────────────
router.put('/thresholds/:id', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { rows } = await pool.query(
      `SELECT pt.*, cs.tenant_id FROM commission_performance_thresholds pt
         JOIN commission_schemes cs ON cs.id = pt.scheme_id
        WHERE pt.id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Threshold not found' });
    assertTenant(rows[0].tenant_id, tenantId);

    const { target_percent, multiplier, label } = req.body;
    const { rows: updated } = await pool.query(
      `UPDATE commission_performance_thresholds
          SET target_percent = COALESCE($1, target_percent),
              multiplier     = COALESCE($2, multiplier),
              label          = COALESCE($3, label)
        WHERE id = $4 RETURNING *`,
      [target_percent ?? null, multiplier ?? null, label || null, req.params.id],
    );
    return res.json({ threshold: updated[0] });
  } catch (err) { return handleErr(res, 'PUT /thresholds/:id', err); }
});

// ── DELETE /thresholds/:id ────────────────────────────────────────────────────
router.delete('/thresholds/:id', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.query);
    const { rows } = await pool.query(
      `SELECT pt.id, cs.tenant_id FROM commission_performance_thresholds pt
         JOIN commission_schemes cs ON cs.id = pt.scheme_id
        WHERE pt.id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Threshold not found' });
    assertTenant(rows[0].tenant_id, tenantId);
    await pool.query(`DELETE FROM commission_performance_thresholds WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) { return handleErr(res, 'DELETE /thresholds/:id', err); }
});

// ── POST /schemes/:id/team-bonus-tiers ────────────────────────────────────────
router.post('/schemes/:id/team-bonus-tiers', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { rows: scheme } = await pool.query(
      `SELECT tenant_id FROM commission_schemes WHERE id = $1`, [req.params.id],
    );
    if (!scheme.length) return res.status(404).json({ error: 'Scheme not found' });
    assertTenant(scheme[0].tenant_id, tenantId);

    const {
      tier_order, min_revenue, max_revenue,
      bonus_per_staff = 0, bonus_pool = 0, split_method = 'per_staff',
    } = req.body;
    if (tier_order == null || min_revenue == null)
      return res.status(400).json({ error: 'tier_order and min_revenue required' });

    const { rows } = await pool.query(
      `INSERT INTO team_bonus_tiers
         (tenant_id, tier_order, min_revenue, max_revenue, bonus_per_staff, bonus_pool, split_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, tier_order, min_revenue, max_revenue ?? null,
        bonus_per_staff, bonus_pool, split_method],
    );
    return res.status(201).json({ teamBonusTier: rows[0] });
  } catch (err) { return handleErr(res, 'POST /schemes/:id/team-bonus-tiers', err); }
});

// ── PUT /team-bonus-tiers/:id ─────────────────────────────────────────────────
router.put('/team-bonus-tiers/:id', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { rows } = await pool.query(
      `SELECT * FROM team_bonus_tiers WHERE id = $1`, [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Team bonus tier not found' });
    assertTenant(rows[0].tenant_id, tenantId);

    const { tier_order, min_revenue, max_revenue, bonus_per_staff, bonus_pool, split_method } = req.body;
    const { rows: updated } = await pool.query(
      `UPDATE team_bonus_tiers
          SET tier_order      = COALESCE($1, tier_order),
              min_revenue     = COALESCE($2, min_revenue),
              max_revenue     = COALESCE($3, max_revenue),
              bonus_per_staff = COALESCE($4, bonus_per_staff),
              bonus_pool      = COALESCE($5, bonus_pool),
              split_method    = COALESCE($6, split_method)
        WHERE id = $7 RETURNING *`,
      [tier_order ?? null, min_revenue ?? null,
        max_revenue !== undefined ? (max_revenue ?? null) : rows[0].max_revenue,
        bonus_per_staff ?? null, bonus_pool ?? null, split_method || null, req.params.id],
    );
    return res.json({ teamBonusTier: updated[0] });
  } catch (err) { return handleErr(res, 'PUT /team-bonus-tiers/:id', err); }
});

// ── DELETE /team-bonus-tiers/:id ──────────────────────────────────────────────
router.delete('/team-bonus-tiers/:id', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.query);
    const { rows } = await pool.query(
      `SELECT id, tenant_id FROM team_bonus_tiers WHERE id = $1`, [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Team bonus tier not found' });
    assertTenant(rows[0].tenant_id, tenantId);
    await pool.query(`DELETE FROM team_bonus_tiers WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) { return handleErr(res, 'DELETE /team-bonus-tiers/:id', err); }
});

// ── POST /revenue-targets ─────────────────────────────────────────────────────
router.post('/revenue-targets', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { period_start, period_end, target_type = 'monthly', target_amount, currency = 'GBP', notes } = req.body;
    if (!period_start || !period_end)
      return res.status(400).json({ error: 'period_start and period_end required' });
    if (target_amount == null)
      return res.status(400).json({ error: 'target_amount required' });

    const { rows } = await pool.query(
      `INSERT INTO clinic_revenue_targets
         (tenant_id, period_start, period_end, target_type, target_amount, currency, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, period_start, period_end, target_type, target_amount, currency, notes || null],
    );
    return res.status(201).json({ revenueTarget: rows[0] });
  } catch (err) { return handleErr(res, 'POST /revenue-targets', err); }
});

// ── PUT /revenue-targets/:id ──────────────────────────────────────────────────
router.put('/revenue-targets/:id', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { rows } = await pool.query(
      `SELECT * FROM clinic_revenue_targets WHERE id = $1`, [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Revenue target not found' });
    assertTenant(rows[0].tenant_id, tenantId);

    const { period_start, period_end, target_type, target_amount, currency, notes } = req.body;
    const { rows: updated } = await pool.query(
      `UPDATE clinic_revenue_targets
          SET period_start  = COALESCE($1, period_start),
              period_end    = COALESCE($2, period_end),
              target_type   = COALESCE($3, target_type),
              target_amount = COALESCE($4, target_amount),
              currency      = COALESCE($5, currency),
              notes         = COALESCE($6, notes)
        WHERE id = $7 RETURNING *`,
      [period_start || null, period_end || null, target_type || null,
        target_amount ?? null, currency || null, notes || null, req.params.id],
    );
    return res.json({ revenueTarget: updated[0] });
  } catch (err) { return handleErr(res, 'PUT /revenue-targets/:id', err); }
});

// ── DELETE /revenue-targets/:id ───────────────────────────────────────────────
router.delete('/revenue-targets/:id', async (req, res) => {
  if (!SCHEME_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.query);
    const { rows } = await pool.query(
      `SELECT id, tenant_id FROM clinic_revenue_targets WHERE id = $1`, [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Revenue target not found' });
    assertTenant(rows[0].tenant_id, tenantId);
    await pool.query(`DELETE FROM clinic_revenue_targets WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) { return handleErr(res, 'DELETE /revenue-targets/:id', err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: TREATMENT DEALS
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /deals?tenantId=&periodMonth=YYYY-MM ──────────────────────────────────
// periodMonth filters deal_date to that calendar month (optional).
// treatment_coordinator: only their own deals (assigned_staff_id = own userId).
router.get('/deals', async (req, res) => {
  if (!DEAL_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.query);
    const params = [tenantId];
    const conditions = ['td.tenant_id = $1', 'td.deleted_at IS NULL'];

    // TC: scoped to own deals only
    if (isHastaDanismani(req.user)) {
      params.push(req.user.sub);
      conditions.push(`td.assigned_staff_id = $${params.length}`);
    }

    // Prefer exact period dates (periodStart + periodEnd) over calendar-month approximation.
    // periodMonth kept for backward compat but periodStart/periodEnd takes precedence.
    if (req.query.periodStart && req.query.periodEnd) {
      params.push(req.query.periodStart);
      const startIdx = params.length;
      params.push(req.query.periodEnd);
      const endIdx = params.length;
      conditions.push(`td.deal_date >= $${startIdx}::date AND td.deal_date <= $${endIdx}::date`);
    } else if (req.query.periodMonth) {
      const [year, month] = req.query.periodMonth.split('-');
      if (year && month) {
        params.push(`${year}-${month}-01`);
        conditions.push(
          `td.deal_date >= $${params.length}::date AND td.deal_date < ($${params.length}::date + INTERVAL '1 month')`,
        );
      }
    }

    // Optional lead filter: leadId=<uuid>
    if (req.query.leadId) {
      params.push(req.query.leadId);
      conditions.push(`td.lead_id = $${params.length}`);
    }

    const { rows } = await pool.query(
      `SELECT td.*,
              u.first_name  AS staff_first_name, u.last_name AS staff_last_name,
              be.entity_key AS billing_entity_key, be.legal_entity_name AS billing_entity_name,
              r.name        AS staff_role
         FROM treatment_deals td
         LEFT JOIN users            u  ON u.id  = td.assigned_staff_id
         LEFT JOIN billing_entities be ON be.id = td.billing_entity_id
         LEFT JOIN user_tenants     ut ON ut.user_id = td.assigned_staff_id AND ut.tenant_id = td.tenant_id
         LEFT JOIN roles            r  ON r.id  = ut.role_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY td.deal_date DESC, td.created_at DESC`,
      params,
    );
    return res.json({ deals: rows });
  } catch (err) { return handleErr(res, 'GET /deals', err); }
});

// ── POST /deals ───────────────────────────────────────────────────────────────
// TC: assigned_staff_id is always forced to their own userId, regardless of body.
// G1b: pass create_case=true + payment_method (+ optional payer_type / cardholder_*)
//      to atomically INSERT deal → INSERT case → UPDATE deal.case_id in one transaction.
const CASE_VALID_METHODS = ['finance', 'bank_transfer', 'card', 'pay_by_bank', 'cash'];
router.post('/deals', async (req, res) => {
  if (!DEAL_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const {
      lead_id, patient_name, patient_email, patient_phone, treatment_category, treatment_name,
      quoted_amount, agreed_amount, deposit_amount = 0,
      currency = 'GBP', deal_date, expected_start_date,
      status = 'quoted', notes,
      billing_entity_id, balance_due_date, case_id,
      // G1b — case creation
      create_case = false,
      payment_method, payer_type = 'self',
      cardholder_name, cardholder_email, cardholder_phone,
      cardholder_relationship, cardholder_address,
    } = req.body;

    if (!treatment_category?.trim())
      return res.status(400).json({ error: 'treatment_category required' });

    if (billing_entity_id) {
      const { rows: beRows } = await pool.query(
        `SELECT id FROM billing_entities WHERE id = $1 AND tenant_id = $2`,
        [billing_entity_id, tenantId],
      );
      if (!beRows.length) return res.status(400).json({ error: 'Invalid billing_entity_id for this tenant.' });
    }

    if (create_case) {
      if (!payment_method)
        return res.status(400).json({ error: 'payment_method is required when creating a case.' });
      if (!CASE_VALID_METHODS.includes(payment_method))
        return res.status(400).json({ error: `payment_method must be one of: ${CASE_VALID_METHODS.join(', ')}` });
    }

    // hasta_danismani self-assign; admins must supply assigned_staff_id (validated via user_tenants)
    let assignedStaffId;
    if (isHastaDanismani(req.user)) {
      assignedStaffId = req.user.sub;
    } else {
      if (!req.body.assigned_staff_id)
        return res.status(400).json({ error: 'Assigned staff required — select which hasta_danismani this deal belongs to.' });
      const valid = await validateAssignableStaff(req.body.assigned_staff_id, tenantId);
      if (!valid)
        return res.status(400).json({ error: 'assigned_staff_id must be an active hasta_danismani in this tenant.' });
      assignedStaffId = req.body.assigned_staff_id;
    }

    const dealSQL = `INSERT INTO treatment_deals
         (tenant_id, lead_id, assigned_staff_id, patient_name, patient_email, patient_phone,
          treatment_category, treatment_name,
          quoted_amount, agreed_amount, deposit_amount, currency,
          deal_date, expected_start_date, status, notes,
          billing_entity_id, balance_due_date, case_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`;
    const dealVals = [
      tenantId, lead_id || null, assignedStaffId,
      patient_name?.trim() || null, patient_email?.trim() || null, patient_phone?.trim() || null,
      treatment_category.trim(), treatment_name || null,
      quoted_amount ?? null, agreed_amount ?? null, deposit_amount,
      currency, deal_date || new Date().toISOString().slice(0, 10),
      expected_start_date || null, status, notes || null,
      billing_entity_id || null,
      balance_due_date ? balance_due_date.slice(0, 10) : null,
      case_id || null,
    ];

    if (!create_case) {
      const { rows } = await pool.query(dealSQL, dealVals);
      return res.status(201).json({ deal: rows[0] });
    }

    // ── Atomic: deal + case + case_id link ───────────────────────────────────
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: dealRows } = await client.query(dealSQL, dealVals);
      const deal = dealRows[0];

      const newCase = await caseStore.createCase(tenantId, {
        leadId:                deal.lead_id,
        patientName:           deal.patient_name,
        patientPhone:          deal.patient_phone,
        patientEmail:          deal.patient_email,
        treatmentDescription:  deal.treatment_name || deal.treatment_category,
        totalCost:             deal.agreed_amount,
        amountDue:             deal.agreed_amount,
        paymentMethod:         payment_method,
        payerType:             payer_type,
        cardholderName:        cardholder_name        || null,
        cardholderEmail:       cardholder_email       || null,
        cardholderPhone:       cardholder_phone       || null,
        cardholderRelationship: cardholder_relationship || null,
        cardholderAddress:     cardholder_address     || null,
        status:                'draft',
        createdBy:             req.user.sub,
        assignedTo:            req.user.sub,
      }, client);

      await client.query(
        `UPDATE treatment_deals SET case_id = $1, updated_at = NOW() WHERE id = $2`,
        [newCase.id, deal.id],
      );
      deal.case_id = newCase.id;

      await client.query('COMMIT');
      return res.status(201).json({ deal, case: newCase });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) { return handleErr(res, 'POST /deals', err); }
});

// ── PUT /deals/:id ────────────────────────────────────────────────────────────
router.put('/deals/:id', async (req, res) => {
  if (!DEAL_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { rows: found } = await pool.query(
      `SELECT * FROM treatment_deals WHERE id = $1`, [req.params.id],
    );
    if (!found.length) return res.status(404).json({ error: 'Deal not found' });
    const deal = found[0];
    assertTenant(deal.tenant_id, tenantId);

    if (deal.commission_locked)
      return res.status(409).json({ error: 'Deal is locked in a finalised commission period and cannot be edited' });

    // TC can only edit their own deals
    if (isHastaDanismani(req.user) && deal.assigned_staff_id !== req.user.sub)
      return res.status(403).json({ error: 'Treatment coordinators can only edit their own deals' });

    const {
      patient_name, patient_email, patient_phone, treatment_category, treatment_name, quoted_amount, agreed_amount,
      deposit_amount, currency, deal_date, expected_start_date, status, notes,
      billing_entity_id, balance_due_date, case_id,
    } = req.body;

    if (billing_entity_id) {
      const { rows: beRows } = await pool.query(
        `SELECT id FROM billing_entities WHERE id = $1 AND tenant_id = $2`,
        [billing_entity_id, tenantId],
      );
      if (!beRows.length) return res.status(400).json({ error: 'Invalid billing_entity_id for this tenant.' });
    }

    // hasta_danismani cannot reassign; admins validate new assignment via user_tenants
    let assignedStaffId;
    if (isHastaDanismani(req.user)) {
      assignedStaffId = deal.assigned_staff_id;
    } else if (req.body.assigned_staff_id !== undefined) {
      if (req.body.assigned_staff_id) {
        const valid = await validateAssignableStaff(req.body.assigned_staff_id, tenantId);
        if (!valid)
          return res.status(400).json({ error: 'assigned_staff_id must be an active hasta_danismani in this tenant.' });
      }
      assignedStaffId = req.body.assigned_staff_id || null;
    } else {
      assignedStaffId = deal.assigned_staff_id;
    }

    const { rows: updated } = await pool.query(
      `UPDATE treatment_deals
          SET assigned_staff_id   = $1,
              patient_name        = COALESCE($2, patient_name),
              patient_email       = COALESCE($3, patient_email),
              patient_phone       = COALESCE($4, patient_phone),
              treatment_category  = COALESCE($5, treatment_category),
              treatment_name      = COALESCE($6, treatment_name),
              quoted_amount       = COALESCE($7, quoted_amount),
              agreed_amount       = COALESCE($8, agreed_amount),
              deposit_amount      = COALESCE($9, deposit_amount),
              currency            = COALESCE($10, currency),
              deal_date           = COALESCE($11, deal_date),
              expected_start_date = COALESCE($12, expected_start_date),
              status              = COALESCE($13, status),
              notes               = COALESCE($14, notes),
              billing_entity_id   = COALESCE($15, billing_entity_id),
              balance_due_date    = COALESCE($16, balance_due_date),
              case_id             = COALESCE($17, case_id)
        WHERE id = $18 RETURNING *`,
      [assignedStaffId,
        patient_name?.trim() || null, patient_email?.trim() || null, patient_phone?.trim() || null,
        treatment_category?.trim() || null, treatment_name || null,
        quoted_amount ?? null, agreed_amount ?? null,
        deposit_amount ?? null, currency || null,
        deal_date || null, expected_start_date || null,
        status || null, notes || null,
        billing_entity_id || null,
        balance_due_date ? balance_due_date.slice(0, 10) : null,
        case_id || null,
        req.params.id],
    );
    return res.json({ deal: updated[0] });
  } catch (err) { return handleErr(res, 'PUT /deals/:id', err); }
});

// ── DELETE /deals/:id ─────────────────────────────────────────────────────────
router.delete('/deals/:id', async (req, res) => {
  if (!DEAL_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.query);
    const { rows: found } = await pool.query(
      `SELECT * FROM treatment_deals WHERE id = $1`, [req.params.id],
    );
    if (!found.length) return res.status(404).json({ error: 'Deal not found' });
    assertTenant(found[0].tenant_id, tenantId);

    if (found[0].commission_locked)
      return res.status(409).json({ error: 'Deal is locked in a finalised commission period and cannot be deleted' });

    if (isHastaDanismani(req.user) && found[0].assigned_staff_id !== req.user.sub)
      return res.status(403).json({ error: 'Treatment coordinators can only delete their own deals' });

    await pool.query(`DELETE FROM treatment_deals WHERE id = $1`, [req.params.id]);
    return res.json({ success: true });
  } catch (err) { return handleErr(res, 'DELETE /deals/:id', err); }
});

// ── PATCH /deals/:id/verify ───────────────────────────────────────────────────
// Admin-only: set verification_status to 'manually_approved' or 'rejected'.
// Rejected deals are excluded from quota; unverified deals count normally.
router.patch('/deals/:id/verify', async (req, res) => {
  if (!PERIOD_CALC_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Admin role required.' });
  const { action } = req.body;
  if (!['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'action must be "approve" or "reject"' });
  try {
    const tenantId   = resolveTenant(req.user, req.body);
    const verifStatus = action === 'approve' ? 'manually_approved' : 'rejected';
    const { rows } = await pool.query(
      `UPDATE treatment_deals
         SET verification_status = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [verifStatus, req.params.id, tenantId],
    );
    if (!rows.length) return res.status(404).json({ error: 'Deal not found.' });
    await pool.query(
      `INSERT INTO commission_audit_log (tenant_id, event_type, changed_by, metadata)
       VALUES ($1, 'status_change', $2, $3)`,
      [tenantId, req.user.sub, JSON.stringify({
        deal_id: req.params.id,
        action,
        new_verification_status: verifStatus,
      })],
    );
    return res.json({ deal: rows[0] });
  } catch (err) { return handleErr(res, 'PATCH /deals/:id/verify', err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: COMMISSION PERIODS
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /periods?tenantId= ────────────────────────────────────────────────────
router.get('/periods', async (req, res) => {
  if (!PERIOD_CALC_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.query);
    // Lazy guarantee: ensure this month's period exists before listing.
    await require('../services/commissionPeriods').ensureCurrentPeriod(tenantId);
    const { rows } = await pool.query(
      `SELECT cp.*,
              u.first_name AS locked_by_first, u.last_name AS locked_by_last,
              (SELECT COALESCE(SUM(td.agreed_amount), 0)::numeric
                 FROM treatment_deals td
                 LEFT JOIN user_tenants ut ON ut.user_id = td.assigned_staff_id AND ut.tenant_id = cp.tenant_id
                 LEFT JOIN roles r ON r.id = ut.role_id
                WHERE td.tenant_id = cp.tenant_id
                  AND td.deal_date >= cp.period_start
                  AND td.deal_date <= cp.period_end
                  AND td.status IN ('accepted','in_progress','completed')
                  AND td.verification_status != 'rejected'
                  AND td.deleted_at IS NULL
                  AND r.name = 'hasta_danismani') AS quota_revenue,
              (SELECT COALESCE(SUM(td.agreed_amount), 0)::numeric
                 FROM treatment_deals td
                WHERE td.tenant_id = cp.tenant_id
                  AND td.deal_date >= cp.period_start
                  AND td.deal_date <= cp.period_end
                  AND td.status IN ('accepted','in_progress','completed')
                  AND td.verification_status != 'rejected'
                  AND td.deleted_at IS NULL) AS total_revenue,
              COALESCE(cp.clinic_revenue,
                (SELECT COALESCE(SUM(td.agreed_amount), 0)::numeric
                   FROM treatment_deals td
                   LEFT JOIN user_tenants ut ON ut.user_id = td.assigned_staff_id AND ut.tenant_id = cp.tenant_id
                   LEFT JOIN roles r ON r.id = ut.role_id
                  WHERE td.tenant_id = cp.tenant_id
                    AND td.deal_date >= cp.period_start
                    AND td.deal_date <= cp.period_end
                    AND td.status IN ('accepted','in_progress','completed')
                    AND td.verification_status != 'rejected'
                    AND td.deleted_at IS NULL
                    AND r.name = 'hasta_danismani')) AS effective_quota_revenue,
              (SELECT crt.target_amount
                 FROM clinic_revenue_targets crt
                WHERE crt.tenant_id = cp.tenant_id
                  AND crt.period_start <= cp.period_end
                  AND crt.period_end   >= cp.period_start
                ORDER BY crt.period_start DESC
                LIMIT 1) AS target_amount
         FROM commission_periods cp
         LEFT JOIN users u ON u.id = cp.locked_by
        WHERE cp.tenant_id = $1
        ORDER BY cp.period_start DESC`,
      [tenantId],
    );
    return res.json({ periods: rows });
  } catch (err) { return handleErr(res, 'GET /periods', err); }
});

// ── POST /periods ─────────────────────────────────────────────────────────────
// clinic_revenue is optional at creation — can be supplied later via PUT /periods/:id.
router.post('/periods', async (req, res) => {
  if (!PERIOD_CALC_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { period_start, period_end, period_label, clinic_revenue, notes } = req.body;
    if (!period_start || !period_end || !period_label)
      return res.status(400).json({ error: 'period_start, period_end, and period_label required' });

    const { rows } = await pool.query(
      `INSERT INTO commission_periods
         (tenant_id, period_start, period_end, period_label, clinic_revenue, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, period_start, period_end, period_label,
        clinic_revenue != null ? Number(clinic_revenue) : null,
        notes || null],
    );
    return res.status(201).json({ period: rows[0] });
  } catch (err) { return handleErr(res, 'POST /periods', err); }
});

// ── PUT /periods/:id ──────────────────────────────────────────────────────────
// Allows director + clinic_admin to update clinic_revenue (and notes / label)
// on an open period. Returns 409 if the period is locked.
router.put('/periods/:id', async (req, res) => {
  if (!PERIOD_CALC_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { rows: found } = await pool.query(
      `SELECT * FROM commission_periods WHERE id = $1`, [req.params.id],
    );
    if (!found.length) return res.status(404).json({ error: 'Period not found' });
    const period = found[0];
    assertTenant(period.tenant_id, tenantId);

    if (period.status === 'locked')
      return res.status(409).json({ error: 'Period is locked and cannot be edited' });

    const { period_label, clinic_revenue, notes } = req.body;

    const { rows: updated } = await pool.query(
      `UPDATE commission_periods
          SET period_label  = COALESCE($1, period_label),
              clinic_revenue = COALESCE($2, clinic_revenue),
              notes          = COALESCE($3, notes)
        WHERE id = $4 RETURNING *`,
      [period_label || null,
        clinic_revenue != null ? Number(clinic_revenue) : null,
        notes || null,
        req.params.id],
    );
    return res.json({ period: updated[0] });
  } catch (err) { return handleErr(res, 'PUT /periods/:id', err); }
});

// ── POST /periods/:id/calculate ───────────────────────────────────────────────
/**
 * Calculate commission for every eligible staff member in the period.
 *
 * Flow:
 *   1. Verify period is 'open' and belongs to tenant.
 *   2. Require period.clinic_revenue to be set (400 if NULL).
 *      clinicActualRevenue = period.clinic_revenue — it is entered manually from
 *      the PMS and represents TOTAL clinic revenue (TC deals + dentist work etc.).
 *      It is NEVER derived from treatment_deals.
 *   3. Load active commission scheme + tiers + thresholds.
 *   4. Load team bonus tiers for tenant.
 *   5. Load clinic revenue target overlapping the period → clinicTarget.
 *   6. Fetch eligible treatment_deals for the period:
 *        status IN ('accepted','in_progress','completed') AND NOT commission_locked.
 *        requireVerification (body, default true): when true, also filters by
 *        verification_status IN ('auto_matched','manually_approved') so only
 *        payment-verified deals count. Pass false for a dry-run preview.
 *   7. Group deals by assigned_staff_id → personalRevenue per TC (agreed_amount only).
 *      personalRevenue and clinicActualRevenue are INDEPENDENT sources:
 *      personalRevenue = TC's own agreed deal values from treatment_deals.
 *      clinicActualRevenue = total clinic revenue from period.clinic_revenue.
 *   8. Build engine input and call calculateCommission().
 *   9. UPSERT commission_records (period_id + staff_id UNIQUE).
 *      Stores reasoning in the notes column.
 *  10. Write commission_audit_log entries.
 *  11. Return per-staff results.
 *
 * If period status is 'locked', returns 409 — recalculation is not allowed.
 */
router.post('/periods/:id/calculate', async (req, res) => {
  if (!PERIOD_CALC_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });

  const client = await pool.connect();
  try {
    const tenantId = resolveTenant(req.user, req.body);

    // 1. Fetch and validate period
    const { rows: periodRows } = await client.query(
      `SELECT * FROM commission_periods WHERE id = $1`, [req.params.id],
    );
    if (!periodRows.length) return res.status(404).json({ error: 'Period not found' });
    const period = periodRows[0];
    assertTenant(period.tenant_id, tenantId);
    if (period.status === 'locked')
      return res.status(409).json({ error: 'Period is locked and cannot be recalculated' });

    // 2. clinicActualRevenue — manual override from period.clinic_revenue if set;
    // otherwise computed live from treatment_deals agreed_amount for this period.
    // The computed fallback is resolved after deal fetch (step 6) below.

    // 3. Load active commission scheme
    const { rows: schemeRows } = await client.query(
      `SELECT cs.*,
              (SELECT json_agg(t ORDER BY t.tier_order)
                 FROM commission_tiers t WHERE t.scheme_id = cs.id) AS tiers,
              (SELECT json_agg(p ORDER BY p.target_percent)
                 FROM commission_performance_thresholds p WHERE p.scheme_id = cs.id) AS thresholds
         FROM commission_schemes cs
        WHERE cs.tenant_id = $1 AND cs.is_active = TRUE
        LIMIT 1`,
      [tenantId],
    );
    if (!schemeRows.length)
      return res.status(422).json({ error: 'No active commission scheme found for this tenant' });
    const scheme = schemeRows[0];

    // 4. Load team bonus tiers for tenant
    const { rows: teamBonusTiers } = await client.query(
      `SELECT * FROM team_bonus_tiers WHERE tenant_id = $1 ORDER BY tier_order`, [tenantId],
    );

    // 5. Load clinic revenue target overlapping the period
    const { rows: targetRows } = await client.query(
      `SELECT * FROM clinic_revenue_targets
        WHERE tenant_id = $1
          AND period_start <= $2 AND period_end >= $3
        ORDER BY period_start DESC LIMIT 1`,
      [tenantId, period.period_end, period.period_start],
    );
    const clinicTarget = targetRows.length
      ? Number(targetRows[0].target_amount)
      : 0; // No target defined → attainment will be 0 (engine handles this)

    // 6. Fetch eligible treatment deals for the period.
    //
    // requireVerification (default true): when true, only deals with
    // verification_status IN ('auto_matched','manually_approved') are included.
    // Pass requireVerification=false to include all payment-status-eligible deals
    // regardless of payment verification (e.g. for a dry-run preview).
    const requireVerification = req.body.requireVerification !== false;

    const verificationClause = requireVerification
      ? `AND td.verification_status IN ('auto_matched', 'manually_approved')`
      : '';

    const { rows: deals } = await client.query(
      `SELECT td.*, u.first_name, u.last_name,
              u.is_active AS staff_active,
              r.name AS staff_role
         FROM treatment_deals td
         LEFT JOIN users u ON u.id = td.assigned_staff_id
         LEFT JOIN user_tenants ut ON ut.user_id = td.assigned_staff_id AND ut.tenant_id = td.tenant_id
         LEFT JOIN roles r ON r.id = ut.role_id
        WHERE td.tenant_id   = $1
          AND td.deal_date  >= $2
          AND td.deal_date  <= $3
          AND td.status     IN ('accepted', 'in_progress', 'completed')
          AND td.commission_locked = FALSE
          AND td.deleted_at IS NULL
          ${verificationClause}
        ORDER BY td.assigned_staff_id`,
      [tenantId, period.period_start, period.period_end],
    );

    // 7. Group deals by assigned staff → personalRevenue per TC.
    //
    // clinicActualRevenue drives attainment gates → must be TC-only quota revenue.
    // Manual override (period.clinic_revenue) takes precedence when set.
    const quotaComputedRevenue = deals
      .filter(d => d.staff_role === 'hasta_danismani')
      .reduce((sum, d) => sum + (Number(d.agreed_amount) || 0), 0);
    const totalComputedRevenue = deals.reduce((sum, d) => sum + (Number(d.agreed_amount) || 0), 0);
    const clinicActualRevenue = period.clinic_revenue != null
      ? Number(period.clinic_revenue)
      : quotaComputedRevenue;

    const staffMap = new Map(); // staffId → { personalRevenue, firstName, lastName, … }

    for (const deal of deals) {
      if (!deal.assigned_staff_id) continue; // unassigned — no TC to credit
      const rev = dealRevenue(deal); // agreed_amount only; NULL → 0
      if (!staffMap.has(deal.assigned_staff_id)) {
        staffMap.set(deal.assigned_staff_id, {
          staffId:                deal.assigned_staff_id,
          personalRevenue:        0,
          isEligibleForTeamBonus: true, // TODO (Tur 3c): read from users metadata
          isFullTime:             true, // TODO (Tur 3c): read from users metadata
          firstName:              deal.first_name,
          lastName:               deal.last_name,
        });
      }
      staffMap.get(deal.assigned_staff_id).personalRevenue += rev;
    }

    const staffInput = Array.from(staffMap.values());

    if (staffInput.length === 0) {
      return res.json({
        message: 'No eligible deals with assigned staff found for this period — no commission records created',
        records: [],
      });
    }

    // 7. Build engine input and calculate.
    //
    // tier_application comes from the scheme's OWN field (set when the scheme was
    // created). It is NEVER derived from scheme.type — 'type' and 'tier_application'
    // are independent: e.g. a 'tiered' type scheme can still use 'flat' application
    // (Dentafly style: whole-revenue single-rate per band, not progressive).
    const engineInput = {
      scheme:                { type: scheme.type, tier_application: scheme.tier_application },
      tiers:                 scheme.tiers   || [],
      performanceThresholds: scheme.thresholds || [],
      teamBonusTiers,
      clinicTarget,
      clinicActualRevenue,
      staff:                 staffInput,
      priorClawbacks:        [], // TODO (Tur 3b): load from prior disputed/adjusted records
    };

    const results = calculateCommission(engineInput);

    // 8 + 9. UPSERT commission_records + audit_log in a transaction
    await client.query('BEGIN');

    const upserted = [];
    for (const r of results) {
      // Fetch previous total (for audit delta)
      const { rows: existing } = await client.query(
        `SELECT id, total_commission FROM commission_records
          WHERE period_id = $1 AND staff_id = $2`,
        [period.id, r.staffId],
      );
      const prevTotal = existing.length ? Number(existing[0].total_commission) : null;
      const isNew     = existing.length === 0;
      const eventType = isNew ? 'created' : 'recalculated';

      // UPSERT — total_commission is GENERATED ALWAYS AS; must NOT be in column list
      const { rows: rec } = await client.query(
        `INSERT INTO commission_records
           (period_id, tenant_id, staff_id, scheme_id,
            total_revenue, target_revenue, target_attainment,
            base_commission, performance_bonus, team_bonus, adjustment_amount,
            status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12)
         ON CONFLICT (period_id, staff_id) DO UPDATE
           SET scheme_id         = EXCLUDED.scheme_id,
               total_revenue     = EXCLUDED.total_revenue,
               target_revenue    = EXCLUDED.target_revenue,
               target_attainment = EXCLUDED.target_attainment,
               base_commission   = EXCLUDED.base_commission,
               performance_bonus = EXCLUDED.performance_bonus,
               team_bonus        = EXCLUDED.team_bonus,
               adjustment_amount = EXCLUDED.adjustment_amount,
               notes             = EXCLUDED.notes,
               status            = CASE
                 WHEN commission_records.status = 'approved' THEN 'draft'  -- re-opened on recalc
                 ELSE commission_records.status
               END
         RETURNING *`,
        [period.id, tenantId, r.staffId, scheme.id,
          r.totalRevenue, clinicTarget || null, r.targetAttainment,
          r.baseCommission, r.performanceBonus, r.teamBonus, r.adjustmentAmount,
          r.reasoning],  // stored in notes
      );
      upserted.push(rec[0]);

      // Audit log entry
      await client.query(
        `INSERT INTO commission_audit_log
           (commission_record_id, tenant_id, event_type, changed_by,
            previous_total, new_total, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [rec[0].id, tenantId, eventType, req.user.sub,
          prevTotal, rec[0].total_commission,
          `${eventType === 'created' ? 'Initial calculation' : 'Recalculated'}. ${r.reasoning}`],
      );
    }

    await client.query('COMMIT');

    return res.json({
      periodId:              period.id,
      clinicActualRevenue,
      quotaComputedRevenue,
      totalComputedRevenue,
      isAutoRevenue:         period.clinic_revenue == null,
      clinicTarget,
      targetAttainment:      clinicTarget > 0 ? Math.round((clinicActualRevenue / clinicTarget) * 10000) / 100 : 0,
      staffProcessed:        upserted.length,
      records:               upserted,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return handleErr(res, 'POST /periods/:id/calculate', err);
  } finally {
    client.release();
  }
});

// ── POST /periods/:id/approve ─────────────────────────────────────────────────
/**
 * Lock the period (director or platform admin only).
 * Sets:
 *   commission_periods.status = 'locked', locked_at, locked_by
 *   commission_records.status = 'approved', approved_by, approved_at
 *   treatment_deals.commission_locked = TRUE  (for all deals in the period)
 * Writes audit log 'approved' for each record.
 */
router.post('/periods/:id/approve', async (req, res) => {
  if (!PERIOD_APPROVE_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'Only directors or platform admins can approve (lock) a commission period' });

  const client = await pool.connect();
  try {
    const tenantId = resolveTenant(req.user, req.body);

    const { rows: periodRows } = await client.query(
      `SELECT * FROM commission_periods WHERE id = $1`, [req.params.id],
    );
    if (!periodRows.length) return res.status(404).json({ error: 'Period not found' });
    const period = periodRows[0];
    assertTenant(period.tenant_id, tenantId);

    if (period.status === 'locked')
      return res.status(409).json({ error: 'Period is already locked' });

    // Require at least one commission record before locking
    const { rows: recCheck } = await client.query(
      `SELECT COUNT(*) AS cnt FROM commission_records WHERE period_id = $1`, [period.id],
    );
    if (Number(recCheck[0].cnt) === 0)
      return res.status(422).json({ error: 'No commission records found — run /calculate before approving' });

    await client.query('BEGIN');

    // Lock the period
    const { rows: updPeriod } = await client.query(
      `UPDATE commission_periods
          SET status = 'locked', locked_at = NOW(), locked_by = $1
        WHERE id = $2 RETURNING *`,
      [req.user.sub, period.id],
    );

    // Approve all draft/open records in this period
    const { rows: records } = await client.query(
      `UPDATE commission_records
          SET status = 'approved', approved_by = $1, approved_at = NOW()
        WHERE period_id = $2 AND status IN ('draft', 'disputed')
        RETURNING id, total_commission, staff_id`,
      [req.user.sub, period.id],
    );

    // Lock all contributing treatment deals
    await client.query(
      `UPDATE treatment_deals
          SET commission_locked = TRUE
        WHERE tenant_id  = $1
          AND deal_date >= $2
          AND deal_date <= $3
          AND status    IN ('accepted', 'in_progress', 'completed')`,
      [tenantId, period.period_start, period.period_end],
    );

    // Audit entries for each approved record
    for (const rec of records) {
      await client.query(
        `INSERT INTO commission_audit_log
           (commission_record_id, tenant_id, event_type, changed_by, new_total, note)
         VALUES ($1,$2,'approved',$3,$4,'Period locked and commission approved for payment')`,
        [rec.id, tenantId, req.user.sub, rec.total_commission],
      );
    }

    // Update period total
    const { rows: totalRow } = await client.query(
      `SELECT SUM(total_commission) AS grand_total FROM commission_records WHERE period_id = $1`,
      [period.id],
    );
    await client.query(
      `UPDATE commission_periods SET total_commission_paid = $1 WHERE id = $2`,
      [totalRow[0].grand_total || 0, period.id],
    );

    await client.query('COMMIT');

    return res.json({
      period:          updPeriod[0],
      approvedRecords: records.length,
      totalCommission: Number(totalRow[0].grand_total || 0),
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return handleErr(res, 'POST /periods/:id/approve', err);
  } finally {
    client.release();
  }
});

// ── POST /periods/:id/unlock ──────────────────────────────────────────────────
/**
 * Unlock (reopen) a locked commission period so corrections can be made.
 * Only director + platform admins (same as approve). clinic_admin cannot unlock.
 *
 * Reverses everything approve did — single transaction:
 *   commission_periods:  status='open', locked_at=NULL, locked_by=NULL,
 *                        total_commission_paid=NULL
 *   commission_records:  status='draft', approved_by=NULL, approved_at=NULL
 *                        (only records that were 'approved')
 *   treatment_deals:     commission_locked=FALSE  (same date-range filter as approve)
 *   commission_audit_log: one 'status_change' row per commission_record
 *
 * Returns 409 if the period is not currently locked.
 */
router.post('/periods/:id/unlock', async (req, res) => {
  if (!PERIOD_APPROVE_ROLES.includes(req.user.role))
    return res.status(403).json({ error: 'Only directors or platform admins can unlock a commission period' });

  const client = await pool.connect();
  try {
    const tenantId = resolveTenant(req.user, req.body);

    // 1. Fetch and validate period
    const { rows: periodRows } = await client.query(
      `SELECT * FROM commission_periods WHERE id = $1`,
      [req.params.id],
    );
    if (!periodRows.length) return res.status(404).json({ error: 'Period not found' });
    const period = periodRows[0];
    assertTenant(period.tenant_id, tenantId);

    if (period.status !== 'locked')
      return res.status(409).json({ error: 'Period is not locked' });

    await client.query('BEGIN');

    // 2. Reopen the period
    const { rows: updPeriod } = await client.query(
      `UPDATE commission_periods
          SET status               = 'open',
              locked_at            = NULL,
              locked_by            = NULL,
              total_commission_paid = NULL
        WHERE id = $1 RETURNING *`,
      [period.id],
    );

    // 3. Revert approved commission_records → draft
    //    Capture records before update so we can write audit log entries
    const { rows: approvedRecords } = await client.query(
      `UPDATE commission_records
          SET status      = 'draft',
              approved_by = NULL,
              approved_at = NULL
        WHERE period_id = $1
          AND status    = 'approved'
        RETURNING id, total_commission`,
      [period.id],
    );

    // 4. Unlock contributing treatment_deals (exact inverse of approve's filter)
    await client.query(
      `UPDATE treatment_deals
          SET commission_locked = FALSE
        WHERE tenant_id  = $1
          AND deal_date >= $2
          AND deal_date <= $3
          AND status    IN ('accepted', 'in_progress', 'completed')`,
      [tenantId, period.period_start, period.period_end],
    );

    // 5. Audit log — one 'status_change' row per reverted commission_record
    for (const rec of approvedRecords) {
      await client.query(
        `INSERT INTO commission_audit_log
           (commission_record_id, tenant_id, event_type, changed_by,
            previous_total, new_total, note)
         VALUES ($1, $2, 'status_change', $3, $4, $4,
                 'Period unlocked — commission reopened for correction')`,
        [rec.id, tenantId, req.user.sub, rec.total_commission],
      );
    }

    await client.query('COMMIT');

    return res.json({
      period:          updPeriod[0],
      reopenedRecords: approvedRecords.length,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return handleErr(res, 'POST /periods/:id/unlock', err);
  } finally {
    client.release();
  }
});

// ── GET /periods/:id/report (JSON) ────────────────────────────────────────────
router.get('/periods/:id/report', async (req, res) => {
  if (!PERIOD_CALC_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.query);
    const { rows: periodRows } = await pool.query(
      `SELECT cp.*,
              lb.first_name AS locked_by_first, lb.last_name AS locked_by_last,
              (SELECT COALESCE(SUM(td.agreed_amount), 0)::numeric
                 FROM treatment_deals td
                 LEFT JOIN user_tenants ut ON ut.user_id = td.assigned_staff_id AND ut.tenant_id = cp.tenant_id
                 LEFT JOIN roles r ON r.id = ut.role_id
                WHERE td.tenant_id = cp.tenant_id
                  AND td.deal_date >= cp.period_start
                  AND td.deal_date <= cp.period_end
                  AND td.status IN ('accepted','in_progress','completed')
                  AND td.verification_status != 'rejected'
                  AND td.deleted_at IS NULL
                  AND r.name = 'hasta_danismani') AS quota_revenue,
              (SELECT COALESCE(SUM(td.agreed_amount), 0)::numeric
                 FROM treatment_deals td
                WHERE td.tenant_id = cp.tenant_id
                  AND td.deal_date >= cp.period_start
                  AND td.deal_date <= cp.period_end
                  AND td.status IN ('accepted','in_progress','completed')
                  AND td.verification_status != 'rejected'
                  AND td.deleted_at IS NULL) AS total_revenue,
              COALESCE(cp.clinic_revenue,
                (SELECT COALESCE(SUM(td.agreed_amount), 0)::numeric
                   FROM treatment_deals td
                   LEFT JOIN user_tenants ut ON ut.user_id = td.assigned_staff_id AND ut.tenant_id = cp.tenant_id
                   LEFT JOIN roles r ON r.id = ut.role_id
                  WHERE td.tenant_id = cp.tenant_id
                    AND td.deal_date >= cp.period_start
                    AND td.deal_date <= cp.period_end
                    AND td.status IN ('accepted','in_progress','completed')
                    AND td.verification_status != 'rejected'
                    AND td.deleted_at IS NULL
                    AND r.name = 'hasta_danismani')) AS effective_quota_revenue,
              (SELECT crt.target_amount
                 FROM clinic_revenue_targets crt
                WHERE crt.tenant_id = cp.tenant_id
                  AND crt.period_start <= cp.period_end
                  AND crt.period_end   >= cp.period_start
                ORDER BY crt.period_start DESC
                LIMIT 1) AS target_amount
         FROM commission_periods cp
         LEFT JOIN users lb ON lb.id = cp.locked_by
        WHERE cp.id = $1`,
      [req.params.id],
    );
    if (!periodRows.length) return res.status(404).json({ error: 'Period not found' });
    assertTenant(periodRows[0].tenant_id, tenantId);

    const { rows: records } = await pool.query(
      `SELECT cr.*,
              u.first_name, u.last_name, u.email,
              ab.first_name AS approved_by_first, ab.last_name AS approved_by_last
         FROM commission_records cr
         JOIN users u ON u.id = cr.staff_id
         LEFT JOIN users ab ON ab.id = cr.approved_by
        WHERE cr.period_id = $1
        ORDER BY u.last_name, u.first_name`,
      [req.params.id],
    );

    return res.json({ period: periodRows[0], records });
  } catch (err) { return handleErr(res, 'GET /periods/:id/report', err); }
});

// ── GET /periods/:id/report.csv ───────────────────────────────────────────────
router.get('/periods/:id/report.csv', async (req, res) => {
  if (!PERIOD_CALC_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.query);
    const { rows: periodRows } = await pool.query(
      `SELECT * FROM commission_periods WHERE id = $1`, [req.params.id],
    );
    if (!periodRows.length) return res.status(404).json({ error: 'Period not found' });
    assertTenant(periodRows[0].tenant_id, tenantId);
    const period = periodRows[0];

    const { rows: records } = await pool.query(
      `SELECT cr.*, u.first_name, u.last_name, u.email
         FROM commission_records cr
         JOIN users u ON u.id = cr.staff_id
        WHERE cr.period_id = $1
        ORDER BY u.last_name, u.first_name`,
      [req.params.id],
    );

    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = [
      'Staff Name', 'Email', 'Personal Revenue (€)', 'Clinic Target (€)',
      'Attainment (%)', 'Base Commission (€)', 'Performance Bonus (€)',
      'Team Bonus (€)', 'Adjustment (€)', 'Total Commission (€)',
      'Status', 'Approved By', 'Notes',
    ];

    const lines = [headers.join(',')];
    for (const r of records) {
      lines.push([
        escape(`${r.first_name} ${r.last_name}`),
        escape(r.email),
        escape(r.total_revenue),
        escape(r.target_revenue),
        escape(r.target_attainment),
        escape(r.base_commission),
        escape(r.performance_bonus),
        escape(r.team_bonus),
        escape(r.adjustment_amount),
        escape(r.total_commission),
        escape(r.status),
        escape(r.approved_by || ''),
        escape(r.notes),
      ].join(','));
    }

    const filename = `commission-${period.period_label.replace(/\s+/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(lines.join('\r\n'));
  } catch (err) { return handleErr(res, 'GET /periods/:id/report.csv', err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: PAYMENT IMPORT & MATCHING
// ─────────────────────────────────────────────────────────────────────────────
//
// ── Schema mapping ────────────────────────────────────────────────────────────
// payment_records uses 015's original column names:
//   match_confidence  (NOT confidence_score)
//   treatment_deal_id (NOT matched_deal_id)
//
// paymentMatcher status → payment_records.match_status → treatment_deals.verification_status:
//   'auto_matched'  → 'matched'   → 'auto_matched'
//   'needs_review'  → 'partial'   → (stays 'unverified'; candidate stored in treatment_deal_id)
//   'unmatched'     → 'unmatched' → (no deal link)
//
// confirm-match: payment→'matched',   deal→'manually_approved'
// reject-match:  payment→'unmatched', deal→'unverified' (only if was 'matched')

// ── POST /payment-imports ─────────────────────────────────────────────────────
/**
 * Import a CSV of bank/PMS payments, run fuzzy matching against open deals,
 * and persist results.
 *
 * Body (JSON):
 *   csv           {string}  Raw CSV text.
 *   columnMapping {object}  Maps canonical field names to CSV column headers:
 *                             { patient_name, gross_amount, payment_date, external_ref? }
 *   source        {string}  '015 value: 'dentally'|'csv'|'manual'|'api'. Defaults to 'csv'.
 *   tenantId      {string}  Required for platform admins.
 *
 * Steps:
 *   1. Parse CSV → rows.
 *   2. Validate required column mappings.
 *   3. Write payment_imports row (status='processing').
 *   4. Write one payment_records row per CSV row (match_status='unmatched').
 *   5. Load treatment_deals with verification_status='unverified' as candidates.
 *   6. Call matchPayments() — pure, no DB.
 *   7. Update payment_records (match_status + match_confidence + treatment_deal_id).
 *      auto_matched deals → treatment_deals.verification_status = 'auto_matched'.
 *   8. Set payment_imports.status = 'complete'.
 *   9. Return summary.
 *
 * Roles: PAYMENT_MGR_ROLES only (no TC).
 */
router.post('/payment-imports', async (req, res) => {
  if (!PAYMENT_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });

  const client = await pool.connect();
  try {
    const tenantId = resolveTenant(req.user, req.body);
    const { csv, columnMapping } = req.body;
    const source = req.body.source || 'csv';

    if (!csv)           return res.status(400).json({ error: 'csv is required' });
    if (!columnMapping) return res.status(400).json({ error: 'columnMapping is required' });

    const VALID_SOURCES = ['dentally', 'csv', 'manual', 'api'];
    if (!VALID_SOURCES.includes(source))
      return res.status(400).json({ error: `source must be one of: ${VALID_SOURCES.join(', ')}` });

    // Validate required column mappings
    const REQUIRED_COLS = ['patient_name', 'gross_amount', 'payment_date'];
    const missing = REQUIRED_COLS.filter(k => !columnMapping[k]);
    if (missing.length)
      return res.status(400).json({ error: `columnMapping missing required fields: ${missing.join(', ')}` });

    // 1. Parse CSV
    let rawRows;
    try {
      rawRows = csvParse(csv, { columns: true, skip_empty_lines: true, trim: true });
    } catch (parseErr) {
      return res.status(400).json({ error: `CSV parse error: ${parseErr.message}` });
    }
    if (!rawRows.length)
      return res.status(400).json({ error: 'CSV contains no data rows' });

    await client.query('BEGIN');

    // 3. Create payment_imports row
    // imported_by is UUID FK → users(id); req.user.sub is the real users.id UUID
    const { rows: [importRec] } = await client.query(
      `INSERT INTO payment_imports (tenant_id, source, imported_by, row_count, status)
       VALUES ($1, $2, $3, $4, 'processing')
       RETURNING *`,
      [tenantId, source, req.user.sub, rawRows.length],
    );
    const importId = importRec.id;

    // 4. Insert payment_records (one per CSV row)
    // payment_date and gross_amount are NOT NULL in 015 — skip rows missing them.
    const paymentRecords = [];
    const skipped = [];
    for (const row of rawRows) {
      const patientName = row[columnMapping.patient_name] || null;
      const grossAmount = parseFloat(row[columnMapping.gross_amount]);
      const paymentDate = row[columnMapping.payment_date] || null;
      const externalRef = columnMapping.external_ref ? (row[columnMapping.external_ref] || null) : null;

      if (!grossAmount || !paymentDate) {
        skipped.push(row);
        continue; // skip rows that would violate NOT NULL constraints
      }

      const { rows: [pr] } = await client.query(
        `INSERT INTO payment_records
           (import_id, tenant_id, patient_name, gross_amount, payment_date, external_ref,
            match_status, match_confidence)
         VALUES ($1, $2, $3, $4, $5, $6, 'unmatched', 0)
         RETURNING *`,
        [importId, tenantId, patientName, grossAmount, paymentDate, externalRef],
      );
      paymentRecords.push(pr);
    }

    if (!paymentRecords.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'No valid rows to import — all rows were missing gross_amount or payment_date',
        skippedCount: skipped.length,
      });
    }

    // 5. Load unverified treatment_deals as matching candidates.
    // patient_name: td.patient_name is the primary source (set on POST /deals).
    // Fallback to leads name for legacy deals that pre-date this column.
    // LEFT JOIN so deals with no lead_id (walk-in patients) are included.
    const { rows: dealRows } = await client.query(
      `SELECT td.id,
              COALESCE(
                NULLIF(TRIM(COALESCE(td.patient_name, '')), ''),
                CONCAT(l.first_name, ' ', COALESCE(l.last_name, ''))
              ) AS patient_name,
              td.agreed_amount,
              td.deposit_amount,
              td.deal_date
         FROM treatment_deals td
         LEFT JOIN leads l ON l.id = td.lead_id
        WHERE td.tenant_id           = $1
          AND td.verification_status = 'unverified'
          AND td.commission_locked   = FALSE
          AND td.status             IN ('accepted', 'in_progress', 'completed')
          AND td.deleted_at IS NULL`,
      [tenantId],
    );

    // 6. Run fuzzy matching (pure — no DB calls)
    const matcherInput = paymentRecords.map(pr => ({
      id:           pr.id,
      patient_name: pr.patient_name,
      gross_amount: pr.gross_amount,
      payment_date: pr.payment_date,
    }));
    const matchResults = matchPayments({ payments: matcherInput, deals: dealRows });

    // 7. Write match results back to payment_records and treatment_deals.
    //
    // paymentMatcher status → payment_records.match_status:
    //   'auto_matched' → 'matched'   (deal also gets verification_status='auto_matched')
    //   'needs_review' → 'partial'   (candidate stored in treatment_deal_id; deal unchanged)
    //   'unmatched'    → 'unmatched' (treatment_deal_id stays NULL)
    let autoMatched = 0, needsReview = 0, unmatched = 0;

    for (const mr of matchResults) {
      let prMatchStatus;
      if      (mr.status === 'auto_matched') { prMatchStatus = 'matched';   autoMatched++; }
      else if (mr.status === 'needs_review') { prMatchStatus = 'partial';   needsReview++; }
      else                                   { prMatchStatus = 'unmatched'; unmatched++;   }

      await client.query(
        `UPDATE payment_records
            SET match_status     = $1,
                match_confidence = $2,
                treatment_deal_id = $3
          WHERE id = $4`,
        [prMatchStatus, mr.confidence, mr.matchedDealId, mr.paymentId],
      );

      // Auto-verified deal: write verification_status + back-link to this payment
      if (mr.status === 'auto_matched') {
        await client.query(
          `UPDATE treatment_deals
              SET verification_status = 'auto_matched',
                  matched_payment_id  = $3
            WHERE id = $1 AND tenant_id = $2`,
          [mr.matchedDealId, tenantId, mr.paymentId],
        );
      }
    }

    // 8. Mark import complete
    await client.query(
      `UPDATE payment_imports SET status = 'complete' WHERE id = $1`,
      [importId],
    );

    await client.query('COMMIT');

    return res.status(201).json({
      importId,
      rowCount:     paymentRecords.length,
      skippedCount: skipped.length,
      autoMatched,
      needsReview,
      unmatched,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return handleErr(res, 'POST /payment-imports', err);
  } finally {
    client.release();
  }
});

// ── POST /payment-imports/:id/match ──────────────────────────────────────────
/**
 * Re-run fuzzy matching for a completed import.
 * Only re-processes records with match_status IN ('unmatched','partial').
 * 'matched' records (auto or confirmed) are left untouched.
 */
router.post('/payment-imports/:id/match', async (req, res) => {
  if (!PAYMENT_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });

  const client = await pool.connect();
  try {
    const tenantId = resolveTenant(req.user, req.body);

    const { rows: [imp] } = await client.query(
      `SELECT * FROM payment_imports WHERE id = $1`, [req.params.id],
    );
    if (!imp) return res.status(404).json({ error: 'Payment import not found' });
    assertTenant(imp.tenant_id, tenantId);

    // Only re-process unresolved records ('unmatched' and 'partial')
    const { rows: prRows } = await client.query(
      `SELECT * FROM payment_records
        WHERE import_id   = $1
          AND match_status IN ('unmatched', 'partial')`,
      [imp.id],
    );
    if (!prRows.length)
      return res.json({ message: 'No unresolved payments to re-match', processed: 0 });

    // Load candidate deals (unverified only — already-verified deals are off-limits).
    // patient_name: td.patient_name primary, leads fallback for legacy records.
    // LEFT JOIN so deals without lead_id are included.
    const { rows: dealRows } = await client.query(
      `SELECT td.id,
              COALESCE(
                NULLIF(TRIM(COALESCE(td.patient_name, '')), ''),
                CONCAT(l.first_name, ' ', COALESCE(l.last_name, ''))
              ) AS patient_name,
              td.agreed_amount,
              td.deposit_amount,
              td.deal_date
         FROM treatment_deals td
         LEFT JOIN leads l ON l.id = td.lead_id
        WHERE td.tenant_id           = $1
          AND td.verification_status = 'unverified'
          AND td.commission_locked   = FALSE
          AND td.status             IN ('accepted', 'in_progress', 'completed')
          AND td.deleted_at IS NULL`,
      [tenantId],
    );

    const matcherInput = prRows.map(pr => ({
      id:           pr.id,
      patient_name: pr.patient_name,
      gross_amount: pr.gross_amount,
      payment_date: pr.payment_date,
    }));
    const matchResults = matchPayments({ payments: matcherInput, deals: dealRows });

    await client.query('BEGIN');

    let autoMatched = 0, needsReview = 0, unmatched = 0;

    for (const mr of matchResults) {
      let prMatchStatus;
      if      (mr.status === 'auto_matched') { prMatchStatus = 'matched';   autoMatched++; }
      else if (mr.status === 'needs_review') { prMatchStatus = 'partial';   needsReview++; }
      else                                   { prMatchStatus = 'unmatched'; unmatched++;   }

      await client.query(
        `UPDATE payment_records
            SET match_status      = $1,
                match_confidence  = $2,
                treatment_deal_id = $3
          WHERE id = $4`,
        [prMatchStatus, mr.confidence, mr.matchedDealId, mr.paymentId],
      );

      if (mr.status === 'auto_matched') {
        await client.query(
          `UPDATE treatment_deals
              SET verification_status = 'auto_matched',
                  matched_payment_id  = $3
            WHERE id = $1 AND tenant_id = $2`,
          [mr.matchedDealId, tenantId, mr.paymentId],
        );
      }
    }

    await client.query('COMMIT');

    return res.json({ importId: imp.id, processed: prRows.length, autoMatched, needsReview, unmatched });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return handleErr(res, 'POST /payment-imports/:id/match', err);
  } finally {
    client.release();
  }
});

// ── GET /payment-imports/:id/review-queue ─────────────────────────────────────
/**
 * Return payment_records with match_status='partial' (paymentMatcher said
 * 'needs_review') for this import, enriched with the candidate deal's data.
 * Director reviews these to confirm or reject.
 */
router.get('/payment-imports/:id/review-queue', async (req, res) => {
  if (!PAYMENT_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const tenantId = resolveTenant(req.user, req.query);

    const { rows: [imp] } = await pool.query(
      `SELECT * FROM payment_imports WHERE id = $1`, [req.params.id],
    );
    if (!imp) return res.status(404).json({ error: 'Payment import not found' });
    assertTenant(imp.tenant_id, tenantId);

    const { rows } = await pool.query(
      `SELECT pr.*,
              td.id                                                 AS deal_id,
              CONCAT(l.first_name, ' ', COALESCE(l.last_name, '')) AS deal_patient_name,
              td.agreed_amount                                      AS deal_agreed_amount,
              td.deal_date                                          AS deal_deal_date
         FROM payment_records pr
         LEFT JOIN treatment_deals td ON td.id = pr.treatment_deal_id
         LEFT JOIN leads l            ON l.id  = td.lead_id
        WHERE pr.import_id    = $1
          AND pr.match_status = 'partial'
        ORDER BY pr.match_confidence DESC`,
      [imp.id],
    );

    return res.json({ importId: imp.id, count: rows.length, items: rows });
  } catch (err) { return handleErr(res, 'GET /payment-imports/:id/review-queue', err); }
});

// ── POST /payments/:id/confirm-match ─────────────────────────────────────────
/**
 * Director confirms a payment↔deal match (from review queue or auto-match).
 *
 * Body: { dealId? }  — if provided, overrides the candidate treatment_deal_id.
 *                      If omitted, uses the existing treatment_deal_id.
 *
 * Sets:
 *   payment_records.match_status      = 'matched'
 *   payment_records.treatment_deal_id = dealId (or unchanged)
 *   treatment_deals.verification_status = 'manually_approved'
 *
 */
router.post('/payments/:id/confirm-match', async (req, res) => {
  if (!PAYMENT_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });

  const client = await pool.connect();
  try {
    const tenantId = resolveTenant(req.user, req.body);

    const { rows: [pr] } = await client.query(
      `SELECT * FROM payment_records WHERE id = $1`, [req.params.id],
    );
    if (!pr) return res.status(404).json({ error: 'Payment record not found' });
    assertTenant(pr.tenant_id, tenantId);

    // Use provided dealId or fall back to existing treatment_deal_id
    const dealId = req.body.dealId || pr.treatment_deal_id;
    if (!dealId)
      return res.status(400).json({ error: 'dealId is required — no existing candidate to confirm' });

    // Verify deal belongs to same tenant
    const { rows: [deal] } = await client.query(
      `SELECT id, tenant_id FROM treatment_deals WHERE id = $1`, [dealId],
    );
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    assertTenant(deal.tenant_id, tenantId);

    await client.query('BEGIN');

    const { rows: [updated] } = await client.query(
      `UPDATE payment_records
          SET match_status      = 'matched',
              treatment_deal_id = $1
        WHERE id = $2
        RETURNING *`,
      [dealId, pr.id],
    );

    await client.query(
      `UPDATE treatment_deals
          SET verification_status = 'manually_approved',
              matched_payment_id  = $3
        WHERE id = $1 AND tenant_id = $2`,
      [dealId, tenantId, pr.id],
    );

    await client.query('COMMIT');

    return res.json({ payment: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return handleErr(res, 'POST /payments/:id/confirm-match', err);
  } finally {
    client.release();
  }
});

// ── POST /payments/:id/reject-match ──────────────────────────────────────────
/**
 * Director rejects a payment↔deal match suggestion.
 *
 * Sets payment_records.match_status = 'unmatched' (NOT 'disputed') so the
 * payment re-enters the re-match pool and can be matched again.
 * 'disputed' is reserved for a future formal dispute workflow.
 *
 * If the payment was 'matched' (auto-matched) the deal's verification_status
 * is reset to 'unverified' so it can be paired with a different payment.
 * For 'partial' records, the deal is already 'unverified' — no deal update needed.
 *
 * Guard: 'unmatched' records have nothing to reject.
 */
router.post('/payments/:id/reject-match', async (req, res) => {
  if (!PAYMENT_MGR_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });

  const client = await pool.connect();
  try {
    const tenantId = resolveTenant(req.user, req.body);

    const { rows: [pr] } = await client.query(
      `SELECT * FROM payment_records WHERE id = $1`, [req.params.id],
    );
    if (!pr) return res.status(404).json({ error: 'Payment record not found' });
    assertTenant(pr.tenant_id, tenantId);

    if (pr.match_status === 'unmatched')
      return res.status(409).json({ error: 'Payment has no match to reject' });

    await client.query('BEGIN');

    // If the payment was auto-matched ('matched') the deal was promoted to
    // 'auto_matched'. Reset it so it can be paired with a different payment.
    // ('partial' records have treatment_deal_id as a candidate but the deal
    // is still 'unverified' — no deal update needed.)
    if (pr.match_status === 'matched' && pr.treatment_deal_id) {
      await client.query(
        `UPDATE treatment_deals
            SET verification_status = 'unverified',
                matched_payment_id  = NULL
          WHERE id = $1 AND tenant_id = $2`,
        [pr.treatment_deal_id, tenantId],
      );
    }

    const { rows: [updated] } = await client.query(
      `UPDATE payment_records
          SET match_status      = 'unmatched',
              treatment_deal_id = NULL,
              match_confidence  = 0
        WHERE id = $1
        RETURNING *`,
      [pr.id],
    );

    await client.query('COMMIT');

    return res.json({ payment: updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return handleErr(res, 'POST /payments/:id/reject-match', err);
  } finally {
    client.release();
  }
});

// ── GET /my-estimate ──────────────────────────────────────────────────────────
/**
 * Read-only estimated commission for the currently authenticated user.
 * Runs the full calculation engine for the caller's own deals — NO DB writes.
 *
 * Query params:
 *   ?periodId=<uuid>          — use a specific period (optional)
 *   ?includeUnverified=true   — include payment-unverified deals (default: false)
 *
 * If periodId is omitted the most-recent 'open' period for the tenant is used.
 * Returns 200 with { activePeriod: false } when no open period exists.
 *
 * Clinic revenue unknown → engine is called with clinicActualRevenue = clinicTarget
 * (simulates 100 % attainment so the performance multiplier fires). When
 * clinicTarget is also 0 the engine runs with 0 and the performance component
 * will be 0 as well ("raw tier estimate"). estimationNote explains what was done.
 *
 * Shares steps 3-8 of POST /periods/:id/calculate; skips all writes (no BEGIN,
 * no INSERT into commission_records or commission_audit_log).
 */
router.get('/my-estimate', async (req, res) => {
  // Any authenticated tenant user may fetch their own estimate.
  // Platform admins (tenantId = null) cannot — they have no personal deals.
  if (!req.user.tenantId) {
    return res.status(403).json({
      error: 'Platform admins do not have personal commission estimates. Select a clinic first.',
    });
  }

  try {
    const tenantId  = req.user.tenantId;
    const staffId   = req.user.sub;
    const inclUnver = req.query.includeUnverified === 'true';

    // ── 1. Resolve period ──────────────────────────────────────────────────────
    let period;
    if (req.query.periodId) {
      const { rows } = await pool.query(
        `SELECT * FROM commission_periods WHERE id = $1`,
        [req.query.periodId],
      );
      if (!rows.length) return res.status(404).json({ error: 'Period not found' });
      assertTenant(rows[0].tenant_id, tenantId);
      period = rows[0];
    } else {
      // Most recent open period for this tenant
      const { rows } = await pool.query(
        `SELECT * FROM commission_periods
          WHERE tenant_id = $1 AND status = 'open'
          ORDER BY period_start DESC LIMIT 1`,
        [tenantId],
      );
      if (!rows.length) {
        return res.json({ activePeriod: false, message: 'No open period found for this tenant.' });
      }
      period = rows[0];
    }

    // ── 2. Clinic revenue (may be null — handled below) ────────────────────────
    const clinicRevenueKnown = period.clinic_revenue !== null && period.clinic_revenue !== undefined;

    // ── 3. Active commission scheme + tiers + thresholds ──────────────────────
    const { rows: schemeRows } = await pool.query(
      `SELECT cs.*,
              (SELECT json_agg(t ORDER BY t.tier_order)
                 FROM commission_tiers t WHERE t.scheme_id = cs.id) AS tiers,
              (SELECT json_agg(p ORDER BY p.target_percent)
                 FROM commission_performance_thresholds p WHERE p.scheme_id = cs.id) AS thresholds
         FROM commission_schemes cs
        WHERE cs.tenant_id = $1 AND cs.is_active = TRUE
        LIMIT 1`,
      [tenantId],
    );
    if (!schemeRows.length)
      return res.status(422).json({ error: 'No active commission scheme found for this tenant' });
    const scheme = schemeRows[0];

    // ── 4. Team bonus tiers ────────────────────────────────────────────────────
    const { rows: teamBonusTiers } = await pool.query(
      `SELECT * FROM team_bonus_tiers WHERE tenant_id = $1 ORDER BY tier_order`,
      [tenantId],
    );

    // ── 5. Clinic revenue target overlapping the period ────────────────────────
    const { rows: targetRows } = await pool.query(
      `SELECT * FROM clinic_revenue_targets
        WHERE tenant_id  = $1
          AND period_start <= $2 AND period_end >= $3
        ORDER BY period_start DESC LIMIT 1`,
      [tenantId, period.period_end, period.period_start],
    );
    const clinicTarget = targetRows.length ? Number(targetRows[0].target_amount) : 0;

    // Determine effective clinic revenue for the engine:
    //   - Known: use the real figure.
    //   - Unknown: fall back to clinicTarget (= 100 % attainment simulation).
    //     If clinicTarget is also 0 the engine receives 0 → performance = 0 ("raw" estimate).
    const clinicActualRevenue = clinicRevenueKnown
      ? Number(period.clinic_revenue)
      : clinicTarget;  // 100 % attainment assumption when target is set

    let estimationNote = null;
    if (!clinicRevenueKnown) {
      estimationNote = clinicTarget > 0
        ? 'Clinic revenue not yet entered — performance multiplier and team bonus are estimated assuming the clinic meets 100% of its target.'
        : 'Clinic revenue and target are both unknown — performance multiplier and team bonus both show as €0 (raw tier estimate only).';
    }

    // ── 6. Fetch this user's eligible deals for the period ────────────────────
    // Same SQL filter as calculate, narrowed to assigned_staff_id = caller.
    // includeUnverified=false (default): only auto_matched or manually_approved.
    // includeUnverified=true: all eligible deals regardless of verification.
    const verificationClause = inclUnver
      ? ''
      : `AND td.verification_status IN ('auto_matched', 'manually_approved')`;

    const { rows: myDeals } = await pool.query(
      `SELECT td.*
         FROM treatment_deals td
        WHERE td.tenant_id          = $1
          AND td.assigned_staff_id  = $2
          AND td.deal_date         >= $3
          AND td.deal_date         <= $4
          AND td.status            IN ('accepted', 'in_progress', 'completed')
          AND td.commission_locked  = FALSE
          AND td.deleted_at IS NULL
          ${verificationClause}`,
      [tenantId, staffId, period.period_start, period.period_end],
    );

    // Count unverified deals (always, regardless of includeUnverified flag)
    const { rows: unverifRows } = await pool.query(
      `SELECT COUNT(*) AS cnt
         FROM treatment_deals
        WHERE tenant_id         = $1
          AND assigned_staff_id = $2
          AND deal_date        >= $3
          AND deal_date        <= $4
          AND status           IN ('accepted', 'in_progress', 'completed')
          AND commission_locked = FALSE
          AND verification_status = 'unverified'
          AND deleted_at IS NULL`,
      [tenantId, staffId, period.period_start, period.period_end],
    );
    const unverifiedDealCount = Number(unverifRows[0].cnt);

    // ── 7. Build staff input for a single member (the caller) ─────────────────
    const personalRevenue = myDeals.reduce((sum, d) => sum + dealRevenue(d), 0);

    const staffInput = [{
      staffId,
      personalRevenue,
      isEligibleForTeamBonus: true, // TODO (Tur 4c): read from user metadata
      isFullTime:             true, // TODO (Tur 4c): read from user metadata
    }];

    // ── 8. Run engine — NO DB writes whatsoever ────────────────────────────────
    const engineInput = {
      scheme:                { type: scheme.type, tier_application: scheme.tier_application },
      tiers:                 scheme.tiers   || [],
      performanceThresholds: scheme.thresholds || [],
      teamBonusTiers,
      clinicTarget,
      clinicActualRevenue,
      staff:                 staffInput,
      priorClawbacks:        [],
    };

    const [result] = calculateCommission(engineInput);
    // result: { staffId, totalRevenue, targetAttainment, baseCommission,
    //           performanceBonus, teamBonus, adjustmentAmount, totalCommission, reasoning }

    return res.json({
      activePeriod:       true,
      periodId:           period.id,
      periodLabel:        period.period_label,
      periodStart:        period.period_start,
      periodEnd:          period.period_end,
      periodStatus:       period.status,
      // Transparency flags
      clinicRevenueKnown,
      estimationNote,
      includeUnverified:  inclUnver,
      verifiedDealCount:  myDeals.length,
      unverifiedDealCount,
      // Commission breakdown (mirrors commission_records columns)
      totalRevenue:       result.totalRevenue,
      targetAttainment:   result.targetAttainment,
      baseCommission:     result.baseCommission,
      performanceBonus:   result.performanceBonus,
      teamBonus:          result.teamBonus,
      adjustmentAmount:   result.adjustmentAmount,
      totalCommission:    result.totalCommission,
      reasoning:          result.reasoning,
    });
  } catch (err) {
    return handleErr(res, 'GET /my-estimate', err);
  }
});

module.exports = router;

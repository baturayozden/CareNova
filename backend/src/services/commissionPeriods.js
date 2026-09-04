'use strict';
/**
 * commissionPeriods.js
 *
 * Idempotent helper that guarantees the current calendar month has an open
 * commission_period + clinic_revenue_target for a given tenant.
 *
 * Two call sites:
 *   1. Lazy — GET /periods calls ensureCurrentPeriod(tenantId) before returning.
 *   2. Cron — POST /api/cron/reminders calls ensureAllCurrentPeriods() for every
 *      tenant that has at least one active commission scheme.
 *
 * Both paths are safe to call concurrently — the INSERT uses ON CONFLICT DO NOTHING
 * so duplicate attempts silently no-op.
 */

const { pool } = require('../db/index');

/**
 * Returns { year, month, periodStart, periodEnd, periodLabel } for the current UTC month.
 * All dates are ISO strings (no JS Date timezone arithmetic leaking into the result).
 */
function currentMonthDates() {
  const now   = new Date();
  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12

  const mm = String(month).padStart(2, '0');
  const periodStart = `${year}-${mm}-01`;

  // Last day: first day of NEXT month minus 1 day (safe for any month length).
  const nextYear  = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const lastDayTs = Date.UTC(nextYear, nextMonth - 1, 1) - 86400000;
  const last      = new Date(lastDayTs);
  const periodEnd = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, '0')}-${String(last.getUTCDate()).padStart(2, '0')}`;

  const periodLabel = `${now.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${year}`;

  return { year, month, periodStart, periodEnd, periodLabel };
}

/**
 * Ensure the current calendar month has an open period + revenue target for
 * the given tenant.  Safe to call multiple times — idempotent.
 *
 * @returns {{ created: boolean, periodId: string|null }}
 */
async function ensureCurrentPeriod(tenantId) {
  const { periodStart, periodEnd, periodLabel } = currentMonthDates();

  // Fast path: period already exists — nothing to do.
  const { rows: existing } = await pool.query(
    `SELECT id FROM commission_periods WHERE tenant_id = $1 AND period_start = $2`,
    [tenantId, periodStart],
  );
  if (existing.length > 0) return { created: false, periodId: existing[0].id };

  // Inherit target_amount from the most recent previous monthly target.
  // Falls back to 300 000 GBP if none exists.
  const { rows: prevTarget } = await pool.query(
    `SELECT target_amount FROM clinic_revenue_targets
      WHERE tenant_id = $1 AND target_type = 'monthly'
      ORDER BY period_start DESC LIMIT 1`,
    [tenantId],
  );
  const targetAmount = prevTarget[0]?.target_amount ?? 300000;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ON CONFLICT DO NOTHING handles concurrent calls gracefully.
    const { rows: [period] } = await client.query(
      `INSERT INTO commission_periods (tenant_id, period_start, period_end, period_label, status)
       VALUES ($1, $2, $3, $4, 'open')
       ON CONFLICT (tenant_id, period_start) DO NOTHING
       RETURNING id`,
      [tenantId, periodStart, periodEnd, periodLabel],
    );

    if (period) {
      await client.query(
        `INSERT INTO clinic_revenue_targets
           (tenant_id, period_start, period_end, target_type, target_amount, currency)
         VALUES ($1, $2, $3, 'monthly', $4, 'GBP')
         ON CONFLICT (tenant_id, period_start, target_type) DO NOTHING`,
        [tenantId, periodStart, periodEnd, targetAmount],
      );
      console.log(`[CommissionPeriods] Created period "${periodLabel}" for tenant ${tenantId} (target=${targetAmount})`);
    }

    await client.query('COMMIT');
    return { created: !!period, periodId: period?.id ?? null };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run ensureCurrentPeriod for every tenant that has at least one active
 * commission scheme.  Used by the cron endpoint.
 *
 * @returns {Array<{ tenant_id, created, periodId, error? }>}
 */
async function ensureAllCurrentPeriods() {
  const { rows: tenants } = await pool.query(
    `SELECT DISTINCT tenant_id FROM commission_schemes WHERE is_active = TRUE`,
  );

  const results = [];
  for (const { tenant_id } of tenants) {
    try {
      const r = await ensureCurrentPeriod(tenant_id);
      results.push({ tenant_id, ...r });
    } catch (err) {
      console.error(`[CommissionPeriods] failed for tenant ${tenant_id}:`, err.message);
      results.push({ tenant_id, error: err.message });
    }
  }
  return results;
}

module.exports = { ensureCurrentPeriod, ensureAllCurrentPeriods };

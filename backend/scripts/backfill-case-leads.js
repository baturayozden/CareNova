'use strict';
/**
 * Backfill: create missing leads for payment cases where lead_id IS NULL.
 *
 * Run from backend/ directory:
 *   node scripts/backfill-case-leads.js          ← dry-run (SELECT only)
 *   node scripts/backfill-case-leads.js --apply  ← apply changes
 *
 * Each NULL-lead case gets its own lead — NO merging across cases (different
 * patient risk). Linked treatment_deals also get lead_id filled in.
 */

require('dotenv').config();
const { Pool } = require('pg');
const { splitName, leadStatusFromCase } = require('../src/services/caseStore');

const APPLY = process.argv.includes('--apply');
const pool  = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const { rows: cases } = await pool.query(`
    SELECT id, tenant_id, patient_name, patient_phone, patient_email, status, assigned_to, created_at
    FROM treatment_cases
    WHERE lead_id IS NULL AND deleted_at IS NULL
    ORDER BY created_at DESC
  `);

  console.log(`\nCases with lead_id IS NULL: ${cases.length}`);
  if (cases.length === 0) { console.log('Nothing to do.'); await pool.end(); return; }

  console.log('\nSample (up to 10):');
  cases.slice(0, 10).forEach(c =>
    console.log(`  [${c.id}] "${c.patient_name}" phone=${c.patient_phone || '—'} status=${c.status} tenant=${c.tenant_id}`)
  );

  if (!APPLY) {
    console.log('\n--- DRY RUN — pass --apply to execute ---');
    console.log(`Would create ${cases.length} lead(s) and backfill case + deal lead_id.`);
    await pool.end();
    return;
  }

  console.log('\n--- APPLYING ---');
  let created = 0; let failed = 0; let dealsUpdated = 0;

  for (const c of cases) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { firstName, lastName } = splitName(c.patient_name);
      const leadStatus = leadStatusFromCase(c.status);

      const { rows: [lead] } = await client.query(
        `INSERT INTO leads
           (tenant_id, first_name, last_name, phone, email, source, status,
            ai_follow_up_enabled, ai_follow_up_count, gdpr_consent_given, assigned_to)
         VALUES ($1,$2,$3,$4,$5,'payment_case',$6,FALSE,0,FALSE,$7)
         RETURNING id`,
        [
          c.tenant_id, firstName, lastName,
          c.patient_phone || null, c.patient_email || null,
          leadStatus, c.assigned_to || null,
        ],
      );

      await client.query(
        `UPDATE treatment_cases SET lead_id = $1 WHERE id = $2`,
        [lead.id, c.id],
      );

      // Update linked deals that also have lead_id NULL.
      const { rowCount } = await client.query(
        `UPDATE treatment_deals SET lead_id = $1
         WHERE case_id = $2 AND lead_id IS NULL AND deleted_at IS NULL`,
        [lead.id, c.id],
      );
      dealsUpdated += rowCount;

      await client.query('COMMIT');
      console.log(`  ✅ case ${c.id} → lead ${lead.id} ("${firstName} ${lastName}")`);
      created++;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`  ❌ case ${c.id}: ${err.message}`);
      failed++;
    } finally {
      client.release();
    }
  }

  console.log(`\nDone. Leads created: ${created}, deals backfilled: ${dealsUpdated}, errors: ${failed}`);
  await pool.end();
})();

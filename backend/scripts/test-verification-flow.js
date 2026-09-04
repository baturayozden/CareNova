'use strict';
/**
 * Integration test: verification flow for syncDealStatusFromCase.
 * Uses PRODUCTION DB — creates clearly-marked test rows, hard-deletes them on exit.
 *
 * Run: node backend/scripts/test-verification-flow.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Pool } = require('pg');
const caseStore = require('../src/services/caseStore');

const TENANT_ID  = '682ba358-434a-4126-a558-90d2ead67979'; // Vestadent
const OSCAR_ID   = '45cff650-3746-4553-bcd9-f2e10ffb1a54';
const TS         = Date.now();
const TEST_NAME  = `ZZTEST_VERIFY_${TS}`;
const TEST_PHONE = `+44999${String(Math.floor(Math.random() * 9000000) + 1000000)}`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

let pass = 0;
let fail = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ ${label}: ${actual}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}: expected "${expected}", got "${actual}"`);
    fail++;
  }
}

function assertTruthy(label, val) {
  if (val) {
    console.log(`  ✅ ${label}: ${JSON.stringify(val)}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}: expected truthy, got ${JSON.stringify(val)}`);
    fail++;
  }
}

// IDs to clean up (collected throughout the test)
const cleanupIds = { leadIds: [], caseIds: [], dealIds: [], auditIds: [] };

async function baseline(pool) {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM leads            WHERE tenant_id = $1) AS leads,
      (SELECT COUNT(*) FROM treatment_cases  WHERE tenant_id = $1) AS cases,
      (SELECT COUNT(*) FROM treatment_deals  WHERE tenant_id = $1) AS deals
  `, [TENANT_ID]);
  return rows[0];
}

async function run() {
  // ── ADIM 0: baseline ─────────────────────────────────────────────────────────
  console.log('\n── ADIM 0: Baseline count ──');
  const before = await baseline(pool);
  console.log(`  leads=${before.leads}, cases=${before.cases}, deals=${before.deals}`);

  // ── ADIM 1: create test lead + case + deal ────────────────────────────────────
  console.log('\n── ADIM 1: Create test lead + case + deal ──');

  // Find a clinic_admin in the tenant (for ADIM 3)
  const { rows: adminRows } = await pool.query(`
    SELECT ut.user_id FROM user_tenants ut
    JOIN roles r ON r.id = ut.role_id
    WHERE ut.tenant_id = $1 AND r.name = 'clinic_admin' LIMIT 1
  `, [TENANT_ID]);
  const ADMIN_ID = adminRows[0]?.user_id || OSCAR_ID;
  console.log(`  Using admin_id: ${ADMIN_ID}`);

  // Insert test lead
  const { rows: [lead] } = await pool.query(`
    INSERT INTO leads (tenant_id, first_name, last_name, phone, source, ai_follow_up_enabled, gdpr_consent_given)
    VALUES ($1, $2, 'TestPatient', $3, 'test', false, false)
    RETURNING id
  `, [TENANT_ID, TEST_NAME, TEST_PHONE]);
  cleanupIds.leadIds.push(lead.id);
  console.log(`  Created lead id=${lead.id}`);

  // Create case via caseStore (tests createCase code path)
  const testCase = await caseStore.createCase(TENANT_ID, {
    leadId:               lead.id,
    patientName:          TEST_NAME,
    treatmentDescription: 'Test verification flow',
    totalCost:            1000,
    amountDue:            1000,
    paymentMethod:        'bank_transfer',
    status:               'draft',
    createdBy:            OSCAR_ID,
    assignedTo:           OSCAR_ID,
  });
  cleanupIds.caseIds.push(testCase.id);
  console.log(`  Created case id=${testCase.id}, status=${testCase.status}`);

  // Insert test deal linked to that case
  const { rows: [deal1] } = await pool.query(`
    INSERT INTO treatment_deals
      (tenant_id, lead_id, assigned_staff_id, patient_name, treatment_category, agreed_amount,
       deal_date, status, case_id)
    VALUES ($1, $2, $3, $4, 'Test Category', 1000, NOW()::date, 'quoted', $5)
    RETURNING *
  `, [TENANT_ID, lead.id, OSCAR_ID, TEST_NAME, testCase.id]);
  cleanupIds.dealIds.push(deal1.id);
  console.log(`  Created deal id=${deal1.id}, status=${deal1.status}`);

  assert('ADIM 1: deal.status', deal1.status, 'quoted');
  assert('ADIM 1: deal.verification_status', deal1.verification_status, 'unverified');

  // ── ADIM 2: TC changes case to 'signed' ──────────────────────────────────────
  console.log('\n── ADIM 2: TC → signed (should be unverified) ──');
  const count2 = await caseStore.syncDealStatusFromCase(
    testCase.id, 'signed',
    { actorId: OSCAR_ID, actorRole: 'treatment_coordinator', tenantId: TENANT_ID },
  );
  const { rows: [deal2] } = await pool.query(
    `SELECT status, verification_status FROM treatment_deals WHERE id = $1`, [deal1.id],
  );
  assertTruthy('ADIM 2: rows updated', count2 >= 1);
  assert('ADIM 2: deal.status', deal2.status, 'accepted');
  assert('ADIM 2: deal.verification_status', deal2.verification_status, 'unverified');

  // ── ADIM 3: Admin changes case to 'paid' → manually_approved ─────────────────
  console.log('\n── ADIM 3: Admin → paid (should be manually_approved) ──');
  const count3 = await caseStore.syncDealStatusFromCase(
    testCase.id, 'paid',
    { actorId: ADMIN_ID, actorRole: 'clinic_admin', tenantId: TENANT_ID },
  );
  const { rows: [deal3] } = await pool.query(
    `SELECT status, verification_status FROM treatment_deals WHERE id = $1`, [deal1.id],
  );
  assertTruthy('ADIM 3: rows updated', count3 >= 1);
  assert('ADIM 3: deal.status', deal3.status, 'completed');
  assert('ADIM 3: deal.verification_status', deal3.verification_status, 'manually_approved');

  // ── ADIM 4: Webhook scenario (second case + deal) ────────────────────────────
  console.log('\n── ADIM 4: Webhook (null actorRole) → auto_matched ──');

  const { rows: [lead2] } = await pool.query(`
    INSERT INTO leads (tenant_id, first_name, last_name, phone, source, ai_follow_up_enabled, gdpr_consent_given)
    VALUES ($1, $2, 'TestPatient2', $3, 'test', false, false)
    RETURNING id
  `, [TENANT_ID, TEST_NAME + '_2', TEST_PHONE + '2']);
  cleanupIds.leadIds.push(lead2.id);

  const testCase2 = await caseStore.createCase(TENANT_ID, {
    leadId:               lead2.id,
    patientName:          TEST_NAME + '_2',
    treatmentDescription: 'Test verification flow webhook',
    totalCost:            500,
    amountDue:            500,
    paymentMethod:        'bank_transfer',
    status:               'payment_sent',
    createdBy:            OSCAR_ID,
    assignedTo:           OSCAR_ID,
  });
  cleanupIds.caseIds.push(testCase2.id);

  const { rows: [deal4] } = await pool.query(`
    INSERT INTO treatment_deals
      (tenant_id, lead_id, assigned_staff_id, patient_name, treatment_category, agreed_amount,
       deal_date, status, case_id)
    VALUES ($1, $2, $3, $4, 'Test Category', 500, NOW()::date, 'accepted', $5)
    RETURNING *
  `, [TENANT_ID, lead2.id, OSCAR_ID, TEST_NAME + '_2', testCase2.id]);
  cleanupIds.dealIds.push(deal4.id);

  const count4 = await caseStore.syncDealStatusFromCase(
    testCase2.id, 'paid',
    { actorId: null, actorRole: null, tenantId: TENANT_ID },
  );
  const { rows: [deal4After] } = await pool.query(
    `SELECT status, verification_status FROM treatment_deals WHERE id = $1`, [deal4.id],
  );
  assertTruthy('ADIM 4: rows updated', count4 >= 1);
  assert('ADIM 4: deal.status', deal4After.status, 'completed');
  assert('ADIM 4: deal.verification_status', deal4After.verification_status, 'auto_matched');

  // ── ADIM 5: Audit log (migration 052 proof) ───────────────────────────────────
  console.log('\n── ADIM 5: Audit log entries exist, commission_record_id nullable ──');
  const { rows: auditRows } = await pool.query(`
    SELECT id, commission_record_id, metadata FROM commission_audit_log
    WHERE metadata->>'deal_id' IN ($1, $2)
    ORDER BY created_at DESC
  `, [deal1.id, deal4.id]);
  auditRows.forEach(r => cleanupIds.auditIds.push(r.id));
  assertTruthy('ADIM 5: audit rows found', auditRows.length > 0);
  const nullableOk = auditRows.every(r => r.commission_record_id === null);
  assert('ADIM 5: commission_record_id is NULL (migration 052)', String(nullableOk), 'true');
  const hasDealId = auditRows.some(r => r.metadata?.deal_id === deal1.id || r.metadata?.deal_id === deal4.id);
  assert('ADIM 5: metadata contains deal_id', String(hasDealId), 'true');
  console.log(`  Audit rows found: ${auditRows.length}`);
  if (auditRows[0]) console.log(`  Sample metadata: ${JSON.stringify(auditRows[0].metadata)}`);

  // ── ADIM 6: Quota filter (rejected excluded, approved included) ───────────────
  console.log('\n── ADIM 6: Quota filter — rejected excluded, manually_approved included ──');

  // Reset deal1 to 'accepted' + 'manually_approved' for clean quota test
  await pool.query(`
    UPDATE treatment_deals
    SET status = 'accepted', verification_status = 'rejected', updated_at = NOW()
    WHERE id = $1
  `, [deal1.id]);

  const quotaQuery = `
    SELECT COALESCE(SUM(td.agreed_amount), 0)::numeric AS quota_sum
    FROM treatment_deals td
    WHERE td.tenant_id = $1
      AND td.id = $2
      AND td.status IN ('accepted','in_progress','completed')
      AND td.verification_status != 'rejected'
      AND td.deleted_at IS NULL
  `;

  const { rows: [rejRow] } = await pool.query(quotaQuery, [TENANT_ID, deal1.id]);
  assert('ADIM 6: rejected deal excluded from quota (sum=0)', String(Number(rejRow.quota_sum)), '0');

  await pool.query(`
    UPDATE treatment_deals
    SET verification_status = 'manually_approved', updated_at = NOW()
    WHERE id = $1
  `, [deal1.id]);

  const { rows: [appRow] } = await pool.query(quotaQuery, [TENANT_ID, deal1.id]);
  assert('ADIM 6: manually_approved deal included in quota (sum=1000)', String(Number(appRow.quota_sum)), '1000');
}

async function cleanup() {
  console.log('\n── ADIM 7: Cleanup ──');
  try {
    if (cleanupIds.auditIds.length) {
      await pool.query(`DELETE FROM commission_audit_log WHERE id = ANY($1)`, [cleanupIds.auditIds]);
      console.log(`  Deleted ${cleanupIds.auditIds.length} audit log rows`);
    }
    if (cleanupIds.dealIds.length) {
      await pool.query(`DELETE FROM treatment_deals WHERE id = ANY($1)`, [cleanupIds.dealIds]);
      console.log(`  Deleted ${cleanupIds.dealIds.length} deals`);
    }
    if (cleanupIds.caseIds.length) {
      await pool.query(`DELETE FROM treatment_cases WHERE id = ANY($1)`, [cleanupIds.caseIds]);
      console.log(`  Deleted ${cleanupIds.caseIds.length} cases`);
    }
    if (cleanupIds.leadIds.length) {
      await pool.query(`DELETE FROM leads WHERE id = ANY($1)`, [cleanupIds.leadIds]);
      console.log(`  Deleted ${cleanupIds.leadIds.length} leads`);
    }

    const after = await baseline(pool);
    const leadsOk = after.leads === (await pool.query(`SELECT COUNT(*) AS c FROM leads WHERE tenant_id=$1`, [TENANT_ID])).rows[0].c;
    // Compare with stored baseline (passed via closure via global)
    console.log(`  Post-cleanup: leads=${after.leads}, cases=${after.cases}, deals=${after.deals}`);
    console.log('  CLEANUP OK — baseline comparison logged above (re-run ADIM 0 diff in summary)');
  } catch (err) {
    console.error('  ❌ CLEANUP ERROR:', err.message);
    console.error('  Manual cleanup needed for IDs:', JSON.stringify(cleanupIds));
  }
}

let beforeBaseline;

(async () => {
  try {
    beforeBaseline = await baseline(pool);
    await run();
  } catch (err) {
    console.error('\n❌ UNEXPECTED ERROR:', err.message);
    console.error(err.stack);
    fail++;
  } finally {
    await cleanup();

    // Final baseline comparison
    const after = await baseline(pool);
    console.log('\n── SUMMARY ──');
    const baselineMatch =
      after.leads === beforeBaseline.leads &&
      after.cases === beforeBaseline.cases &&
      after.deals === beforeBaseline.deals;
    if (baselineMatch) {
      console.log('✅ CLEANUP OK — baseline eşleşti');
    } else {
      console.log(`❌ BASELINE MISMATCH!`);
      console.log(`  Before: leads=${beforeBaseline.leads}, cases=${beforeBaseline.cases}, deals=${beforeBaseline.deals}`);
      console.log(`  After:  leads=${after.leads}, cases=${after.cases}, deals=${after.deals}`);
      console.log('  Manual cleanup needed for IDs:', JSON.stringify(cleanupIds));
    }
    console.log(`\n  Tests: ${pass} passed, ${fail} failed`);
    await pool.end();
    process.exit(fail > 0 ? 1 : 0);
  }
})();

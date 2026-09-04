/**
 * Riverside Dental — Bölüm 3: Commission system.
 *
 * Mirrors the Dentafly 2026 Standard scheme exactly:
 *   - 5 tiers (flat application): 0/0.5/0.75/1.0/1.25%
 *   - 2 performance thresholds: 80%→0.5x, 100%→1.0x
 *   - 4 team bonus tiers (per_staff): €160k→€100, €200k→€250, €220k→€400, €250k→€600
 *   - Revenue targets + commission periods (May/May 2026)
 *   - treatment_deals linked to Riverside leads + TCs (Sophie Bennett, Olivia Grant)
 *
 * Idempotent: clears Riverside commission rows first, then re-inserts.
 * Run AFTER seed-demo-riverside.js (needs tenant + staff + leads).
 * Usage: node src/db/seed-demo-riverside-commission.js
 */

require('dotenv').config({ override: true, path: require('path').join(__dirname, '../../.env') });

const { pool } = require('./index');

const TENANT_SLUG = 'riverside-dental-london';

// Tiers (flat application) — identical to Dentafly
const TIERS = [
  { order: 1, min: 0,      max: 99999.99,  rate: 0.0,  flat: 0 },
  { order: 2, min: 100000, max: 149999.99, rate: 0.5,  flat: 0 },
  { order: 3, min: 150000, max: 199999.99, rate: 0.75, flat: 0 },
  { order: 4, min: 200000, max: 249999.99, rate: 1.0,  flat: 0 },
  { order: 5, min: 250000, max: null,      rate: 1.25, flat: 0 },
];
const THRESHOLDS = [
  { target: 80,  mult: 0.5 },
  { target: 100, mult: 1.0 },
];
const TEAM_BONUS = [
  { order: 1, min: 160000, max: 199999.99, perStaff: 100, split: 'per_staff' },
  { order: 2, min: 200000, max: 219999.99, perStaff: 250, split: 'per_staff' },
  { order: 3, min: 220000, max: 249999.99, perStaff: 400, split: 'per_staff' },
  { order: 4, min: 250000, max: null,      perStaff: 600, split: 'per_staff' },
];

// Treatment deals — linked to Riverside leads (by phone) + TCs (by email).
// Realistic dental amounts. Total agreed ≈ clinic revenue for the period.
const DEALS = [
  { leadPhone:'447700910004', tc:'sophie.bennett@riversidedental.co.uk',  category:'implant',      name:'Single implant',         agreed:7600,  dealDaysAgo:3,  status:'accepted', verification:'manually_approved', patient:'Thomas Whitfield' },
  { leadPhone:'447700910020', tc:'sophie.bennett@riversidedental.co.uk',  category:'implant',      name:'Single implant',         agreed:6800,  dealDaysAgo:7,  status:'accepted', verification:'auto_matched',      patient:'Oliver Scott' },
  { leadPhone:'447700910018', tc:'olivia.grant@riversidedental.co.uk',    category:'orthodontics', name:'Invisalign full',        agreed:3600,  dealDaysAgo:5,  status:'accepted', verification:'auto_matched',      patient:'Sophie Turner' },
  { leadPhone:'447700910021', tc:'olivia.grant@riversidedental.co.uk',    category:'cosmetic',     name:'Porcelain veneers x6',   agreed:5200,  dealDaysAgo:15, status:'accepted', verification:'manually_approved', patient:'Isabella Romano' },
  { leadPhone:'447700910019', tc:'sophie.bennett@riversidedental.co.uk',  category:'cosmetic',     name:'Teeth whitening',        agreed:450,   dealDaysAgo:12, status:'accepted', verification:'auto_matched',      patient:'Aisha Rahman' },
];

function dateDaysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

async function main() {
  console.log('━━━ Riverside komisyon seed (Bölüm 3) ━━━\n');

  const { rows: tRows } = await pool.query('SELECT id FROM tenants WHERE slug=$1', [TENANT_SLUG]);
  if (!tRows[0]) { console.error('Riverside tenant yok — önce seed-demo-riverside.js'); process.exit(1); }
  const tenantId = tRows[0].id;

  // lead + staff lookup
  const { rows: leadRows } = await pool.query('SELECT id, phone FROM leads WHERE tenant_id=$1', [tenantId]);
  const leadIdByPhone = {}; leadRows.forEach(r => leadIdByPhone[r.phone] = r.id);
  const { rows: staffRows } = await pool.query('SELECT id, email FROM users WHERE tenant_id=$1', [tenantId]);
  const staffIdByEmail = {}; staffRows.forEach(r => staffIdByEmail[r.email] = r.id);

  // Idempotent cleanup (child → parent order)
  console.log('── Temizlik (idempotent) ──');
  await pool.query('DELETE FROM commission_records WHERE tenant_id=$1', [tenantId]);
  await pool.query('DELETE FROM commission_periods WHERE tenant_id=$1', [tenantId]);
  await pool.query('DELETE FROM treatment_deals WHERE tenant_id=$1', [tenantId]);
  await pool.query('DELETE FROM team_bonus_tiers WHERE tenant_id=$1', [tenantId]);
  await pool.query('DELETE FROM clinic_revenue_targets WHERE tenant_id=$1', [tenantId]);
  await pool.query(`DELETE FROM commission_performance_thresholds WHERE scheme_id IN
    (SELECT id FROM commission_schemes WHERE tenant_id=$1)`, [tenantId]);
  await pool.query(`DELETE FROM commission_tiers WHERE scheme_id IN
    (SELECT id FROM commission_schemes WHERE tenant_id=$1)`, [tenantId]);
  await pool.query('DELETE FROM commission_schemes WHERE tenant_id=$1', [tenantId]);
  console.log('  ✅ eski komisyon verisi temizlendi\n');

  // 1. Scheme
  const { rows: sRows } = await pool.query(`
    INSERT INTO commission_schemes
      (tenant_id, name, description, type, is_active, effective_from, tier_application)
    VALUES ($1, 'Riverside 2026 Standard', 'Demo commission scheme', 'tiered', TRUE, '2026-01-01', 'flat')
    RETURNING id
  `, [tenantId]);
  const schemeId = sRows[0].id;
  console.log('── Scheme ──  ✅ Riverside 2026 Standard');

  // 2. Tiers
  for (const t of TIERS) {
    await pool.query(`
      INSERT INTO commission_tiers (scheme_id, tier_order, min_revenue, max_revenue, rate_percent, flat_bonus)
      VALUES ($1,$2,$3,$4,$5,$6)
    `, [schemeId, t.order, t.min, t.max, t.rate, t.flat]);
  }
  console.log(`  ✅ ${TIERS.length} kademe`);

  // 3. Thresholds
  for (const th of THRESHOLDS) {
    await pool.query(`
      INSERT INTO commission_performance_thresholds (scheme_id, target_percent, multiplier)
      VALUES ($1,$2,$3)
    `, [schemeId, th.target, th.mult]);
  }
  console.log(`  ✅ ${THRESHOLDS.length} performans eşiği`);

  // 4. Team bonus tiers
  for (const tb of TEAM_BONUS) {
    await pool.query(`
      INSERT INTO team_bonus_tiers (tenant_id, tier_order, min_revenue, max_revenue, bonus_per_staff, bonus_pool, split_method)
      VALUES ($1,$2,$3,$4,$5,0,$6)
    `, [tenantId, tb.order, tb.min, tb.max, tb.perStaff, tb.split]);
  }
  console.log(`  ✅ ${TEAM_BONUS.length} ekip bonusu kademesi`);

  // 5. Revenue targets (May + May 2026)
  for (const [start, end, label] of [
    ['2026-05-01', '2026-05-31', 'May 2026'],
    ['2026-06-01', '2026-06-30', 'May 2026'],
  ]) {
    await pool.query(`
      INSERT INTO clinic_revenue_targets (tenant_id, period_start, period_end, target_type, target_amount, currency)
      VALUES ($1,$2,$3,'monthly',200000,'GBP')
    `, [tenantId, start, end]);
  }
  console.log('  ✅ 2 gelir hedefi (May/June, €200k)');

  // 6. Treatment deals
  console.log('\n── Treatment deals ──');
  for (const d of DEALS) {
    const leadId = leadIdByPhone[d.leadPhone] || null;
    const staffId = staffIdByEmail[d.tc] || null;
    await pool.query(`
      INSERT INTO treatment_deals
        (tenant_id, lead_id, assigned_staff_id, treatment_category, treatment_name,
         agreed_amount, deposit_amount, currency, deal_date, status, verification_status, patient_name, commission_locked)
      VALUES ($1,$2,$3,$4,$5,$6,0,'GBP',$7,$8,$9,$10,FALSE)
    `, [tenantId, leadId, staffId, d.category, d.name, d.agreed, dateDaysAgo(d.dealDaysAgo), d.status, d.verification, d.patient]);
    console.log(`  ✅ ${d.patient} — ${d.name} €${d.agreed} (${d.tc.split('@')[0]})`);
  }

  // 7. Commission period — May 2026, clinic revenue ABOVE target (shows full commission)
  const { rows: pRows } = await pool.query(`
    INSERT INTO commission_periods
      (tenant_id, period_start, period_end, period_label, status, clinic_revenue)
    VALUES ($1,'2026-05-01','2026-05-31','May 2026','open',225000)
    RETURNING id
  `, [tenantId]);
  console.log(`\n── Period ──  ✅ May 2026 (open, clinic revenue €225k — hedefin üstünde)`);

  console.log('\n━━━ Bölüm 3 tamamlandı: komisyon sistemi ━━━');
  console.log('Not: Komisyon hesabı (calculate) demo sırasında UI\'dan tetiklenebilir.');
  console.log('Period "open" — director/super_admin Commission ekranından Calculate edebilir.');

  await pool.end();
}

main().catch(e => { console.error('SEED ERROR:', e.message); process.exit(1); });

/**
 * Migration: add clinic profile columns to tenants + expand plan_tier constraint.
 * Safe to run multiple times (uses IF NOT EXISTS / try-catch per statement).
 *
 * Usage: node src/db/migrate-clinic-details.js
 */

require('dotenv').config({ override: true, path: require('path').join(__dirname, '../../.env') });
const { pool } = require('./index');

async function run() {
  const client = await pool.connect();
  try {
    console.log('[Migrate] Starting clinic-details migration…');

    // 1. Add profile columns to tenants (idempotent)
    const addColumns = [
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone  VARCHAR(30)`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email  TEXT`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS website TEXT`,
    ];
    for (const sql of addColumns) {
      await client.query(sql);
      console.log('[Migrate] OK:', sql.split(' ADD COLUMN IF NOT EXISTS ')[1]);
    }

    // 2. Expand plan_tier check to include 'pro'
    //    Drop old constraint (ignore if it doesn't exist) and re-add.
    try {
      await client.query(`ALTER TABLE tenants DROP CONSTRAINT chk_tenants_plan_tier`);
      console.log('[Migrate] Dropped old chk_tenants_plan_tier constraint');
    } catch {
      console.log('[Migrate] chk_tenants_plan_tier not found — skipping drop');
    }
    await client.query(`
      ALTER TABLE tenants
      ADD CONSTRAINT chk_tenants_plan_tier
      CHECK (plan_tier IN ('free','starter','growth','pro','enterprise'))
    `);
    console.log('[Migrate] Re-created chk_tenants_plan_tier with pro');

    // 3. Expand status check to include 'pending' (useful for freshly-created clinics)
    try {
      await client.query(`ALTER TABLE tenants DROP CONSTRAINT chk_tenants_status`);
      console.log('[Migrate] Dropped old chk_tenants_status constraint');
    } catch {
      console.log('[Migrate] chk_tenants_status not found — skipping drop');
    }
    await client.query(`
      ALTER TABLE tenants
      ADD CONSTRAINT chk_tenants_status
      CHECK (status IN ('active','pending','suspended','cancelled'))
    `);
    console.log('[Migrate] Re-created chk_tenants_status with pending');

    console.log('[Migrate] Done ✅');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('[Migrate] Error:', err.message);
  process.exit(1);
});

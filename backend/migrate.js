require('dotenv').config();
const { pool } = require('./src/db/index');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const steps = [
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(30)`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS website TEXT`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_monthly_limit INTEGER NOT NULL DEFAULT 500`,
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_overage_policy VARCHAR(10) NOT NULL DEFAULT 'notify'`,
      `ALTER TABLE tenants DROP CONSTRAINT IF EXISTS chk_tenants_overage_policy`,
      `ALTER TABLE tenants ADD CONSTRAINT chk_tenants_overage_policy CHECK (ai_overage_policy IN ('block','notify','allow'))`,
      `ALTER TABLE tenants DROP CONSTRAINT IF EXISTS chk_tenants_plan_tier`,
      `ALTER TABLE tenants ADD CONSTRAINT chk_tenants_plan_tier CHECK (plan_tier IN ('free','starter','growth','pro','enterprise'))`,
      `ALTER TABLE tenants DROP CONSTRAINT IF EXISTS chk_tenants_status`,
      `ALTER TABLE tenants ADD CONSTRAINT chk_tenants_status CHECK (status IN ('active','pending','suspended','cancelled'))`,
      `ALTER TABLE messages ADD COLUMN IF NOT EXISTS scenario_type VARCHAR(50)`,
      `ALTER TABLE messages ADD COLUMN IF NOT EXISTS objection_type VARCHAR(50)`,
      `UPDATE roles SET name='director', description='Clinic director' WHERE name='clinic_owner'`,
      `UPDATE roles SET name='dentist', description='Treating dentist' WHERE name='doctor'`,
      `INSERT INTO roles (name, description, permissions) VALUES ('treatment_coordinator','Treatment Coordinator','{"leads":"read_write"}') ON CONFLICT (name) DO NOTHING`,
      `ALTER TABLE leads ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ`,
      `UPDATE leads SET status_changed_at=updated_at WHERE status IN ('booked','attended') AND status_changed_at IS NULL`,
    ];
    for (const sql of steps) {
      console.log('Running:', sql.slice(0, 60));
      await client.query(sql);
    }
    await client.query('COMMIT');
    console.log('\n✅ Migration OK');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', e.message);
  } finally {
    client.release();
    process.exit(0);
  }
}
migrate();

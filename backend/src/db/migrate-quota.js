require('dotenv').config({ override: true });
const { pool } = require('./index');

async function run() {
  await pool.query(`
    ALTER TABLE tenants
      ADD COLUMN IF NOT EXISTS ai_monthly_limit   INTEGER      NOT NULL DEFAULT 500,
      ADD COLUMN IF NOT EXISTS ai_overage_policy  VARCHAR(10)  NOT NULL DEFAULT 'notify'
  `);
  // Add CHECK constraint separately (idempotent-ish)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_tenants_overage_policy'
      ) THEN
        ALTER TABLE tenants
          ADD CONSTRAINT chk_tenants_overage_policy
          CHECK (ai_overage_policy IN ('block','notify','allow'));
      END IF;
    END$$;
  `);
  console.log('✅ Quota columns added to tenants');
  await pool.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });

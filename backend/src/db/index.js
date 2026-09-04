require('dotenv').config({ override: true });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('[DB] Unexpected pool error:', err.message));

/**
 * Returns the first active tenant's ID.
 * Used as the default tenant for inbound WhatsApp leads until
 * full multi-tenancy routing (phone_number_id → tenant) is wired.
 */
async function getDefaultTenantId() {
  const { rows } = await pool.query(
    "SELECT id FROM tenants WHERE status = 'active' AND deleted_at IS NULL ORDER BY created_at LIMIT 1"
  );
  return rows[0]?.id || null;
}

module.exports = { pool, getDefaultTenantId };

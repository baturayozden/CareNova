/**
 * Seeds the database with:
 *   1. A default tenant "CareNova AI"
 *   2. Super admin user baturay@carenova.ai (role_id = 1)
 *
 * Safe to run multiple times — uses ON CONFLICT DO NOTHING.
 *
 * Usage: node src/db/seed.js
 */

require('dotenv').config({ override: true, path: require('path').join(__dirname, '../../.env') });

const bcrypt    = require('bcryptjs');
const { pool }  = require('./index');

async function seed() {
  console.log('[Seed] Connecting to database...');

  // 1. Default tenant
  const tenantResult = await pool.query(`
    INSERT INTO tenants (name, slug, status, plan_tier, country, timezone)
    VALUES ('CareNova AI', 'carenova-ai', 'active', 'growth', 'GB', 'Europe/London')
    ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
    RETURNING id, name, slug
  `);
  const tenant = tenantResult.rows[0];
  console.log(`[Seed] Tenant: "${tenant.name}" (${tenant.id})`);

  // 2. Super admin — no tenant, role_id = 1
  const passwordHash = await bcrypt.hash('CareNova2026!', 12);
  const userResult = await pool.query(`
    INSERT INTO users (tenant_id, role_id, email, password_hash, first_name, last_name, is_active)
    VALUES (NULL, 1, 'baturay@carenova.ai', $1, 'Baturay', 'Ozden', TRUE)
    ON CONFLICT (tenant_id, email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      updated_at    = NOW()
    RETURNING id, email, role_id
  `, [passwordHash]);
  const user = userResult.rows[0];
  console.log(`[Seed] Super admin: ${user.email} (role_id=${user.role_id}, id=${user.id})`);

  await pool.end();
  console.log('[Seed] Done ✅');
}

seed().catch(err => {
  console.error('[Seed] Error:', err.message);
  process.exit(1);
});

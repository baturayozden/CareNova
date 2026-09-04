'use strict';

// Generate a site-form ingest key for a tenant and store its SHA-256 hash.
// The raw key is printed ONCE — it is never written to the database.
// Run locally — never deploy or commit key values.
//
// Usage:
//   export DATABASE_URL="postgres://..."
//   node src/scripts/setIngestKey.js <tenant-id>
//   # or: export TARGET_TENANT_ID="<uuid>" && node src/scripts/setIngestKey.js
//
// Example (Vestadent):
//   node src/scripts/setIngestKey.js 682ba358-434a-4126-a558-90d2ead67979
//
// Example (Dentafly):
//   node src/scripts/setIngestKey.js 772222bf-16bd-4046-b527-c819e4efbfc1

require('dotenv').config();  // shell exports win over .env

const crypto = require('crypto');
const { Pool } = require('pg');

const tenantId = process.argv[2] || process.env.TARGET_TENANT_ID;

if (!tenantId) {
  console.error('Usage: node src/scripts/setIngestKey.js <tenant-id>');
  console.error('   or: export TARGET_TENANT_ID=<uuid> && node src/scripts/setIngestKey.js');
  process.exit(1);
}

async function main() {
  const rawHex  = crypto.randomBytes(24).toString('hex');   // 48 hex chars
  const fullKey = `cd_ingest_${rawHex}`;                    // e.g. cd_ingest_a3f9...
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rowCount } = await pool.query(
      `UPDATE tenants SET ingest_key_hash = $1 WHERE id = $2`,
      [keyHash, tenantId],
    );

    if (rowCount === 0) {
      console.error('No row updated — tenant not found:', tenantId);
      process.exit(1);
    }

    console.log('');
    console.log('Ingest key (save this — shown once):');
    console.log('  ' + fullKey);
    console.log('');
    console.log('Tenant:     ', tenantId);
    console.log('Hash stored:', keyHash.slice(0, 16) + '...');
    console.log('');
    console.log('Use this key in the VESTADENT_INGEST_KEY (or equivalent) env var on your site.');
    console.log('Regenerating will immediately invalidate the previous key.');
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });

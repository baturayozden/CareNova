'use strict';

// Generate a public widget site key for a tenant and store it plain (NOT hashed).
// site_key is intentionally public — it appears in the embed snippet in browser source.
// Security comes from widget_allowed_origins, not key secrecy.
//
// Usage:
//   export DATABASE_URL="postgres://..."
//   node src/scripts/setSiteKey.js <tenant-id> ["https://origin1.com,https://origin2.com"]
//   # or: export TARGET_TENANT_ID=<uuid>
//
// Origins arg is optional — omit to leave as empty array (add later via panel or re-run).
//
// Example (Vestadent):
//   node src/scripts/setSiteKey.js 682ba358-434a-4126-a558-90d2ead67979 \
//     "https://vestadentlondon.co.uk,https://www.vestadentlondon.co.uk"
//
// Example (Dentafly):
//   node src/scripts/setSiteKey.js 772222bf-16bd-4046-b527-c819e4efbfc1 \
//     "https://dentaflylondon.co.uk,https://www.dentaflylondon.co.uk"

require('dotenv').config();  // shell exports win over .env

const crypto = require('crypto');
const { Pool } = require('pg');

const tenantId = process.argv[2] || process.env.TARGET_TENANT_ID;

if (!tenantId) {
  console.error('Usage: node src/scripts/setSiteKey.js <tenant-id> ["origin1,origin2"]');
  console.error('   or: export TARGET_TENANT_ID=<uuid> && node src/scripts/setSiteKey.js');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL env is required.');
  process.exit(1);
}

async function main() {
  const siteKey = 'cd_site_' + crypto.randomBytes(16).toString('hex');

  // Parse origins from argv[3] or ALLOWED_ORIGINS env (comma-separated)
  const originsRaw = process.argv[3] || process.env.ALLOWED_ORIGINS || '';
  const origins = originsRaw
    ? originsRaw.split(',').map(o => o.trim()).filter(Boolean)
    : [];

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rowCount } = await pool.query(
      `UPDATE tenants
          SET widget_site_key       = $1,
              widget_allowed_origins = $2
        WHERE id = $3`,
      [siteKey, origins, tenantId],
    );

    if (rowCount === 0) {
      console.error('No row updated — tenant not found:', tenantId);
      process.exit(1);
    }

    console.log('');
    console.log('Widget site key set:');
    console.log('  Widget site key:', siteKey);
    console.log('  Allowed origins:', origins.length ? origins.join(', ') : '(none — add later)');
    console.log('  Tenant:         ', tenantId);
    console.log('');
    console.log('Embed snippet:');
    console.log(`  <script src="https://app.carenova.ai/widget.js" data-site-key="${siteKey}" async></script>`);
    console.log('');
    console.log('Re-running will generate a NEW key and invalidate the previous one.');
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });

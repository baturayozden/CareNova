'use strict';

// Add or update a WhatsApp Business config for a tenant.
// The access token is stored as plain text (migration 013 removed encryption).
// Run locally — never deploy or commit token values.
//
// Usage:
//   export DATABASE_URL="postgres://..."
//   export WHATSAPP_ACCESS_TOKEN="EAAxxxxxxx..."
//   export WHATSAPP_PHONE_NUMBER_ID="12345678901234"
//   node src/scripts/setWhatsAppConfig.js <tenant-id> [display-name] [business-account-id]
//   # or: export TARGET_TENANT_ID="<uuid>" && node src/scripts/setWhatsAppConfig.js
//
// Example (Vestadent):
//   export WHATSAPP_ACCESS_TOKEN="EAAxxxxxxx..."
//   export WHATSAPP_PHONE_NUMBER_ID="12345678901234"
//   node src/scripts/setWhatsAppConfig.js 682ba358-434a-4126-a558-90d2ead67979 "Vestadent" "123456789"
//
// Example (Dentafly):
//   node src/scripts/setWhatsAppConfig.js 772222bf-16bd-4046-b527-c819e4efbfc1 "Dentafly"

require('dotenv').config();  // shell exports win over .env — never use override: true in scripts

const { Pool } = require('pg');

const VESTADENT_TENANT_ID = '682ba358-434a-4126-a558-90d2ead67979';

const tenantId          = process.argv[2] || process.env.TARGET_TENANT_ID || VESTADENT_TENANT_ID;
const displayName       = process.argv[3] || process.env.WHATSAPP_DISPLAY_NAME || 'WhatsApp Business';
const businessAccountId = process.argv[4] || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

if (!accessToken)   { console.error('Missing WHATSAPP_ACCESS_TOKEN'); process.exit(1); }
if (!phoneNumberId) { console.error('Missing WHATSAPP_PHONE_NUMBER_ID'); process.exit(1); }

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows: existing } = await pool.query(
      `SELECT id FROM whatsapp_configs WHERE tenant_id = $1`,
      [tenantId],
    );

    const wabId = businessAccountId || null;
    let row;

    if (existing.length === 0) {
      const { rows } = await pool.query(
        `INSERT INTO whatsapp_configs
           (tenant_id, display_name, phone_number_id, business_account_id,
            access_token, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING id, display_name, phone_number_id, is_active, created_at`,
        [tenantId, displayName, phoneNumberId, wabId, accessToken],
      );
      row = rows[0];
      console.log('');
      console.log('WhatsApp config CREATED:');
    } else {
      const { rows } = await pool.query(
        `UPDATE whatsapp_configs
         SET display_name        = $1,
             phone_number_id     = $2,
             access_token        = $3,
             business_account_id = $4,
             is_active           = TRUE
         WHERE tenant_id = $5
         RETURNING id, display_name, phone_number_id, is_active, created_at`,
        [displayName, phoneNumberId, accessToken, wabId, tenantId],
      );
      row = rows[0];
      console.log('');
      console.log('WhatsApp config UPDATED:');
    }

    console.log('  id:             ', row.id);
    console.log('  tenant_id:      ', tenantId);
    console.log('  display_name:   ', row.display_name);
    console.log('  phone_number_id:', row.phone_number_id);
    console.log('  is_active:      ', row.is_active);
    console.log('  access_token:   ', '[set — not shown]');
    console.log('');
    console.log('Webhook will now route messages from phone_number_id', phoneNumberId, 'to tenant', tenantId);
    console.log('');
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });

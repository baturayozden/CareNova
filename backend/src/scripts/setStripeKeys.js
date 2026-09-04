'use strict';

// One-time script: encrypt Stripe keys and write to tenant_billing_profiles.
// Run locally — never deploy or commit key values.
//
// Usage (Vestadent — default):
//   export DATABASE_URL="postgres://..."
//   export TOKEN_ENCRYPTION_KEY="<64 hex chars — same value as on Render>"
//   export STRIPE_SECRET_KEY="sk_live_..."
//   export STRIPE_PUBLISHABLE_KEY="pk_live_..."
//   export STRIPE_WEBHOOK_SECRET="whsec_..."   # optional — skip if not yet configured
//   node src/scripts/setStripeKeys.js
//
// Usage (any other tenant — pass TARGET_TENANT_ID as env or argv[2]):
//   export TARGET_TENANT_ID="772222bf-16bd-4046-b527-c819e4efbfc1"
//   node src/scripts/setStripeKeys.js
//   # or: node src/scripts/setStripeKeys.js 772222bf-16bd-4046-b527-c819e4efbfc1

require('dotenv').config();  // shell exports win over .env

const { Pool }    = require('pg');
const { encrypt } = require('../utils/googleCalendarApi');

const VESTADENT_TENANT_ID = '682ba358-434a-4126-a558-90d2ead67979';
const tenantId = process.argv[2] || process.env.TARGET_TENANT_ID || VESTADENT_TENANT_ID;

async function main() {
  const secretKey      = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  const webhookSecret  = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey)      { console.error('Missing STRIPE_SECRET_KEY'); process.exit(1); }
  if (!publishableKey) { console.error('Missing STRIPE_PUBLISHABLE_KEY'); process.exit(1); }

  if (!secretKey.startsWith('sk_')) {
    console.error('STRIPE_SECRET_KEY does not look like a Stripe key (expected sk_...)');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const encryptedSecretKey = encrypt(secretKey);

    const setClauses = [
      'stripe_secret_key_encrypted = $1',
      'stripe_publishable_key      = $2',
      'payment_provider            = $3',
      'updated_at                  = NOW()',
    ];
    const values = [encryptedSecretKey, publishableKey, 'stripe'];

    if (webhookSecret) {
      setClauses.splice(3, 0, 'stripe_webhook_secret = $4');
      values.push(webhookSecret);
      values.push(tenantId);     // $5
    } else {
      values.push(tenantId);     // $4
      console.warn('STRIPE_WEBHOOK_SECRET not set — will be NULL. Update after configuring the webhook in Stripe Dashboard.');
    }

    const tenantParam = `$${values.length}`;
    const { rowCount } = await pool.query(
      `UPDATE tenant_billing_profiles
       SET ${setClauses.join(', ')}
       WHERE tenant_id = ${tenantParam}`,
      values,
    );

    if (rowCount === 0) {
      console.error('No row updated — tenant_id not found:', tenantId);
      process.exit(1);
    }

    console.log(`Stripe keys set for tenant: ${tenantId}`);
    console.log('  payment_provider          = stripe');
    console.log('  stripe_secret_key         = [encrypted]');
    console.log('  stripe_publishable_key    = ' + publishableKey.slice(0, 8) + '...');
    console.log('  stripe_webhook_secret     = ' + (webhookSecret ? '[set]' : '[not set]'));
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });

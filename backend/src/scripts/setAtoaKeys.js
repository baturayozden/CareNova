/**
 * setAtoaKeys.js — Set Atoa payment credentials for a tenant.
 *
 * Mirrors setStripeKeys.js: tenant-parametric, encrypts the API token with the
 * same AES-256-GCM helper (TOKEN_ENCRYPTION_KEY), stores webhook secret plain.
 *
 * Usage:
 *   ATOA_API_TOKEN="<bearer-secret>" \
 *   ATOA_WEBHOOK_SECRET="<v2-signing-secret>" \
 *   ATOA_ENVIRONMENT="sandbox" \
 *   node src/scripts/setAtoaKeys.js <tenant_id>
 *
 *   # tenant_id can also come from TARGET_TENANT_ID env; defaults to Vestadent.
 *
 * Required env: DATABASE_URL, TOKEN_ENCRYPTION_KEY (same value as Render/Stripe).
 * The token is ENCRYPTED before storage; webhook secret stored PLAIN (Stripe pattern).
 * Also sets payment_provider='atoa' and atoa_environment.
 */

require('dotenv').config();
const { Pool } = require('pg');
const { encrypt } = require('../utils/googleCalendarApi');

const VESTADENT_DEFAULT = '682ba358-434a-4126-a558-90d2ead67979';

async function main() {
  const tenantId =
    process.argv[2] || process.env.TARGET_TENANT_ID || VESTADENT_DEFAULT;

  const apiToken = process.env.ATOA_API_TOKEN;
  const webhookSecret = process.env.ATOA_WEBHOOK_SECRET || null;
  const environment = process.env.ATOA_ENVIRONMENT || 'sandbox';

  if (!apiToken) {
    console.error('ERROR: ATOA_API_TOKEN env is required.');
    process.exit(1);
  }
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    console.error(
      'ERROR: TOKEN_ENCRYPTION_KEY env is required (must match Render value).'
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL env is required.');
    process.exit(1);
  }
  if (environment !== 'sandbox' && environment !== 'production') {
    console.error("ERROR: ATOA_ENVIRONMENT must be 'sandbox' or 'production'.");
    process.exit(1);
  }

  const encryptedToken = encrypt(apiToken);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const result = await pool.query(
      `UPDATE tenant_billing_profiles
         SET atoa_api_token_encrypted = $1,
             atoa_webhook_secret      = $2,
             atoa_environment         = $3,
             payment_provider         = 'atoa',
             updated_at               = NOW()
       WHERE tenant_id = $4`,
      [encryptedToken, webhookSecret, environment, tenantId]
    );

    if (result.rowCount === 0) {
      console.error(
        `ERROR: No tenant_billing_profiles row for tenant_id=${tenantId}. ` +
          `Create the billing profile first.`
      );
      process.exit(1);
    }

    console.log('Atoa keys set successfully:');
    console.log(`  tenant_id:        ${tenantId}`);
    console.log(`  payment_provider: atoa`);
    console.log(`  atoa_environment: ${environment}`);
    console.log(`  api_token:        [encrypted — not shown]`);
    console.log(
      `  webhook_secret:   ${webhookSecret ? '[set — plain]' : '[not set]'}`
    );
  } catch (err) {
    console.error('ERROR updating tenant_billing_profiles:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

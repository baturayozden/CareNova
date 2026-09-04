/**
 * utils/atoa.js — Atoa (UK Open Banking + Card) payment link helper.
 *
 * Mirrors utils/stripe.js: pulls the tenant's encrypted API token, decrypts it,
 * calls Atoa's process-payment endpoint, returns { url, paymentRequestId }.
 *
 * Atoa supports Pay by Bank AND Card from one payment URL — the customer chooses
 * at checkout (paymentMethod: ['PAY_BY_BANK', 'CARD']).
 *
 * Docs: https://docs.atoa.me/api-reference/Payment/process-payment
 */

const axios        = require('axios');
const { pool }     = require('../db/index');
const { decrypt }  = require('./googleCalendarApi');

// Atoa uses the same base URL for both sandbox and production.
// The environment distinction is made by the API token, not the URL.
const ATOA_BASE_URL = 'https://api.atoa.me';

// 24 hours in milliseconds — overrides Atoa's 3-minute default so a payment link
// sent over WhatsApp/email stays valid long enough for the patient to pay.
const PAYMENT_EXPIRES_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Fetch and decrypt the tenant's Atoa API token + environment.
 * @returns {Promise<{ token: string, environment: string }>}
 */
async function getAtoaCredentials(tenantId) {
  const { rows } = await pool.query(
    `SELECT atoa_api_token_encrypted, atoa_environment
       FROM tenant_billing_profiles
      WHERE tenant_id = $1`,
    [tenantId]
  );
  if (rows.length === 0 || !rows[0].atoa_api_token_encrypted) {
    throw new Error(`No Atoa API token configured for tenant ${tenantId}`);
  }
  const token       = decrypt(rows[0].atoa_api_token_encrypted);
  const environment = rows[0].atoa_environment || 'sandbox';
  return { token, environment };
}

/**
 * Create an Atoa payment request and return the customer-facing payment URL.
 *
 * @param {object} args
 * @param {string} args.tenantId
 * @param {string} args.caseId            — used as Atoa orderId (webhook resolve key)
 * @param {number} args.amount            — POUND decimal (e.g. 1500.00), NOT pence
 * @param {string} [args.currency='GBP']
 * @param {string} [args.name]            — recipient name (consumer firstName)
 * @param {string} [args.phone]           — recipient phone
 * @param {string} [args.email]           — recipient email
 * @param {string} [args.notes]           — <=30 chars, shown in Atoa dashboard
 * @param {string} [args.redirectUrl]     — where the customer lands after paying
 * @returns {Promise<{ url: string, paymentRequestId: string }>}
 */
async function createAtoaPaymentLink({
  tenantId,
  caseId,
  amount,
  currency = 'GBP',
  name,
  phone,
  email,
  notes,
  redirectUrl,
  paymentMethods = ['PAY_BY_BANK', 'CARD'],  // caller sets ['CARD'] or ['PAY_BY_BANK'] as needed
}) {
  const { token, environment } = await getAtoaCredentials(tenantId);
  const targetUrl = `${ATOA_BASE_URL}/api/payments/process-payment`;
  console.log('[Atoa] createPaymentLink', { caseId, amount, currency, environment, paymentMethods });

  const body = {
    customerId:    tenantId,                          // merchant-side unique customer reference
    orderId:       caseId,                            // echoed back in webhook → tenant/case resolve
    amount:        Number(amount),                    // POUND decimal (confirm unit in sandbox)
    currency,
    paymentMethod: paymentMethods,
    expiresIn:     PAYMENT_EXPIRES_IN_MS,
    allowRetry:    true,
  };

  if (name || phone || email) {
    body.consumerDetails = {};
    if (name)  body.consumerDetails.firstName   = name;
    if (phone) body.consumerDetails.phoneNumber = phone;
    if (email) body.consumerDetails.email       = email;
  }
  if (notes)       body.notes       = String(notes).slice(0, 30); // Atoa hard limit 30
  if (redirectUrl) body.redirectUrl = redirectUrl;

  let resp;
  try {
    resp = await axios.post(targetUrl, body, {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  } catch (err) {
    console.error('[Atoa] process-payment failed', err.response?.status,
      err.response?.data ? JSON.stringify(err.response.data) : err.message);
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    throw new Error(`Atoa process-payment failed: ${detail}`);
  }

  const { paymentUrl, paymentRequestId } = resp.data || {};
  if (!paymentUrl) {
    throw new Error('Atoa response missing paymentUrl');
  }

  console.log(`[Atoa] Payment link created caseId=${caseId}`);
  return { url: paymentUrl, paymentRequestId };
}

module.exports = { createAtoaPaymentLink, getAtoaCredentials };

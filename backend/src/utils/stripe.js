'use strict';

const { pool }    = require('../db/index');
const { decrypt } = require('./googleCalendarApi');

async function getStripeClient(tenantId) {
  const { rows } = await pool.query(
    `SELECT stripe_secret_key_encrypted FROM tenant_billing_profiles WHERE tenant_id = $1`,
    [tenantId],
  );
  const p = rows[0];
  if (!p?.stripe_secret_key_encrypted) throw new Error('Stripe not configured for tenant');
  const secretKey = decrypt(p.stripe_secret_key_encrypted);
  const Stripe = require('stripe');
  return new Stripe(secretKey, { apiVersion: '2024-06-20' });
}

async function createCheckoutSession({
  tenantId, caseId, amountPence, currency = 'gbp', name, successUrl, cancelUrl,
}) {
  const stripe  = await getStripeClient(tenantId);
  const session = await stripe.checkout.sessions.create({
    mode:       'payment',
    line_items: [{
      price_data: {
        currency,
        product_data: { name },
        unit_amount:  amountPence,
      },
      quantity: 1,
    }],
    metadata:            { caseId },
    payment_intent_data: { metadata: { caseId } },
    success_url:         successUrl,
    cancel_url:          cancelUrl,
  });
  return { url: session.url, sessionId: session.id };
}

module.exports = { getStripeClient, createCheckoutSession };

'use strict';

const express     = require('express');
const router      = express.Router();
const { pool }    = require('../db/index');
const linkStore   = require('../store/linkStore');
const caseStore   = require('../services/caseStore');
const { decrypt } = require('../utils/googleCalendarApi');

// Multi-tenant webhook strategy:
// 1. Peek at the unverified JSON body to extract metadata.caseId
// 2. JOIN treatment_cases → tenant_billing_profiles in ONE query to get tenant_id + stripe_webhook_secret
// 3. Verify signature with stripe.webhooks.constructEvent(rawBody, sig, tenantSecret)
// 4. Only then process the event — no state changes before verification.
// req.rawBody is captured by the global express.json verify hook in index.js.

router.post('/', async (req, res) => {
  const rawBody   = req.rawBody;
  const sigHeader = req.headers['stripe-signature'];

  if (!rawBody || !sigHeader) return res.sendStatus(400);

  // Peek at unverified body to identify which tenant's secret to use
  let peek;
  try {
    peek = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.sendStatus(400);
  }

  const caseId = peek?.data?.object?.metadata?.caseId;
  if (!caseId) {
    console.warn('[StripeWebhook] no caseId in event metadata, ignoring event type:', peek?.type);
    return res.sendStatus(200);
  }

  // Single query: case → tenant + Stripe credentials
  let row;
  try {
    const { rows } = await pool.query(
      `SELECT tc.tenant_id, tbp.stripe_secret_key_encrypted, tbp.stripe_webhook_secret
       FROM treatment_cases tc
       JOIN tenant_billing_profiles tbp ON tbp.tenant_id = tc.tenant_id
       WHERE tc.id = $1 LIMIT 1`,
      [caseId],
    );
    row = rows[0];
  } catch (err) {
    console.error('[StripeWebhook] DB lookup error:', err.message);
    return res.sendStatus(500);
  }

  if (!row) {
    console.warn('[StripeWebhook] no tenant found for caseId:', caseId);
    return res.sendStatus(200);
  }

  const { tenant_id: tenantId, stripe_secret_key_encrypted, stripe_webhook_secret } = row;

  // Verify Stripe signature with the tenant's webhook secret
  let event;
  if (!stripe_webhook_secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[StripeWebhook] REJECTED: stripe_webhook_secret not set for tenant', tenantId);
      return res.sendStatus(401);
    }
    console.warn('[StripeWebhook] stripe_webhook_secret not set — skipping verification (dev only)');
    event = peek;
  } else {
    const Stripe = require('stripe');
    const stripe = new Stripe(decrypt(stripe_secret_key_encrypted), { apiVersion: '2024-06-20' });
    try {
      event = stripe.webhooks.constructEvent(rawBody, sigHeader, stripe_webhook_secret);
    } catch (err) {
      console.warn('[StripeWebhook] signature verification failed:', err.message);
      return res.sendStatus(403);
    }
  }

  console.log('[StripeWebhook] event:', event.type);

  if (event.type === 'checkout.session.completed') {
    const completedCaseId = event.data.object.metadata?.caseId;
    if (!completedCaseId) {
      console.warn('[StripeWebhook] checkout.session.completed missing caseId in metadata');
      return res.sendStatus(200);
    }

    try {
      const { rows: caseRows } = await pool.query(
        `UPDATE treatment_cases
         SET status = 'paid', paid_at = COALESCE(paid_at, NOW()), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND status != 'paid'
         RETURNING id`,
        [completedCaseId, tenantId],
      );
      if (caseRows.length > 0) {
        console.log('[StripeWebhook] case marked paid:', completedCaseId);
        await caseStore.syncDealStatusFromCase(completedCaseId, 'paid', { actorId: null, actorRole: null, tenantId });
      }

      // Mark most recent sent payment link_request as completed
      const { rows: linkRows } = await pool.query(
        `SELECT id FROM link_requests
         WHERE case_id = $1 AND kind = 'payment' AND status = 'sent'
         ORDER BY created_at DESC LIMIT 1`,
        [completedCaseId],
      );
      if (linkRows[0]) await linkStore.markCompleted(linkRows[0].id);
    } catch (err) {
      console.error('[StripeWebhook] DB error:', err.message);
    }
  }

  res.sendStatus(200);
});

module.exports = router;

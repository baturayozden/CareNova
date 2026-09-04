/**
 * routes/atoaWebhook.js — Atoa payment webhook handler.
 *
 * Mirrors stripeWebhook.js but uses Atoa's V2 signing:
 *   HMAC-SHA256(signingSecret, rawRequestBody) compared (timing-safe) against the
 *   X-Atoa-Signature header (after stripping any "v1=" / "v2=" prefix).
 *
 * Events handled:
 *   PAYMENTS_STATUS + status=COMPLETED  → treatment_cases.status = 'paid'
 *   EXPIRED_STATUS                      → treatment_cases.status = 'expired'
 *   (PENDING / FAILED / AUTHORIZED / CANCELLED → acknowledged, no status change)
 *
 * orderId in the payload == caseId (we set it that way in process-payment).
 *
 * Docs:
 *   https://docs.atoa.me/api-reference/Webhook/introduction (V2 signing)
 *   https://docs.atoa.me/api-reference/Webhook/processPaymentWebhookResponse
 *
 * Mounted in index.js BEFORE auth, at /webhooks/atoa. rawBody comes from the
 * global express.json verify hook (req.rawBody buffer).
 */

'use strict';

const express    = require('express');
const crypto     = require('crypto');
const { pool }   = require('../db/index');
const linkStore  = require('../store/linkStore');
const caseStore  = require('../services/caseStore');

const router = express.Router();

function timingSafeEqual(a, b, encoding) {
  const bufA = Buffer.from(a, encoding);
  const bufB = Buffer.from(b, encoding);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

router.post('/', async (req, res) => {
  const rawBody = req.rawBody;
  if (!rawBody) {
    console.error('[AtoaWebhook] Missing rawBody — check express.json verify hook');
    return res.sendStatus(400);
  }

  // Parse the body to find orderId (caseId) so we can locate the tenant + its secret.
  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    console.error('[AtoaWebhook] Invalid JSON body');
    return res.sendStatus(400);
  }

  const orderId   = payload.orderId;       // == caseId
  const eventType = payload.eventType || null;
  const status    = payload.status    || null;

  if (!orderId) {
    console.warn('[AtoaWebhook] No orderId in payload — cannot resolve case');
    return res.sendStatus(200); // ack so Atoa stops retrying a malformed/irrelevant event
  }

  // Resolve tenant + webhook secret via the case.
  let tenantId, webhookSecret;
  try {
    const { rows } = await pool.query(
      `SELECT tc.tenant_id, tbp.atoa_webhook_secret
         FROM treatment_cases tc
         JOIN tenant_billing_profiles tbp ON tbp.tenant_id = tc.tenant_id
        WHERE tc.id = $1`,
      [orderId]
    );
    if (rows.length === 0) {
      console.warn(`[AtoaWebhook] No case for orderId=${orderId}`);
      return res.sendStatus(200);
    }
    tenantId      = rows[0].tenant_id;
    webhookSecret = rows[0].atoa_webhook_secret;
  } catch (err) {
    console.error('[AtoaWebhook] Tenant resolve error:', err.message);
    return res.sendStatus(500); // let Atoa retry — transient DB issue
  }

  // V2 signing: secret is 'whsec_<base64>' — strip prefix, base64-decode to raw HMAC key bytes.
  if (!webhookSecret) {
    console.error(`[AtoaWebhook] No atoa_webhook_secret for tenant=${tenantId}`);
    return res.sendStatus(500);
  }
  const sigHeader = String(req.headers['x-atoa-signature'] || '').replace(/^v\d+=/, '');
  const keyBytes  = Buffer.from(webhookSecret.replace(/^whsec_/, ''), 'base64');
  const expected  = crypto.createHmac('sha256', keyBytes).update(rawBody).digest('hex');

  if (!sigHeader || !timingSafeEqual(expected, sigHeader, 'utf8')) {
    console.error(`[AtoaWebhook] Signature mismatch tenant=${tenantId} order=${orderId}`);
    return res.sendStatus(401);
  }

  console.log(`[AtoaWebhook] Signature OK tenant=${tenantId} order=${orderId}`);

  // Signature OK — act on the event.
  try {
    const isPaid =
      status === 'COMPLETED' &&
      (eventType === 'PAYMENTS_STATUS' || eventType === null);
    const isExpired = eventType === 'EXPIRED_STATUS' || status === 'EXPIRED';

    if (isPaid) {
      const upd = await pool.query(
        `UPDATE treatment_cases
            SET status='paid', paid_at=COALESCE(paid_at, NOW()), updated_at=NOW()
          WHERE id=$1 AND tenant_id=$2 AND status != 'paid'
          RETURNING id`,
        [orderId, tenantId]
      );
      if (upd.rows.length > 0) {
        const { rows: lr } = await pool.query(
          `SELECT id FROM link_requests
            WHERE case_id=$1 AND kind='payment' AND status='sent'
            ORDER BY created_at DESC LIMIT 1`,
          [orderId]
        );
        if (lr.length > 0) {
          await linkStore.markCompleted(lr[0].id);
        }
        console.log(`[AtoaWebhook] Case ${orderId} → paid (tenant=${tenantId})`);
        await caseStore.syncDealStatusFromCase(orderId, 'paid', { actorId: null, actorRole: null, tenantId });
      } else {
        console.log(`[AtoaWebhook] Case ${orderId} already paid — no-op`);
      }
    } else if (isExpired) {
      const expUpd = await pool.query(
        `UPDATE treatment_cases
            SET status='expired', updated_at=NOW()
          WHERE id=$1 AND tenant_id=$2 AND status='payment_sent'
          RETURNING id`,
        [orderId, tenantId]
      );
      console.log(`[AtoaWebhook] Case ${orderId} → expired (tenant=${tenantId})`);
      if (expUpd.rows.length > 0) await caseStore.syncDealStatusFromCase(orderId, 'expired', { actorId: null, actorRole: null, tenantId });
    } else {
      console.log(
        `[AtoaWebhook] Case ${orderId} event=${eventType} status=${status} — acknowledged`
      );
    }
  } catch (err) {
    console.error('[AtoaWebhook] Processing error:', err.message);
    return res.sendStatus(500); // retry
  }

  return res.sendStatus(200);
});

module.exports = router;

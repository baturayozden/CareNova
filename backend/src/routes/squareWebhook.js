'use strict';

const express      = require('express');
const router       = express.Router();
const { WebhooksHelper } = require('square');
const { pool }     = require('../db/index');
const linkStore    = require('../store/linkStore');

const NOTIFICATION_URL = (process.env.BACKEND_URL || 'http://localhost:3001') + '/webhooks/square';

async function getTenantByLocationId(locationId) {
  const { rows } = await pool.query(
    `SELECT tenant_id, square_webhook_signature_key
     FROM tenant_billing_profiles
     WHERE square_location_id = $1 LIMIT 1`,
    [locationId],
  );
  return rows[0] || null;
}

router.post('/', async (req, res) => {
  // Always respond 200 quickly so Square stops retrying on non-recoverable errors.
  const body      = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
  const sigHeader = req.headers['x-square-hmacsha256-signature'];
  const event     = req.body;

  // Determine tenant from location_id in event
  const locationId = event?.location_id || event?.data?.object?.payment?.location_id;
  if (!locationId) {
    console.warn('[SquareWebhook] no location_id in event, ignoring');
    return res.sendStatus(200);
  }

  const tenant = await getTenantByLocationId(locationId).catch(() => null);
  if (!tenant) {
    console.warn('[SquareWebhook] unknown location_id:', locationId);
    return res.sendStatus(200);
  }

  // Verify HMAC signature
  if (!tenant.square_webhook_signature_key) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SquareWebhook] REJECTED: signature key not configured for tenant', tenant.tenant_id);
      return res.sendStatus(401);
    }
    console.warn('[SquareWebhook] signature key not configured — skipping verification (dev only)');
  } else if (sigHeader && tenant.square_webhook_signature_key) {
    const valid = await WebhooksHelper.verifySignature({
      requestBody:     body,
      signatureHeader: sigHeader,
      signatureKey:    tenant.square_webhook_signature_key,
      notificationUrl: NOTIFICATION_URL,
    }).catch(() => false);

    if (!valid) {
      console.warn('[SquareWebhook] invalid signature for tenant', tenant.tenant_id);
      return res.sendStatus(403);
    }
  }

  // Handle payment completion
  const type    = event?.type;
  const payment = event?.data?.object?.payment;

  if ((type === 'payment.updated' || type === 'payment.created') && payment?.status === 'COMPLETED') {
    const caseId = payment.note;
    if (!caseId) {
      console.warn('[SquareWebhook] COMPLETED payment has no note/caseId');
      return res.sendStatus(200);
    }

    try {
      // Idempotent: only update if not already paid
      const { rows: caseRows } = await pool.query(
        `UPDATE treatment_cases
         SET status = 'paid', paid_at = COALESCE(paid_at, NOW()), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND status != 'paid'
         RETURNING id`,
        [caseId, tenant.tenant_id],
      );

      if (caseRows.length > 0) {
        console.log('[SquareWebhook] case marked paid:', caseId);
      }

      // Mark the most recent sent payment link_request as completed
      const { rows: linkRows } = await pool.query(
        `SELECT id FROM link_requests
         WHERE case_id = $1 AND kind = 'payment' AND status = 'sent'
         ORDER BY created_at DESC LIMIT 1`,
        [caseId],
      );
      if (linkRows[0]) {
        await linkStore.markCompleted(linkRows[0].id);
      }
    } catch (err) {
      console.error('[SquareWebhook] DB error:', err.message);
    }
  }

  res.sendStatus(200);
});

module.exports = router;

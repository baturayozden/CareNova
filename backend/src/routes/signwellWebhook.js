'use strict';

const crypto  = require('crypto');
const express = require('express');
const router  = express.Router();
const { pool } = require('../db/index');

router.post('/', async (req, res) => {
  const body = req.body;

  // ── HMAC verification ───────────────────────────────────────────────────────
  const webhookId = process.env.SIGNWELL_WEBHOOK_ID;
  if (webhookId) {
    const data     = `${body?.event?.type}@${body?.event?.time}`;
    const calc     = crypto.createHmac('sha256', webhookId).update(data).digest('hex');
    const expected = body?.event?.hash || '';
    let valid = false;
    try {
      const calcBuf     = Buffer.from(calc, 'hex');
      const expectedBuf = Buffer.from(expected, 'hex');
      valid = calcBuf.length === expectedBuf.length &&
              crypto.timingSafeEqual(calcBuf, expectedBuf);
    } catch (_) {
      valid = false;
    }
    if (!valid) {
      console.warn('[SignWellWebhook] HMAC mismatch — rejecting');
      return res.sendStatus(401);
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SignWellWebhook] REJECTED: webhook secret not configured');
      return res.sendStatus(401);
    }
    console.warn('[SignWellWebhook] SIGNWELL_WEBHOOK_ID not set — skipping verification (dev only)');
  }

  const eventType = body?.event?.type;
  console.log('[SignWellWebhook] event:', eventType);

  if (eventType === 'document_completed') {
    const caseId   = body?.data?.object?.metadata?.case_id;
    const tenantId = body?.data?.object?.metadata?.tenant_id;

    if (!caseId) {
      console.warn('[SignWellWebhook] document_completed missing case_id in metadata');
      return res.sendStatus(200);
    }

    try {
      // Idempotent: skip if already signed or further along
      const params      = tenantId ? [caseId, tenantId] : [caseId];
      const tenantClause = tenantId ? `AND tenant_id = $2` : '';
      const { rows } = await pool.query(
        `UPDATE treatment_cases
         SET status = 'signed', signed_at = COALESCE(signed_at, NOW()), updated_at = NOW()
         WHERE id = $1 ${tenantClause} AND status != 'signed'
         RETURNING id`,
        params,
      );
      if (rows.length > 0) {
        console.log('[SignWellWebhook] case marked signed:', caseId);
      }
    } catch (err) {
      console.error('[SignWellWebhook] DB error:', err.message);
    }

    // Best-effort: mark signature link_requests completed (swallow all errors)
    try {
      await pool.query(
        `UPDATE link_requests
         SET status = 'completed', completed_at = NOW()
         WHERE case_id = $1 AND kind = 'signature' AND status = 'sent'`,
        [caseId],
      );
    } catch (linkErr) {
      console.warn('[SignWellWebhook] link_requests update failed (non-fatal):', linkErr.message);
    }
  }

  if (eventType === 'document_declined') {
    const caseId   = body?.data?.object?.metadata?.case_id;
    const tenantId = body?.data?.object?.metadata?.tenant_id;

    if (!caseId) {
      console.warn('[SignWellWebhook] document_declined missing case_id in metadata');
      return res.sendStatus(200);
    }

    try {
      const params       = tenantId ? [caseId, tenantId] : [caseId];
      const tenantClause = tenantId ? `AND tenant_id = $2` : '';
      const { rows } = await pool.query(
        `UPDATE treatment_cases
         SET status = 'declined', declined_at = COALESCE(declined_at, NOW()), updated_at = NOW()
         WHERE id = $1 ${tenantClause}
           AND status NOT IN ('paid', 'reversed', 'cancelled', 'declined')
         RETURNING id`,
        params,
      );
      if (rows.length > 0) {
        console.log('[SignWellWebhook] case marked declined:', caseId);
      }
    } catch (err) {
      console.error('[SignWellWebhook] DB error (declined):', err.message);
    }

    try {
      await pool.query(
        `UPDATE link_requests
         SET status = 'cancelled', completed_at = NOW()
         WHERE case_id = $1 AND kind = 'signature' AND status IN ('sent', 'opened', 'created')`,
        [caseId],
      );
    } catch (linkErr) {
      console.warn('[SignWellWebhook] link_requests cancel failed (non-fatal):', linkErr.message);
    }
  }

  if (eventType === 'document_expired') {
    const caseId   = body?.data?.object?.metadata?.case_id;
    const tenantId = body?.data?.object?.metadata?.tenant_id;

    if (!caseId) {
      console.warn('[SignWellWebhook] document_expired missing case_id in metadata');
      return res.sendStatus(200);
    }

    try {
      const params       = tenantId ? [caseId, tenantId] : [caseId];
      const tenantClause = tenantId ? `AND tenant_id = $2` : '';
      const { rows } = await pool.query(
        `UPDATE treatment_cases
         SET status = 'expired', expired_at = COALESCE(expired_at, NOW()), updated_at = NOW()
         WHERE id = $1 ${tenantClause}
           AND status NOT IN ('paid', 'reversed', 'cancelled', 'signed')
         RETURNING id`,
        params,
      );
      if (rows.length > 0) {
        console.log('[SignWellWebhook] case marked expired:', caseId);
      }
    } catch (err) {
      console.error('[SignWellWebhook] DB error (expired):', err.message);
    }

    try {
      await pool.query(
        `UPDATE link_requests
         SET status = 'expired', completed_at = NOW()
         WHERE case_id = $1 AND kind = 'signature' AND status IN ('sent', 'opened', 'created')`,
        [caseId],
      );
    } catch (linkErr) {
      console.warn('[SignWellWebhook] link_requests expire failed (non-fatal):', linkErr.message);
    }
  }

  if (eventType === 'document_bounced') {
    const caseId   = body?.data?.object?.metadata?.case_id;
    const tenantId = body?.data?.object?.metadata?.tenant_id;

    if (!caseId) {
      console.warn('[SignWellWebhook] document_bounced missing case_id in metadata');
      return res.sendStatus(200);
    }

    try {
      const params       = tenantId ? [caseId, tenantId] : [caseId];
      const tenantClause = tenantId ? `AND tenant_id = $2` : '';
      const { rows } = await pool.query(
        `UPDATE treatment_cases
         SET status = 'bounced', updated_at = NOW()
         WHERE id = $1 ${tenantClause}
           AND status NOT IN ('paid', 'reversed', 'cancelled', 'signed')
         RETURNING id`,
        params,
      );
      if (rows.length > 0) {
        console.log('[SignWellWebhook] case ' + caseId + ' email bounced');
      }
    } catch (err) {
      console.error('[SignWellWebhook] DB error (bounced):', err.message);
    }
    // link_requests untouched — link is valid, only the email delivery failed
  }

  res.sendStatus(200);
});

module.exports = router;

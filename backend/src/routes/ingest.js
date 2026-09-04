'use strict';

const express    = require('express');
const crypto     = require('crypto');
const rateLimit  = require('express-rate-limit');
const { pool }   = require('../db/index');
const { createLead, normalizePhone } = require('../services/leadStore');

const router = express.Router();

// IP-based rate limit — applied to all /api/ingest/* routes
const limiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
router.use(limiter);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resolveTenantByKey(req) {
  const key = req.header('X-Ingest-Key');
  if (!key) return null;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const { rows } = await pool.query(
    `SELECT id FROM tenants WHERE ingest_key_hash = $1 AND deleted_at IS NULL`,
    [hash],
  );
  return rows[0]?.id ?? null;
}

function isHoneypot(body) {
  // Bots fill hidden fields — treat any non-empty _gotcha or website as spam
  return !!(body._gotcha || body.website);
}

// ─── POST /api/ingest/booking ────────────────────────────────────────────────

router.post('/booking', async (req, res) => {
  try {
    if (isHoneypot(req.body)) return res.json({ ok: true });  // silent drop

    const tenantId = await resolveTenantByKey(req);
    if (!tenantId) return res.status(401).json({ error: 'Invalid ingest key.' });

    const { firstName, lastName, phone, email, treatment, preferredDate, message, consent } = req.body;
    if (!firstName || !phone) {
      return res.status(400).json({ error: 'firstName and phone are required.' });
    }

    const notes = [
      `Website booking.`,
      `Treatment: ${treatment || '—'}.`,
      `Preferred: ${preferredDate || '—'}.`,
      message || '',
    ].join(' ').trim();

    try {
      await createLead({
        tenantId,
        firstName,
        lastName:          lastName   || '',
        phone,                          // normalizePhone applied inside createLead
        email:             email       || null,
        treatmentInterest: treatment   || null,
        notes,
        source:            'website',
        gdprConsentGiven:  !!consent,
        gdprConsentMethod: consent ? 'website_form' : null,
        aiFollowUpEnabled: !!consent,
      });
      return res.status(201).json({ ok: true });
    } catch (err) {
      if (err.code === 'DUPLICATE_PHONE') {
        const normalizedPhone = normalizePhone(phone);
        const dupNote = `\n---\n[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] Website booking (repeat): Treatment: ${treatment || '—'}. Preferred: ${preferredDate || '—'}. ${message || ''}`.trimEnd();
        await pool.query(
          `UPDATE leads SET notes = COALESCE(notes, '') || $1
            WHERE tenant_id = $2 AND phone = $3 AND deleted_at IS NULL`,
          [dupNote, tenantId, normalizedPhone],
        );
        return res.json({ ok: true, duplicate: true });
      }
      throw err;
    }
  } catch (err) {
    console.error('[ingest/booking]', err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── POST /api/ingest/contact ────────────────────────────────────────────────

router.post('/contact', async (req, res) => {
  try {
    if (isHoneypot(req.body)) return res.json({ ok: true });  // silent drop

    const tenantId = await resolveTenantByKey(req);
    if (!tenantId) return res.status(401).json({ error: 'Invalid ingest key.' });

    const { firstName, lastName, phone, email, message, consent } = req.body;
    if (!firstName || !phone) {
      return res.status(400).json({ error: 'firstName and phone are required.' });
    }

    const notes = `Website contact. ${message || ''}`.trim();

    try {
      await createLead({
        tenantId,
        firstName,
        lastName:          lastName || '',
        phone,                         // normalizePhone applied inside createLead
        email:             email    || null,
        notes,
        source:            'website',
        gdprConsentGiven:  !!consent,
        gdprConsentMethod: consent ? 'website_form' : null,
        aiFollowUpEnabled: !!consent,
      });
      return res.status(201).json({ ok: true });
    } catch (err) {
      if (err.code === 'DUPLICATE_PHONE') {
        const normalizedPhone = normalizePhone(phone);
        const dupNote = `\n---\n[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] Website contact (repeat): ${message || ''}`.trimEnd();
        await pool.query(
          `UPDATE leads SET notes = COALESCE(notes, '') || $1
            WHERE tenant_id = $2 AND phone = $3 AND deleted_at IS NULL`,
          [dupNote, tenantId, normalizedPhone],
        );
        return res.json({ ok: true, duplicate: true });
      }
      throw err;
    }
  } catch (err) {
    console.error('[ingest/contact]', err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;

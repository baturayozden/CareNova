'use strict';

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const { pool }  = require('../db/index');
const { createLead, normalizePhone } = require('../services/leadStore');

const router = express.Router();

// ─── Rate limit (same as ingest.js) ─────────────────────────────────────────
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

// ─── Widget-specific CORS ────────────────────────────────────────────────────
// credentials: false — widget never sends cookies.
// Origin check: is this origin in ANY tenant's widget_allowed_origins?
// The real per-tenant check happens in resolveTenantBySiteKey() inside each handler.
// Preflight (OPTIONS) is terminated by the global cors in index.js before reaching
// here, so this middleware only overrides non-preflight response headers.
const widgetCors = cors({
  origin: async (origin, callback) => {
    if (!origin) return callback(null, true); // server-to-server / curl
    try {
      const { rows } = await pool.query(
        `SELECT 1 FROM tenants
          WHERE $1 = ANY(widget_allowed_origins) AND deleted_at IS NULL LIMIT 1`,
        [origin],
      );
      callback(null, rows.length > 0);
    } catch (e) {
      callback(null, false);
    }
  },
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
});
router.use(widgetCors);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isHoneypot(body) {
  return !!(body._gotcha || body.website);
}

/**
 * Resolve a tenant by its public widget site_key + validate the request origin.
 * - No origin (server-to-server): site_key alone is accepted.
 * - Browser origin: must be present in tenant's widget_allowed_origins.
 * Returns tenant row or null.
 */
async function resolveTenantBySiteKey(siteKey, origin) {
  if (!siteKey) return null;
  const { rows } = await pool.query(
    `SELECT id, name, widget_allowed_origins
       FROM tenants
      WHERE widget_site_key = $1 AND deleted_at IS NULL LIMIT 1`,
    [siteKey],
  );
  if (rows.length === 0) return null;
  const tenant = rows[0];
  if (origin) {
    // Browser request — origin must be in this tenant's allowlist.
    if (!tenant.widget_allowed_origins.includes(origin)) return null;
  }
  return tenant;
}

// ─── GET /api/widget/config ──────────────────────────────────────────────────
// Returns public clinic info for rendering the widget UI.
// siteKey passed as query param: ?siteKey=cd_site_xxx
router.get('/config', async (req, res) => {
  try {
    const siteKey = req.query.siteKey;
    const origin  = req.get('origin') || null;

    const tenant = await resolveTenantBySiteKey(siteKey, origin);
    if (!tenant) {
      return res.status(403).json({ error: 'Invalid widget key or origin.' });
    }

    // Fetch WhatsApp display number for this tenant (active config, first match).
    const { rows: waRows } = await pool.query(
      `SELECT display_phone_number
         FROM whatsapp_configs
        WHERE tenant_id = $1 AND is_active = TRUE
        LIMIT 1`,
      [tenant.id],
    );

    // Normalize to wa.me format: digits only, no + or spaces (e.g. '447727394028').
    const rawPhone = waRows[0]?.display_phone_number || null;
    const whatsappPhone = rawPhone
      ? rawPhone.replace(/\D/g, '')   // strip everything except digits
      : null;

    // treatments: widget accepts free-text, return empty array for now.
    return res.json({
      clinicName:    tenant.name,
      treatments:    [],
      whatsappPhone: whatsappPhone || null,
      showWhatsapp:  !!whatsappPhone,
    });
  } catch (err) {
    console.error('[widget/config]', err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── POST /api/widget/booking ────────────────────────────────────────────────
// Body: { siteKey, firstName, lastName?, phone, email?, treatment?,
//         preferredDate?, message?, consent, _gotcha? }
router.post('/booking', async (req, res) => {
  try {
    if (isHoneypot(req.body)) return res.json({ ok: true });

    const { siteKey, firstName, lastName, phone, email,
            treatment, preferredDate, message, consent } = req.body;
    const origin = req.get('origin') || null;

    const tenant = await resolveTenantBySiteKey(siteKey, origin);
    if (!tenant) return res.status(403).json({ error: 'Invalid widget key or origin.' });

    if (!firstName || !phone) {
      return res.status(400).json({ error: 'firstName and phone are required.' });
    }

    const notes = [
      'Widget booking.',
      `Treatment: ${treatment || '—'}.`,
      `Preferred: ${preferredDate || '—'}.`,
      message || '',
    ].join(' ').trim();

    try {
      await createLead({
        tenantId:          tenant.id,
        firstName,
        lastName:          lastName  || '',
        phone,
        email:             email     || null,
        treatmentInterest: treatment || null,
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
        const dupNote = `\n---\n[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] Widget booking (repeat): Treatment: ${treatment || '—'}. Preferred: ${preferredDate || '—'}. ${message || ''}`.trimEnd();
        await pool.query(
          `UPDATE leads SET notes = COALESCE(notes, '') || $1
            WHERE tenant_id = $2 AND phone = $3 AND deleted_at IS NULL`,
          [dupNote, tenant.id, normalizedPhone],
        );
        return res.json({ ok: true, duplicate: true });
      }
      throw err;
    }
  } catch (err) {
    console.error('[widget/booking]', err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── POST /api/widget/contact ────────────────────────────────────────────────
// Body: { siteKey, firstName, lastName?, phone, email?, message?, consent, _gotcha? }
router.post('/contact', async (req, res) => {
  try {
    if (isHoneypot(req.body)) return res.json({ ok: true });

    const { siteKey, firstName, lastName, phone, email, message, consent } = req.body;
    const origin = req.get('origin') || null;

    const tenant = await resolveTenantBySiteKey(siteKey, origin);
    if (!tenant) return res.status(403).json({ error: 'Invalid widget key or origin.' });

    if (!firstName || !phone) {
      return res.status(400).json({ error: 'firstName and phone are required.' });
    }

    const notes = `Widget contact. ${message || ''}`.trim();

    try {
      await createLead({
        tenantId:          tenant.id,
        firstName,
        lastName:          lastName || '',
        phone,
        email:             email   || null,
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
        const dupNote = `\n---\n[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] Widget contact (repeat): ${message || ''}`.trimEnd();
        await pool.query(
          `UPDATE leads SET notes = COALESCE(notes, '') || $1
            WHERE tenant_id = $2 AND phone = $3 AND deleted_at IS NULL`,
          [dupNote, tenant.id, normalizedPhone],
        );
        return res.json({ ok: true, duplicate: true });
      }
      throw err;
    }
  } catch (err) {
    console.error('[widget/contact]', err.message);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;

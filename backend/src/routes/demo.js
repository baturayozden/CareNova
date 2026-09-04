/**
 * POST /api/demo  — public, no auth required
 * Saves a demo request to demo_requests table and sends two emails:
 *   1. Internal notification to baturay@carenova.ai
 *   2. Confirmation to the requester
 */

const express = require('express');
const router  = express.Router();
const { pool } = require('../db/index');
const { Resend } = require('resend');
const { authenticate, requireRole } = require('../middleware/auth');

const FROM          = 'CareNova AI <noreply@carenova.ai>';
const NOTIFY_EMAIL  = 'baturay@carenova.ai';
const ADMIN_URL     = process.env.ADMIN_URL || 'http://localhost:3001';

// ── Validation ────────────────────────────────────────────────────────────────

function validate({ name, email, clinic_name, city }) {
  const errors = [];
  if (!name        || name.trim().length        < 2) errors.push('Name is required (min 2 chars).');
  if (!email       || !email.includes('@'))          errors.push('Valid email is required.');
  if (!clinic_name || clinic_name.trim().length < 2) errors.push('Clinic name is required.');
  if (!city        || city.trim().length        < 2) errors.push('City is required.');
  return errors;
}

// ── Email helpers ─────────────────────────────────────────────────────────────

function shell(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f0ede8;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;">
      <tr><td style="background:#0d2b35;border-radius:16px 16px 0 0;padding:28px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#c9a96e;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
              <span style="color:#0d2b35;font-size:18px;font-weight:900;line-height:36px;display:block;">C</span>
            </td>
            <td style="padding-left:10px;vertical-align:middle;">
              <span style="color:#fff;font-size:20px;font-weight:700;">Care<span style="color:#c9a96e;">Dental</span></span>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="background:#fff;padding:36px 40px;border-left:1px solid #e8e2da;border-right:1px solid #e8e2da;">
        ${body}
      </td></tr>
      <tr><td style="background:#0d2b35;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
        <p style="margin:0;color:#c9a96e;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;">CareNova AI</p>
        <p style="margin:4px 0 0;color:#fff;opacity:.3;font-size:10px;">© ${new Date().getFullYear()} CareNova Ltd. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function notificationHtml({ name, email, clinic_name, city, phone, createdAt }) {
  const row = (label, value) =>
    `<tr>
      <td style="padding:8px 0;color:#6b7280;font-size:13px;width:130px;vertical-align:top;">${label}</td>
      <td style="padding:8px 0;color:#0d2b35;font-size:13px;font-weight:600;">${value || '—'}</td>
    </tr>`;

  return shell(`
    <p style="margin:0 0 4px;color:#c9a96e;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">New Demo Request</p>
    <h1 style="margin:0 0 20px;color:#0d2b35;font-size:24px;font-weight:800;letter-spacing:-.4px;">
      🎉 Someone wants a demo!
    </h1>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="background:#f8f4ef;border:1px solid #e8e2da;border-radius:12px;margin:0 0 24px;">
      <tr><td style="padding:20px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${row('Name',        name)}
          ${row('Email',       `<a href="mailto:${email}" style="color:#c9a96e;text-decoration:none;">${email}</a>`)}
          ${row('Clinic',      clinic_name)}
          ${row('City',        city)}
          ${row('Phone',       phone)}
          ${row('Submitted',   new Date(createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))}
        </table>
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr><td style="background:#c9a96e;border-radius:10px;">
        <a href="${ADMIN_URL}/demo-requests"
           style="display:inline-block;padding:13px 28px;color:#0d2b35;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">
          View in Dashboard →
        </a>
      </td></tr>
    </table>
  `);
}

function confirmationHtml({ name, clinic_name }) {
  return shell(`
    <h1 style="margin:0 0 8px;color:#0d2b35;font-size:26px;font-weight:800;letter-spacing:-.4px;">
      Thanks, ${name}! 🦷
    </h1>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      We've received your demo request for <strong style="color:#0d2b35;">${clinic_name}</strong>.
      One of our team will be in touch within <strong style="color:#0d2b35;">24 hours</strong> to
      schedule a personalised walkthrough.
    </p>
    <div style="background:#f8f4ef;border:1px solid #e8e2da;border-left:3px solid #c9a96e;border-radius:8px;padding:16px 20px;margin:0 0 28px;">
      <p style="margin:0;color:#0d2b35;font-size:14px;font-weight:600;">What to expect</p>
      <ul style="margin:8px 0 0;padding-left:20px;color:#6b7280;font-size:13px;line-height:1.8;">
        <li>A 20-minute live demo tailored to your clinic</li>
        <li>See how AI handles real dental enquiries in your language</li>
        <li>Pricing and onboarding Q&amp;A</li>
        <li>14-day free trial, no credit card required</li>
      </ul>
    </div>
    <p style="margin:0 0 6px;color:#9ca3af;font-size:12px;line-height:1.6;">
      Questions in the meantime? Reply to this email or reach us at
      <a href="mailto:hello@carenova.ai" style="color:#c9a96e;text-decoration:none;">hello@carenova.ai</a>
    </p>
  `);
}

async function sendEmails({ name, email, clinic_name, city, phone, createdAt }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[DEMO] No RESEND_API_KEY — skipping email send');
    return;
  }

  const resend = new Resend(apiKey);

  const [notify, confirm] = await Promise.allSettled([
    resend.emails.send({
      from:    FROM,
      to:      NOTIFY_EMAIL,
      subject: `🎉 New demo request — ${clinic_name} (${city})`,
      html:    notificationHtml({ name, email, clinic_name, city, phone, createdAt }),
      text:    `New demo request\n\nName: ${name}\nEmail: ${email}\nClinic: ${clinic_name}\nCity: ${city}\nPhone: ${phone || '—'}\nSubmitted: ${createdAt}`,
    }),
    resend.emails.send({
      from:    FROM,
      to:      email,
      subject: `We've received your demo request — CareNova AI`,
      html:    confirmationHtml({ name, clinic_name }),
      text:    `Hi ${name},\n\nThanks for requesting a demo for ${clinic_name}.\nWe'll be in touch within 24 hours.\n\n— CareNova AI Team`,
    }),
  ]);

  if (notify.status === 'rejected') console.error('[DEMO] Notification email error:', notify.reason);
  if (confirm.status === 'rejected') console.error('[DEMO] Confirmation email error:', confirm.reason);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/demo
router.post('/', async (req, res) => {
  const { name, email, clinic_name, city, phone } = req.body;

  const errors = validate({ name, email, clinic_name, city });
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  try {
    const { rows } = await pool.query(
      `INSERT INTO demo_requests (name, email, clinic_name, city, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name.trim(), email.toLowerCase().trim(), clinic_name.trim(), city.trim(), phone?.trim() || null],
    );

    const request = rows[0];

    // Fire-and-forget — don't block the HTTP response on email delivery
    sendEmails({
      name:        request.name,
      email:       request.email,
      clinic_name: request.clinic_name,
      city:        request.city,
      phone:       request.phone,
      createdAt:   request.created_at,
    }).catch(err => console.error('[DEMO] sendEmails error:', err));

    // Create platform-level notification (no tenant)
    const { createNotification } = require('./notifications');
    createNotification({
      tenantId: null,
      type:     'demo_request',
      title:    '📋 New Demo Request',
      message:  `${request.name} from ${request.clinic_name} (${request.city}) requested a demo.`,
      link:     '/demo-requests',
    });

    return res.status(201).json({ success: true, id: request.id });
  } catch (err) {
    console.error('[DEMO] DB error:', err.message);
    return res.status(500).json({ error: 'Failed to save demo request. Please try again.' });
  }
});

// GET /api/demo  (super_admin only)
router.get('/', ...requireRole('super_admin'), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM demo_requests ORDER BY created_at DESC`,
    );
    return res.json({ requests: rows });
  } catch (err) {
    console.error('[DEMO] GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch demo requests.' });
  }
});

// PATCH /api/demo/:id/status  (super_admin only)
// Accepts: { status?, notes? } — at least one required.
router.patch('/:id/status', ...requireRole('super_admin'), async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (status === undefined && notes === undefined) {
    return res.status(400).json({ error: 'Provide at least one of: status, notes.' });
  }

  if (status !== undefined && !['pending', 'contacted', 'converted'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be pending | contacted | converted.' });
  }

  const fields = [];
  const values = [];
  let i = 1;

  if (status !== undefined) { fields.push(`status = $${i++}`);       values.push(status); }
  if (notes  !== undefined) { fields.push(`notes  = $${i++}`);       values.push(notes);  }
  fields.push('updated_at = now()');
  values.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE demo_requests SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    return res.json({ request: rows[0] });
  } catch (err) {
    console.error('[DEMO] PATCH error:', err.message);
    return res.status(500).json({ error: 'Failed to update.' });
  }
});

module.exports = router;

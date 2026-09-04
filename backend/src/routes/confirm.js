'use strict';

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/index');

// ── Branded page renderer ─────────────────────────────────────────────────────
// Mirrors the shell() email template: navy header, white body, navy footer.

function page({ title, message, emoji, clinicName, clinicLogo, accent = '#2563EB' }) {
  const headerContent = clinicLogo
    ? `<img src="${clinicLogo}" alt="${clinicName || 'Clinic'}" style="max-width:180px;height:auto;display:block;margin:0 auto;" />`
    : clinicName
      ? `<span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#ffffff;">${clinicName}</span>`
      : `<span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#ffffff;">Care<span style="color:#60a5fa;">Dental</span></span>`;

  const footerLine = clinicName
    ? `<p style="margin:0 0 4px;color:#60a5fa;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;">${clinicName}</p>
       <p style="margin:0;color:#9ca3af;font-size:11px;">Powered by CareNova AI</p>`
    : `<p style="margin:0 0 4px;color:#60a5fa;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;">CareNova AI</p>
       <p style="margin:0;color:#9ca3af;font-size:11px;">AI that turns enquiries into appointments</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f1b32;border-radius:16px 16px 0 0;padding:24px 40px;text-align:center;">
              ${headerContent}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:48px 40px;text-align:center;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              <div style="font-size:52px;line-height:1;margin-bottom:20px;">${emoji}</div>
              <h1 style="margin:0 0 12px;color:#0d2b35;font-size:22px;font-weight:800;letter-spacing:-0.3px;">${title}</h1>
              <p style="margin:0;color:#6b7280;font-size:15px;line-height:1.6;">${message}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0f1b32;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              ${footerLine}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Fetch appointment + clinic branding by token ──────────────────────────────

async function findByToken(token) {
  const { rows } = await pool.query(
    `SELECT a.id, a.confirmation_status,
            t.name AS clinic_name, t.logo_url AS clinic_logo
     FROM appointments a
     JOIN tenants t ON t.id = a.tenant_id
     WHERE a.confirmation_token = $1`,
    [token],
  );
  return rows[0] || null;
}

// ── GET /api/appointments/confirm/:token ──────────────────────────────────────

router.get('/confirm/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const appt = await findByToken(token);

    if (!appt) {
      return res.status(404).send(page({
        title:   'Link not found',
        message: 'This confirmation link is invalid or has already expired. Please contact your clinic if you need help.',
        emoji:   '❓',
        clinicName: null, clinicLogo: null,
      }));
    }

    const brand = { clinicName: appt.clinic_name, clinicLogo: appt.clinic_logo };

    if (appt.confirmation_status === 'declined') {
      return res.send(page({
        ...brand,
        title:   'Appointment already cancelled',
        message: 'This appointment has already been cancelled. Please contact your clinic to rebook at a time that works for you.',
        emoji:   '📅',
        accent:  '#475569',
      }));
    }

    if (appt.confirmation_status === 'confirmed') {
      return res.send(page({
        ...brand,
        title:   'Already confirmed',
        message: 'Your appointment is already confirmed. We look forward to seeing you!',
        emoji:   '✅',
      }));
    }

    await pool.query(
      `UPDATE appointments
       SET confirmation_status = 'confirmed', confirmed_at = NOW()
       WHERE confirmation_token = $1 AND confirmation_status = 'pending'`,
      [token],
    );

    return res.send(page({
      ...brand,
      title:   'Appointment confirmed!',
      message: 'Thank you — your appointment is confirmed. We look forward to seeing you very soon.',
      emoji:   '✅',
    }));

  } catch (err) {
    console.error('[Confirm] error:', err.message);
    return res.status(500).send(page({
      title:   'Something went wrong',
      message: "We couldn't process your confirmation right now. Please try again or contact your clinic directly.",
      emoji:   '⚠️',
      clinicName: null, clinicLogo: null,
      accent:  '#d97706',
    }));
  }
});

// ── GET /api/appointments/decline/:token ──────────────────────────────────────

router.get('/decline/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const appt = await findByToken(token);

    if (!appt) {
      return res.status(404).send(page({
        title:   'Link not found',
        message: 'This link is invalid or has already expired. Please contact your clinic if you need help.',
        emoji:   '❓',
        clinicName: null, clinicLogo: null,
      }));
    }

    const brand = { clinicName: appt.clinic_name, clinicLogo: appt.clinic_logo };

    if (appt.confirmation_status === 'confirmed') {
      return res.send(page({
        ...brand,
        title:   'Appointment already confirmed',
        message: 'Your appointment is already confirmed. If you need to cancel, please contact your clinic directly — we will be happy to help.',
        emoji:   '✅',
      }));
    }

    if (appt.confirmation_status === 'declined') {
      return res.send(page({
        ...brand,
        title:   'Already cancelled',
        message: 'Your appointment has already been cancelled. Please contact your clinic whenever you are ready to rebook.',
        emoji:   '📅',
        accent:  '#475569',
      }));
    }

    await pool.query(
      `UPDATE appointments SET confirmation_status = 'declined'
       WHERE confirmation_token = $1 AND confirmation_status = 'pending'`,
      [token],
    );

    return res.send(page({
      ...brand,
      title:   'Appointment cancelled',
      message: 'No problem — your appointment has been cancelled. Please get in touch with the clinic whenever you are ready to rebook. We hope to see you soon.',
      emoji:   '📅',
      accent:  '#475569',
    }));

  } catch (err) {
    console.error('[Decline] error:', err.message);
    return res.status(500).send(page({
      title:   'Something went wrong',
      message: "We couldn't process your request right now. Please try again or contact your clinic directly.",
      emoji:   '⚠️',
      clinicName: null, clinicLogo: null,
      accent:  '#d97706',
    }));
  }
});

module.exports = router;

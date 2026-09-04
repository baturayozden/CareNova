/**
 * email.js — CareNova transactional email via Resend.
 *
 * Requires: RESEND_API_KEY env var.
 * Falls back to console logging when the key is absent (local dev).
 *
 * Exported functions:
 *   sendWelcomeEmail({ to, firstName, clinicName, password, loginUrl })
 *   sendPasswordResetEmail({ to, firstName, clinicName, newPassword, loginUrl })
 */

const { Resend } = require('resend');
const { pool }   = require('../db/index');

const FROM = 'CareNova AI <noreply@carenova.ai>';

// ── Shared HTML shell ─────────────────────────────────────────────────────────

function shell(bodyContent, opts = {}) {
  const { brand } = opts;

  const headerHtml = brand
    ? (brand.logoUrl
        ? `<img src="${brand.logoUrl}" alt="${brand.name}" style="max-width:200px;height:auto;display:block;margin:0 auto;" />`
        : `<span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#0a1628;">${brand.name}</span>`)
    : `<span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#ffffff;">Care<span style="color:#60a5fa;">Dental</span></span>`;

  const headerBg = brand
    ? 'background-color:#F7F5F0;border-bottom:1px solid #E5E0D8;'
    : 'background-color:#0f1b32;';

  const footerHtml = brand
    ? `<p style="margin:0 0 6px;color:#2563EB;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${brand.name}</p>
              ${brand.addressLine ? `<p style="margin:0 0 4px;color:#ffffff;opacity:0.35;font-size:11px;">${brand.addressLine}</p>` : ''}
              <p style="margin:8px 0 0;color:#ffffff;opacity:0.2;font-size:10px;">${brand.footerLegal}</p>`
    : `<p style="margin:0 0 6px;color:#60a5fa;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">CareNova AI</p>
              <p style="margin:0;color:#9ca3af;font-size:11px;">AI that turns enquiries into appointments · London, UK</p>
              <p style="margin:12px 0 0;color:#6b7280;font-size:10px;">© ${new Date().getFullYear()} CareNova Ltd. All rights reserved.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;">

          <!-- Header: dark navy brand -->
          <tr>
            <td style="${headerBg}border-radius:16px 16px 0 0;padding:24px 40px;text-align:center;">
              ${headerHtml}
            </td>
          </tr>

          <!-- Body: clean white -->
          <tr>
            <td style="background-color:#ffffff;padding:40px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer: dark navy brand -->
          <tr>
            <td style="background-color:#0f1b32;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              ${footerHtml}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Credential box (shared between welcome + reset) ──────────────────────────

function credentialBox({ email, password }) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="background-color:#f3f4f6;border:1px solid #e5e7eb;border-radius:12px;margin:24px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 14px;color:#1f2937;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
            Your Login Credentials
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:13px;width:120px;vertical-align:top;">Email</td>
              <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;">${email}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:middle;">Password</td>
              <td style="padding:8px 0;">
                <span style="display:inline-block;background-color:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:700;letter-spacing:0.12em;padding:6px 14px;border-radius:6px;">
                  ${password}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

// ── CTA button ────────────────────────────────────────────────────────────────

function ctaButton({ href, label }) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-radius:10px;background-color:#2563eb;">
          <a href="${href}"
             style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:-0.2px;">
            ${label} →
          </a>
        </td>
      </tr>
    </table>`;
}

// ── Welcome email ─────────────────────────────────────────────────────────────

function buildWelcomeHtml({ firstName, clinicName, to, password, loginUrl }) {
  const body = `
    <h1 style="margin:0 0 6px;color:#0d2b35;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
      Welcome, ${firstName}! 👋
    </h1>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      You've been added to <strong style="color:#0d2b35;">${clinicName}</strong> on the
      CareNova platform. Use the credentials below to sign in for the first time.
    </p>

    ${credentialBox({ email: to, password })}

    <p style="margin:0 0 24px;color:#6b7280;font-size:13px;line-height:1.6;">
      ⚠️ <strong style="color:#0d2b35;">Please change your password</strong> after your first login
      to keep your account secure.
    </p>

    ${ctaButton({ href: `${loginUrl}/login`, label: 'Log in to CareNova' })}

    <hr style="border:none;border-top:1px solid #f0ede8;margin:32px 0;" />
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
      If you weren't expecting this email, please ignore it or contact your clinic administrator.
    </p>`;

  return shell(body);
}

// ── Password reset email ──────────────────────────────────────────────────────

function buildPasswordResetHtml({ firstName, clinicName, to, newPassword, loginUrl }) {
  const body = `
    <h1 style="margin:0 0 6px;color:#0d2b35;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
      Password Reset 🔑
    </h1>
    <p style="margin:0 0 20px;color:#6b7280;font-size:15px;line-height:1.6;">
      Hi <strong style="color:#0d2b35;">${firstName}</strong>, an admin has reset your
      password for <strong style="color:#0d2b35;">${clinicName}</strong>.
      Your new temporary credentials are below.
    </p>

    ${credentialBox({ email: to, password: newPassword })}

    <p style="margin:0 0 24px;color:#6b7280;font-size:13px;line-height:1.6;">
      ⚠️ <strong style="color:#0d2b35;">Please change your password immediately</strong> after
      logging in to keep your account secure.
    </p>

    ${ctaButton({ href: `${loginUrl}/login`, label: 'Log in now' })}

    <hr style="border:none;border-top:1px solid #f0ede8;margin:32px 0;" />
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
      If you didn't request this reset, contact your clinic administrator immediately.
    </p>`;

  return shell(body);
}

// ── Plain-text fallbacks ──────────────────────────────────────────────────────

function welcomeText({ firstName, clinicName, to, password, loginUrl }) {
  return [
    `Welcome to CareNova, ${firstName}!`,
    ``,
    `You've been added to ${clinicName}.`,
    ``,
    `Email:    ${to}`,
    `Password: ${password}`,
    ``,
    `Log in at: ${loginUrl}/login`,
    ``,
    `Please change your password after your first login.`,
  ].join('\n');
}

function passwordResetText({ firstName, clinicName, to, newPassword, loginUrl }) {
  return [
    `Hi ${firstName},`,
    ``,
    `Your CareNova password for ${clinicName} has been reset.`,
    ``,
    `Email:        ${to}`,
    `New password: ${newPassword}`,
    ``,
    `Log in at: ${loginUrl}/login`,
    ``,
    `Please change your password immediately after logging in.`,
    `If you didn't request this, contact your clinic admin.`,
  ].join('\n');
}

// ── Date formatter (avoids new Date(string) timezone shift) ──────────────────

function formatEmailDate(d) {
  const dateStr = d instanceof Date
    ? d.toISOString().slice(0, 10)
    : String(d).slice(0, 10);
  const [y, m, day] = dateStr.split('-');
  const months = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  return `${parseInt(day, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

// ── Send helpers ──────────────────────────────────────────────────────────────

async function send({ to, subject, html, text, from: customFrom, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = customFrom || FROM;

  if (!apiKey) {
    // Dev fallback — log to console, never fail the caller
    console.log('[EMAIL] ─────────────────────────────────────────');
    console.log('[EMAIL] From   :', from);
    console.log('[EMAIL] To     :', to);
    console.log('[EMAIL] Subject:', subject);
    console.log('[EMAIL] Text   :\n', text);
    if (attachments?.length) console.log('[EMAIL] Attachments:', attachments.map(a => a.filename).join(', '));
    console.log('[EMAIL] ─────────────────────────────────────────');
    console.log('[EMAIL] (set RESEND_API_KEY to send real emails)');
    return;
  }

  const resend = new Resend(apiKey);
  const payload = { from, to, subject, html, text };
  if (attachments?.length) payload.attachments = attachments;
  const { error } = await resend.emails.send(payload);

  if (error) {
    console.error('[EMAIL] Resend error:', error);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
}

// ── Tenant brand resolver ─────────────────────────────────────────────────────

async function getTenantBrand(tenantId) {
  try {
    const { rows } = await pool.query(`
      SELECT t.name, t.logo_url, t.address, t.phone,
             tbp.trading_name, tbp.legal_entity_name
      FROM tenants t
      LEFT JOIN tenant_billing_profiles tbp ON tbp.tenant_id = t.id
      WHERE t.id = $1
    `, [tenantId]);
    const r = rows[0];
    if (!r) return null;
    const name        = r.trading_name || r.name;
    const addressLine = [r.address, r.phone].filter(Boolean).join(' · ') || null;
    return {
      name,
      logoUrl:     r.logo_url     || null,
      addressLine,
      footerLegal: `© ${new Date().getFullYear()} ${r.legal_entity_name || name}. All rights reserved.`,
      fromName:    name,
    };
  } catch (err) {
    console.error('[Email] getTenantBrand error:', err.message);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function sendWelcomeEmail({ to, firstName, clinicName, password, loginUrl }) {
  await send({
    to,
    subject: `Welcome to ${clinicName} — CareNova AI`,
    html:    buildWelcomeHtml({ firstName, clinicName, to, password, loginUrl }),
    text:    welcomeText({ firstName, clinicName, to, password, loginUrl }),
  });
}

async function sendPasswordResetEmail({ to, firstName, clinicName, newPassword, loginUrl }) {
  await send({
    to,
    subject: `Your CareNova password has been reset`,
    html:    buildPasswordResetHtml({ firstName, clinicName, to, newPassword, loginUrl }),
    text:    passwordResetText({ firstName, clinicName, to, newPassword, loginUrl }),
  });
}

async function sendAppointmentAlert({ to, clinicName, patientName, treatment, date, time }) {
  if (!to) return; // notification_email yoksa sessizce atla
  const appUrl      = process.env.APP_URL || 'https://app.carenova.ai';
  const ctaHref     = `${appUrl}/appointments`;
  const displayDate = date ? formatEmailDate(date) : '-';
  const displayTime = time ? String(time).slice(0, 5) : '-';
  const body = `
    <h2 style="margin:0 0 12px;color:#0d2b35;font-size:22px;font-weight:700;">New appointment booked</h2>
    <p style="margin:0 0 16px;color:#475569;">Your AI coordinator just booked a new appointment${clinicName ? ` for <strong>${clinicName}</strong>` : ''}. It's marked <strong>pending</strong> — review and confirm it in your dashboard.</p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0 20px;">
      <tr><td style="padding:6px 0;color:#94a3b8;">Patient</td><td style="padding:6px 0;text-align:right;font-weight:600;">${patientName || '-'}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Treatment</td><td style="padding:6px 0;text-align:right;font-weight:600;">${treatment || '-'}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Date</td><td style="padding:6px 0;text-align:right;font-weight:600;">${displayDate}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Time</td><td style="padding:6px 0;text-align:right;font-weight:600;">${displayTime}</td></tr>
    </table>
    <a href="${ctaHref}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;">Review in dashboard</a>
  `;
  try {
    await send({
      to,
      subject: `New appointment — ${patientName || 'patient'}${date ? ` on ${formatEmailDate(date)}` : ''}`,
      html: shell(body),
    });
  } catch (err) {
    console.error('[Email] sendAppointmentAlert failed:', err.message);
  }
}

async function sendHotLeadAlert({ recipients, leadName, leadPhone, score, label, reasoning, leadId }) {
  if (!recipients || recipients.length === 0) return;
  const appUrl  = process.env.APP_URL || 'https://app.carenova.ai';
  const ctaHref = `${appUrl}/leads?lead=${leadId}`;
  const body = `
    <h2 style="margin:0 0 12px;color:#0d2b35;font-size:22px;font-weight:700;">🔥 Hot lead — act now</h2>
    <p style="margin:0 0 16px;color:#475569;">Your AI coordinator flagged a high-intent lead. They've just crossed into <strong>Hot</strong> — this is the best moment to reach out directly.</p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0 20px;">
      <tr><td style="padding:6px 0;color:#94a3b8;">Patient</td><td style="padding:6px 0;text-align:right;font-weight:600;">${leadName || '-'}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Phone</td><td style="padding:6px 0;text-align:right;font-weight:600;">${leadPhone || '-'}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Score</td><td style="padding:6px 0;text-align:right;font-weight:600;">${score}/100</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Status</td><td style="padding:6px 0;text-align:right;font-weight:600;">${label}</td></tr>
    </table>
    ${reasoning ? `<p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;border-left:3px solid #2563EB;padding-left:12px;"><strong style="color:#0d2b35;">Why now:</strong> ${reasoning}</p>` : ''}
    <a href="${ctaHref}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;">View lead</a>
  `;
  try {
    await send({
      to:      recipients,
      subject: `🔥 Hot lead — ${leadName || 'patient'} is ready to book`,
      html:    shell(body),
    });
    console.log(`[Email] hot-lead alert sent to ${recipients.length} recipient(s) for lead ${leadId}`);
  } catch (err) {
    console.error('[Email] sendHotLeadAlert failed:', err.message);
  }
}

async function sendEscalationAlert({ recipients, leadName, leadPhone, message, clinicName, leadId }) {
  if (!recipients || recipients.length === 0) return;
  const appUrl  = process.env.APP_URL || 'https://app.carenova.ai';
  const ctaHref = leadId ? `${appUrl}/leads?lead=${leadId}` : `${appUrl}/leads`;
  const body = `
    <div style="background:#dc2626;border-radius:8px;padding:14px 20px;margin:0 0 20px;">
      <h2 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">⚠️ Urgent — patient needs attention</h2>
    </div>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;">
      A patient${clinicName ? ` at <strong style="color:#0d2b35;">${clinicName}</strong>` : ''} requires <strong>immediate attention</strong>. The AI has paused follow-ups — please contact them directly as soon as possible.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0 20px;">
      <tr><td style="padding:6px 0;color:#94a3b8;">Patient</td><td style="padding:6px 0;text-align:right;font-weight:600;">${leadName || '-'}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Phone</td><td style="padding:6px 0;text-align:right;font-weight:600;">${leadPhone ? '+' + leadPhone : '-'}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Message</td><td style="padding:6px 0;text-align:right;font-weight:600;">"${message || '-'}"</td></tr>
    </table>
    <a href="${ctaHref}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;">Reply now →</a>
  `;
  try {
    await send({
      to:      recipients,
      subject: `⚠️ Urgent: ${leadName || 'A patient'} needs immediate attention`,
      html:    shell(body),
      text:    `URGENT\n\nPatient: ${leadName || '-'}\nPhone: ${leadPhone ? '+' + leadPhone : '-'}\nMessage: "${message || ''}"\n\nThe AI has paused follow-ups. Please contact the patient immediately.\n\n${ctaHref}`,
    });
    console.log(`[Email] escalation alert sent to ${recipients.length} recipient(s)`);
  } catch (err) {
    console.error('[Email] sendEscalationAlert failed:', err.message);
  }
}

async function sendBankDetailsEmail({ to, tenantId, clinicDisplayName, patientName, amount, bankName, accountName, sortCode, accountNumber, reference }) {
  const brand = tenantId ? await getTenantBrand(tenantId) : null;
  const from  = brand ? `${brand.fromName} <noreply@carenova.ai>` : FROM;
  const amountStr = amount ? `€${Number(amount).toFixed(2)}` : '';

  function detailRow(label, value) {
    if (!value) return '';
    return `
      <tr>
        <td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px;vertical-align:top;">${label}</td>
        <td style="padding:8px 0;color:#0d2b35;font-size:13px;font-weight:600;">${value}</td>
      </tr>`;
  }

  const body = `
    <h1 style="margin:0 0 8px;color:#0d2b35;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
      Payment details from ${clinicDisplayName}
    </h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      Hi ${patientName || 'there'}, please find the bank transfer details${amountStr ? ` for your <strong style="color:#0d2b35;">${amountStr}</strong> payment` : ''} below.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="background-color:#f8f4ef;border:1px solid #e8e2da;border-radius:12px;margin:0 0 24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 14px;color:#0d2b35;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
            Bank Transfer Details
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            ${detailRow('Bank', bankName)}
            ${detailRow('Account name', accountName)}
            ${detailRow('Sort code', sortCode)}
            ${detailRow('Account number', accountNumber)}
            ${detailRow('Reference', reference)}
            ${amountStr ? detailRow('Amount', amountStr) : ''}
          </table>
        </td>
      </tr>
    </table>

    <hr style="border:none;border-top:1px solid #f0ede8;margin:32px 0;" />
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
      Please use the <strong style="color:#0d2b35;">exact reference</strong> so we can match your payment.
      If you did not expect this message, please contact ${clinicDisplayName} directly.
    </p>`;

  const textLines = [
    `Payment details from ${clinicDisplayName}`,
    ``,
    `Hi ${patientName || 'there'}, please find your bank transfer details below.`,
    ``,
    bankName       ? `Bank:           ${bankName}`       : '',
    accountName    ? `Account name:   ${accountName}`    : '',
    sortCode       ? `Sort code:      ${sortCode}`       : '',
    accountNumber  ? `Account number: ${accountNumber}`  : '',
    reference      ? `Reference:      ${reference}`      : '',
    amountStr      ? `Amount:         ${amountStr}`      : '',
    ``,
    `Please use the exact reference so we can match your payment.`,
    `If you did not expect this message, contact ${clinicDisplayName}.`,
  ].filter(l => l !== undefined).join('\n');

  await send({
    to,
    from,
    subject: `Payment details from ${clinicDisplayName}`,
    html:    shell(body, { brand }),
    text:    textLines,
  });
}

async function sendForgotPasswordEmail({ to, resetUrl, firstName }) {
  if (!to) return;
  const displayName = firstName || 'there';
  const body = `
    <h1 style="margin:0 0 6px;color:#0d2b35;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
      Reset your password
    </h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      Hi <strong style="color:#0d2b35;">${displayName}</strong>, we received a request to reset your CareNova password.
    </p>

    ${ctaButton({ href: resetUrl, label: 'Reset password' })}

    <hr style="border:none;border-top:1px solid #f0ede8;margin:32px 0;" />
    <p style="margin:0 0 12px;color:#9ca3af;font-size:12px;line-height:1.6;">
      This link expires in <strong style="color:#0d2b35;">1 hour</strong>. If you didn't request this, you can safely ignore this email.
    </p>
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
      If the button doesn't work, copy and paste this link:<br />
      <a href="${resetUrl}" style="color:#2563EB;word-break:break-all;">${resetUrl}</a>
    </p>`;
  try {
    await send({
      to,
      subject: 'Reset your CareNova password',
      html:    shell(body),
      text:    [
        `Reset your CareNova password`,
        ``,
        `Hi ${displayName},`,
        ``,
        `We received a request to reset your CareNova password.`,
        ``,
        `Reset link: ${resetUrl}`,
        ``,
        `This link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
      ].join('\n'),
    });
    console.log('[Email] sendForgotPasswordEmail sent to', to);
  } catch (err) {
    console.error('[Email] sendForgotPasswordEmail failed:', err.message);
  }
}

async function sendPaymentLinkEmail({ to, tenantId, clinicDisplayName, patientName, amount, paymentUrl }) {
  const brand = tenantId ? await getTenantBrand(tenantId) : null;
  const from  = brand ? `${brand.fromName} <noreply@carenova.ai>` : FROM;
  const amountStr = amount ? `€${Number(amount).toFixed(2)}` : '';
  const body = `
    <h1 style="margin:0 0 8px;color:#0d2b35;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
      Complete your payment
    </h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
      Hi ${patientName || 'there'}, ${clinicDisplayName} has sent you a secure payment link${amountStr ? ` for <strong style="color:#0d2b35;">${amountStr}</strong>` : ''}.
      Click the button below to pay safely via card.
    </p>

    ${ctaButton({ href: paymentUrl, label: 'Pay now' })}

    <hr style="border:none;border-top:1px solid #f0ede8;margin:32px 0;" />
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
      This link is for your personal use only — do not share it.
      If you did not expect this message, please contact ${clinicDisplayName} directly.
    </p>`;

  const text = [
    `Complete your payment — ${clinicDisplayName}`,
    ``,
    `Hi ${patientName || 'there'},`,
    ``,
    `${clinicDisplayName} has sent you a secure payment link${amountStr ? ` for ${amountStr}` : ''}.`,
    ``,
    `Pay now: ${paymentUrl}`,
    ``,
    `Do not share this link. If you didn't expect this, contact ${clinicDisplayName}.`,
  ].join('\n');

  await send({
    to,
    from,
    subject: `Complete your payment${amountStr ? ` of ${amountStr}` : ''} — ${clinicDisplayName}`,
    html:    shell(body, { brand }),
    text,
  });
}

// ── Appointment reminder email (patient-facing) ───────────────────────────────

async function sendAppointmentReminderEmail({
  to, tenantId, patientName, clinicName, kind,
  appointmentDate, appointmentTime, branchName, branchPostcode,
  confirmLink, declineLink,
}) {
  const brand       = tenantId ? await getTenantBrand(tenantId) : null;
  const from        = brand ? `${brand.fromName} <noreply@carenova.ai>` : FROM;
  const displayName = brand?.name || clinicName || 'Your clinic';
  const kindLabel   = kind === '1day' ? 'tomorrow' : 'today';
  const kindTitle   = kind === '1day' ? 'Tomorrow'  : 'Today';
  const dateStr     = appointmentDate ? formatEmailDate(appointmentDate) : '-';
  const timeStr     = appointmentTime ? String(appointmentTime).slice(0, 5) : '-';
  const branchRow   = branchName
    ? `<tr><td style="padding:6px 0;color:#94a3b8;">Location</td><td style="padding:6px 0;text-align:right;font-weight:600;">${branchName}${branchPostcode ? ', ' + branchPostcode : ''}</td></tr>`
    : '';

  const body = `
    <h2 style="margin:0 0 8px;color:#0d2b35;font-size:22px;font-weight:700;">
      Appointment reminder — ${kindTitle}
    </h2>
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      Hi ${patientName ? `<strong>${patientName}</strong>` : 'there'} 👋 Just a friendly reminder that you have a dental appointment <strong>${kindLabel}</strong> at <strong>${displayName}</strong>.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr><td style="padding:6px 0;color:#94a3b8;">Date</td><td style="padding:6px 0;text-align:right;font-weight:600;">${dateStr}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Time</td><td style="padding:6px 0;text-align:right;font-weight:600;">${timeStr}</td></tr>
      ${branchRow}
      <tr><td style="padding:6px 0;color:#94a3b8;">Clinic</td><td style="padding:6px 0;text-align:right;font-weight:600;">${displayName}</td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="border-radius:10px;background-color:#2563EB;">
          <a href="${confirmLink}"
             style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:-0.2px;">
            Confirm my appointment →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;">
      <a href="${declineLink}" style="color:#6b7280;font-size:13px;">Can't make it? Cancel here</a>
    </p>
    <hr style="border:none;border-top:1px solid #f0ede8;margin:24px 0;" />
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
      If you didn't book an appointment with us, you can safely ignore this email.
    </p>`;

  const text = [
    `Appointment reminder — ${kindTitle}`,
    ``,
    `Hi ${patientName || 'there'},`,
    ``,
    `You have a dental appointment ${kindLabel} at ${displayName}.`,
    ``,
    `Date:   ${dateStr}`,
    `Time:   ${timeStr}`,
    branchName ? `Where:  ${branchName}${branchPostcode ? ', ' + branchPostcode : ''}` : null,
    ``,
    `Confirm your appointment: ${confirmLink}`,
    `Can't make it?  Cancel: ${declineLink}`,
  ].filter(l => l !== null).join('\n');

  await send({
    to, from,
    subject: `Reminder: your dental appointment is ${kindLabel} — ${displayName}`,
    html:    shell(body, { brand }),
    text,
  });
}

// ── Booking REQUEST email (sent immediately on creation — no confirm link) ────
// Tone: "we received your request, team will confirm shortly."

async function sendBookingRequestEmail({
  to, tenantId, patientName, clinicName,
  appointmentDate, appointmentTime, branchName, branchPostcode, treatmentType,
}) {
  const brand       = tenantId ? await getTenantBrand(tenantId) : null;
  const from        = brand ? `${brand.fromName} <noreply@carenova.ai>` : FROM;
  const displayName = brand?.name || clinicName || 'Your clinic';
  const dateStr     = appointmentDate ? formatEmailDate(appointmentDate) : '-';
  const timeStr     = appointmentTime ? String(appointmentTime).slice(0, 5) : '-';

  const treatmentRow = treatmentType
    ? `<tr><td style="padding:6px 0;color:#94a3b8;">Treatment</td><td style="padding:6px 0;text-align:right;font-weight:600;">${treatmentType}</td></tr>`
    : '';
  const branchRow = branchName
    ? `<tr><td style="padding:6px 0;color:#94a3b8;">Location</td><td style="padding:6px 0;text-align:right;font-weight:600;">${branchName}${branchPostcode ? ', ' + branchPostcode : ''}</td></tr>`
    : '';

  const body = `
    <h2 style="margin:0 0 8px;color:#0d2b35;font-size:22px;font-weight:700;">
      We've received your request
    </h2>
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      Hi ${patientName ? `<strong>${patientName}</strong>` : 'there'} 👋 Thank you for reaching out to <strong>${displayName}</strong>. We've received your appointment request and our team will review and confirm it shortly.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr><td style="padding:6px 0;color:#94a3b8;">Requested date</td><td style="padding:6px 0;text-align:right;font-weight:600;">${dateStr}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Requested time</td><td style="padding:6px 0;text-align:right;font-weight:600;">${timeStr}</td></tr>
      ${treatmentRow}
      ${branchRow}
      <tr><td style="padding:6px 0;color:#94a3b8;">Clinic</td><td style="padding:6px 0;text-align:right;font-weight:600;">${displayName}</td></tr>
    </table>
    <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;border-left:3px solid #2563EB;padding-left:12px;">
      You will receive a confirmation once our team has approved your request. We aim to respond as quickly as possible.
    </p>
    <hr style="border:none;border-top:1px solid #f0ede8;margin:24px 0;" />
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
      If you didn't make this request, please contact ${displayName} directly.
    </p>`;

  const text = [
    `We've received your appointment request — ${displayName}`,
    ``,
    `Hi ${patientName || 'there'},`,
    ``,
    `Thank you for your request at ${displayName}. Our team will confirm your appointment shortly.`,
    ``,
    `Requested date: ${dateStr}`,
    `Requested time: ${timeStr}`,
    treatmentType ? `Treatment:      ${treatmentType}` : null,
    branchName    ? `Location:       ${branchName}${branchPostcode ? ', ' + branchPostcode : ''}` : null,
    ``,
    `You will receive a follow-up once your appointment is confirmed.`,
  ].filter(l => l !== null).join('\n');

  await send({
    to, from,
    subject: `We've received your appointment request — ${displayName}`,
    html:    shell(body, { brand }),
    text,
  });
}

// ── Approval notification email (sent when clinic approves — includes confirm link) ──

async function sendApprovalNotificationEmail({
  to, tenantId, patientName, clinicName,
  appointmentDate, appointmentTime, branchName, branchPostcode,
  treatmentType, confirmLink, declineLink,
}) {
  const brand       = tenantId ? await getTenantBrand(tenantId) : null;
  const from        = brand ? `${brand.fromName} <noreply@carenova.ai>` : FROM;
  const displayName = brand?.name || clinicName || 'Your clinic';
  const dateStr     = appointmentDate ? formatEmailDate(appointmentDate) : '-';
  const timeStr     = appointmentTime ? String(appointmentTime).slice(0, 5) : '-';

  const treatmentRow = treatmentType
    ? `<tr><td style="padding:6px 0;color:#94a3b8;">Treatment</td><td style="padding:6px 0;text-align:right;font-weight:600;">${treatmentType}</td></tr>`
    : '';
  const branchRow = branchName
    ? `<tr><td style="padding:6px 0;color:#94a3b8;">Location</td><td style="padding:6px 0;text-align:right;font-weight:600;">${branchName}${branchPostcode ? ', ' + branchPostcode : ''}</td></tr>`
    : '';

  const body = `
    <h2 style="margin:0 0 8px;color:#0d2b35;font-size:22px;font-weight:700;">
      Your appointment is approved!
    </h2>
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      Hi ${patientName ? `<strong>${patientName}</strong>` : 'there'} 🎉 Great news — <strong>${displayName}</strong> has approved your appointment. Please confirm your attendance using the button below.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr><td style="padding:6px 0;color:#94a3b8;">Date</td><td style="padding:6px 0;text-align:right;font-weight:600;">${dateStr}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Time</td><td style="padding:6px 0;text-align:right;font-weight:600;">${timeStr}</td></tr>
      ${treatmentRow}
      ${branchRow}
      <tr><td style="padding:6px 0;color:#94a3b8;">Clinic</td><td style="padding:6px 0;text-align:right;font-weight:600;">${displayName}</td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="border-radius:10px;background-color:#2563EB;">
          <a href="${confirmLink}"
             style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:-0.2px;">
            Confirm my attendance →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;">
      <a href="${declineLink}" style="color:#6b7280;font-size:13px;">Can't make it? Cancel here</a>
    </p>
    <hr style="border:none;border-top:1px solid #f0ede8;margin:24px 0;" />
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
      If you didn't book this appointment, please contact ${displayName} directly.
    </p>`;

  const text = [
    `Your appointment is approved — ${displayName}`,
    ``,
    `Hi ${patientName || 'there'},`,
    ``,
    `${displayName} has approved your appointment. Please confirm your attendance.`,
    ``,
    `Date:      ${dateStr}`,
    `Time:      ${timeStr}`,
    treatmentType ? `Treatment: ${treatmentType}` : null,
    branchName    ? `Where:     ${branchName}${branchPostcode ? ', ' + branchPostcode : ''}` : null,
    ``,
    `Confirm your attendance: ${confirmLink}`,
    `Can't make it?           ${declineLink}`,
  ].filter(l => l !== null).join('\n');

  await send({
    to, from,
    subject: `Your appointment is confirmed — ${dateStr} at ${timeStr} | ${displayName}`,
    html:    shell(body, { brand }),
    text,
  });
}

// ── Rejection email (gentle reschedule invite — no confirm link) ─────────────

async function sendRejectionEmail({
  to, tenantId, patientName, clinicName,
  appointmentDate, appointmentTime, branchName, branchPostcode, treatmentType,
}) {
  const brand       = tenantId ? await getTenantBrand(tenantId) : null;
  const from        = brand ? `${brand.fromName} <noreply@carenova.ai>` : FROM;
  const displayName = brand?.name || clinicName || 'Your clinic';
  const dateStr     = appointmentDate ? formatEmailDate(appointmentDate) : '-';
  const timeStr     = appointmentTime ? String(appointmentTime).slice(0, 5) : '-';
  const firstName   = patientName ? patientName.split(' ')[0] : 'there';

  const treatmentRow = treatmentType
    ? `<tr><td style="padding:6px 0;color:#94a3b8;">Treatment</td><td style="padding:6px 0;text-align:right;font-weight:600;">${treatmentType}</td></tr>`
    : '';
  const branchRow = branchName
    ? `<tr><td style="padding:6px 0;color:#94a3b8;">Location</td><td style="padding:6px 0;text-align:right;font-weight:600;">${branchName}${branchPostcode ? ', ' + branchPostcode : ''}</td></tr>`
    : '';

  const body = `
    <h2 style="margin:0 0 8px;color:#0d2b35;font-size:22px;font-weight:700;">
      We're sorry — that time isn't available
    </h2>
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      Hi <strong>${firstName}</strong> 👋 Unfortunately, <strong>${displayName}</strong> is unable to accommodate your appointment request at the time below. We're sorry for the inconvenience.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr><td style="padding:6px 0;color:#94a3b8;">Requested date</td><td style="padding:6px 0;text-align:right;font-weight:600;">${dateStr}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Requested time</td><td style="padding:6px 0;text-align:right;font-weight:600;">${timeStr}</td></tr>
      ${treatmentRow}
      ${branchRow}
    </table>
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;border-left:3px solid #2563EB;padding-left:12px;">
      We'd love to find another time that works for you. Please reply to this email or message us on WhatsApp — just let us know which days and times suit you best, and we'll get something booked.
    </p>
    <hr style="border:none;border-top:1px solid #f0ede8;margin:24px 0;" />
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
      If you have any questions, please contact ${displayName} directly.
    </p>`;

  const text = [
    `We're sorry — that time isn't available | ${displayName}`,
    ``,
    `Hi ${firstName},`,
    ``,
    `Unfortunately, ${displayName} is unable to accommodate your appointment at:`,
    `Date: ${dateStr}`,
    `Time: ${timeStr}`,
    treatmentType ? `Treatment: ${treatmentType}` : null,
    ``,
    `We'd love to find another time that works for you.`,
    `Please reply and let us know which days and times suit you — we'll get it sorted.`,
  ].filter(l => l !== null).join('\n');

  await send({
    to, from,
    subject: `We're sorry — let's find another time | ${displayName}`,
    html:    shell(body, { brand }),
    text,
  });
}

// ── Booking confirmation email (kept for manual route-created appointments) ───

async function sendBookingConfirmationEmail({
  to, tenantId, patientName, clinicName,
  appointmentDate, appointmentTime, branchName, branchPostcode,
  treatmentType, confirmLink, declineLink,
}) {
  const brand       = tenantId ? await getTenantBrand(tenantId) : null;
  const from        = brand ? `${brand.fromName} <noreply@carenova.ai>` : FROM;
  const displayName = brand?.name || clinicName || 'Your clinic';
  const dateStr     = appointmentDate ? formatEmailDate(appointmentDate) : '-';
  const timeStr     = appointmentTime ? String(appointmentTime).slice(0, 5) : '-';

  const treatmentRow = treatmentType
    ? `<tr><td style="padding:6px 0;color:#94a3b8;">Treatment</td><td style="padding:6px 0;text-align:right;font-weight:600;">${treatmentType}</td></tr>`
    : '';
  const branchRow = branchName
    ? `<tr><td style="padding:6px 0;color:#94a3b8;">Location</td><td style="padding:6px 0;text-align:right;font-weight:600;">${branchName}${branchPostcode ? ', ' + branchPostcode : ''}</td></tr>`
    : '';

  const body = `
    <h2 style="margin:0 0 8px;color:#0d2b35;font-size:22px;font-weight:700;">
      Your appointment is confirmed!
    </h2>
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
      Hi ${patientName ? `<strong>${patientName}</strong>` : 'there'} 👋 Great news — your appointment at <strong>${displayName}</strong> has been booked. See you soon!
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr><td style="padding:6px 0;color:#94a3b8;">Date</td><td style="padding:6px 0;text-align:right;font-weight:600;">${dateStr}</td></tr>
      <tr><td style="padding:6px 0;color:#94a3b8;">Time</td><td style="padding:6px 0;text-align:right;font-weight:600;">${timeStr}</td></tr>
      ${treatmentRow}
      ${branchRow}
      <tr><td style="padding:6px 0;color:#94a3b8;">Clinic</td><td style="padding:6px 0;text-align:right;font-weight:600;">${displayName}</td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="border-radius:10px;background-color:#2563EB;">
          <a href="${confirmLink}"
             style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:-0.2px;">
            Confirm my attendance →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;">
      <a href="${declineLink}" style="color:#6b7280;font-size:13px;">Need to cancel? Click here</a>
    </p>
    <hr style="border:none;border-top:1px solid #f0ede8;margin:24px 0;" />
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
      If you didn't book this appointment, please contact ${displayName} directly.
    </p>`;

  const text = [
    `Your appointment is booked — ${displayName}`,
    ``,
    `Hi ${patientName || 'there'},`,
    ``,
    `Your appointment at ${displayName} has been booked.`,
    ``,
    `Date:      ${dateStr}`,
    `Time:      ${timeStr}`,
    treatmentType ? `Treatment: ${treatmentType}` : null,
    branchName    ? `Where:     ${branchName}${branchPostcode ? ', ' + branchPostcode : ''}` : null,
    ``,
    `Confirm your attendance: ${confirmLink}`,
    `Need to cancel?          ${declineLink}`,
  ].filter(l => l !== null).join('\n');

  await send({
    to, from,
    subject: `Appointment booked — ${dateStr} at ${timeStr} | ${displayName}`,
    html:    shell(body, { brand }),
    text,
  });
}

// ── Invoice email ─────────────────────────────────────────────────────────────

async function sendInvoiceEmail({ to, invoiceNumber, amount, clinicName, pdfBuffer, brand }) {
  const displayName = brand?.name || clinicName || 'Your clinic';
  const amountFmt   = `€${parseFloat(amount).toFixed(2)}`;
  const subject     = `Invoice ${invoiceNumber} from ${displayName}`;

  const body = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">
      Please find your invoice attached to this email.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0"
           style="width:100%;border-collapse:collapse;margin:0 0 24px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 14px;font-size:13px;color:#6b7280;border:1px solid #e5e7eb;width:50%;">Invoice number</td>
        <td style="padding:10px 14px;font-size:13px;color:#111827;font-weight:600;border:1px solid #e5e7eb;">${invoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#6b7280;border:1px solid #e5e7eb;">Amount due</td>
        <td style="padding:10px 14px;font-size:13px;color:#111827;font-weight:600;border:1px solid #e5e7eb;">${amountFmt}</td>
      </tr>
    </table>
    <p style="margin:0;color:#6b7280;font-size:13px;">
      If you have any questions about this invoice, please contact us and quote the invoice number above.
    </p>
  `;

  const attachments = pdfBuffer
    ? [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer.toString('base64') }]
    : [];

  await send({
    to,
    subject,
    html:  shell(body, { brand }),
    text:  `Invoice ${invoiceNumber} from ${displayName}\nAmount due: ${amountFmt}\n\nPlease find your invoice attached.`,
    attachments,
  });
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail, sendForgotPasswordEmail, sendAppointmentAlert, sendHotLeadAlert, sendEscalationAlert, sendBankDetailsEmail, sendPaymentLinkEmail, sendAppointmentReminderEmail, sendBookingRequestEmail, sendApprovalNotificationEmail, sendRejectionEmail, sendBookingConfirmationEmail, sendInvoiceEmail, shell, getTenantBrand };

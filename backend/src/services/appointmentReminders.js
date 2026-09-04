'use strict';

const crypto = require('crypto');
const { pool } = require('../db/index');
const { sendSms } = require('../utils/sms');
const {
  sendAppointmentReminderEmail,
  sendBookingRequestEmail,
  sendApprovalNotificationEmail,
  sendRejectionEmail,
} = require('../utils/email');

// ── SQL shared by both reminder windows ──────────────────────────────────────
// Only approved appointments get reminders (clinic must approve first).

const APPT_COLS = `
  a.id, a.tenant_id, a.patient_name, a.patient_phone, a.patient_email,
  a.appointment_date, a.appointment_time, a.treatment_type,
  a.confirmation_token, a.confirmation_status,
  a.reminder_1day_sent_at, a.reminder_sameday_sent_at,
  b.name   AS branch_name,     b.postcode AS branch_postcode,
  t.name   AS clinic_name,     t.timezone,
  l.phone  AS lead_phone
FROM appointments a
JOIN  tenants t         ON t.id = a.tenant_id AND t.deleted_at IS NULL AND t.status = 'active'
LEFT JOIN clinic_branches b ON b.id = a.branch_id
LEFT JOIN leads l           ON l.id = a.lead_id
WHERE a.status NOT IN ('cancelled', 'no_show', 'completed')
  AND a.clinic_status = 'approved'
  AND a.confirmation_status <> 'declined'
`;

// ── Ensure confirmation token (lazy — only generated on approval) ─────────────

async function resolveToken(appt) {
  let token = appt.confirmation_token;
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    const { rowCount } = await pool.query(
      `UPDATE appointments SET confirmation_token = $1
       WHERE id = $2 AND confirmation_token IS NULL`,
      [token, appt.id],
    );
    if (rowCount === 0) {
      const { rows } = await pool.query(
        `SELECT confirmation_token FROM appointments WHERE id = $1`, [appt.id],
      );
      token = rows[0]?.confirmation_token || null;
    }
  }
  return token;
}

// ── Send one reminder (email + SMS, fire-and-forget) ─────────────────────────

async function sendAppointmentReminder(appt, kind) {
  const token = await resolveToken(appt);
  if (!token) {
    console.error(`[Reminders] could not resolve token for appt ${appt.id}`);
    return;
  }

  const apiBase      = process.env.API_BASE_URL || 'https://api.carenova.ai';
  const confirmLink  = `${apiBase}/api/appointments/confirm/${token}`;
  const declineLink  = `${apiBase}/api/appointments/decline/${token}`;

  const patientPhone = appt.patient_phone || appt.lead_phone;
  const patientEmail = appt.patient_email;
  const kindLabel    = kind === '1day' ? 'tomorrow' : 'today';
  const displayTime  = String(appt.appointment_time).slice(0, 5);
  const branchLine   = appt.branch_name
    ? `${appt.branch_name}${appt.branch_postcode ? ', ' + appt.branch_postcode : ''}`
    : null;

  if (patientEmail) {
    sendAppointmentReminderEmail({
      to:              patientEmail,
      tenantId:        appt.tenant_id,
      patientName:     appt.patient_name,
      clinicName:      appt.clinic_name,
      kind,
      appointmentDate: String(appt.appointment_date).slice(0, 10),
      appointmentTime: displayTime,
      branchName:      appt.branch_name     || null,
      branchPostcode:  appt.branch_postcode || null,
      confirmLink,
      declineLink,
    }).catch(err => console.error('[Reminders] email failed:', err.message));
  }

  if (patientPhone) {
    const smsBody = [
      `${appt.clinic_name}: Reminder — your appointment is ${kindLabel} at ${displayTime}`,
      branchLine ? `📍 ${branchLine}` : null,
      `Confirm: ${confirmLink}`,
    ].filter(Boolean).join('. ');

    sendSms(appt.tenant_id, patientPhone, smsBody)
      .catch(err => console.error('[Reminders] sms failed:', err.message));
  }

  console.log(`[Reminders] ${kind} reminder dispatched — appt=${appt.id} email=${!!patientEmail} sms=${!!patientPhone}`);
}

// ── Booking request (sent immediately after creation — NO confirm link) ───────
// Tone: "we received your request, team will approve shortly."
// Token is NOT generated here — deferred to clinic approval step.

async function sendBookingConfirmation(apptId) {
  const { rows } = await pool.query(`
    SELECT a.id, a.tenant_id, a.patient_name, a.patient_phone, a.patient_email,
           a.appointment_date, a.appointment_time, a.treatment_type,
           a.booking_confirmation_sent_at,
           b.name     AS branch_name,  b.postcode AS branch_postcode,
           t.name     AS clinic_name,
           l.phone    AS lead_phone
    FROM appointments a
    JOIN  tenants t          ON t.id = a.tenant_id
    LEFT JOIN clinic_branches b ON b.id = a.branch_id
    LEFT JOIN leads l           ON l.id = a.lead_id
    WHERE a.id = $1
  `, [apptId]);

  const appt = rows[0];
  if (!appt) return;

  // Atomic stamp — duplicate guard
  const { rowCount } = await pool.query(
    `UPDATE appointments SET booking_confirmation_sent_at = NOW()
     WHERE id = $1 AND booking_confirmation_sent_at IS NULL`,
    [apptId],
  );
  if (rowCount === 0) return;

  const patientPhone = appt.patient_phone || appt.lead_phone;
  const patientEmail = appt.patient_email;
  const displayDate  = String(appt.appointment_date).slice(0, 10);
  const displayTime  = String(appt.appointment_time).slice(0, 5);
  const branchLine   = appt.branch_name
    ? `${appt.branch_name}${appt.branch_postcode ? ', ' + appt.branch_postcode : ''}`
    : null;

  if (patientEmail) {
    sendBookingRequestEmail({
      to:              patientEmail,
      tenantId:        appt.tenant_id,
      patientName:     appt.patient_name,
      clinicName:      appt.clinic_name,
      appointmentDate: displayDate,
      appointmentTime: displayTime,
      branchName:      appt.branch_name     || null,
      branchPostcode:  appt.branch_postcode || null,
      treatmentType:   appt.treatment_type  || null,
    }).catch(err => console.error('[BookingRequest] email failed:', err.message));
  }

  if (patientPhone) {
    const smsLines = [
      `${appt.clinic_name}: We've received your appointment request for ${displayDate} at ${displayTime}`,
      branchLine ? `📍 ${branchLine}` : null,
      `Our team will confirm shortly.`,
    ].filter(Boolean);
    sendSms(appt.tenant_id, patientPhone, smsLines.join('. '))
      .catch(err => console.error('[BookingRequest] SMS failed:', err.message));
  }

  console.log(`[BookingRequest] dispatched — appt=${apptId} email=${!!patientEmail} sms=${!!patientPhone}`);
}

// ── Approval notification (sent when clinic approves — includes confirm link) ─

async function sendApprovalNotification(apptId) {
  const { rows } = await pool.query(`
    SELECT a.id, a.tenant_id, a.patient_name, a.patient_phone, a.patient_email,
           a.appointment_date, a.appointment_time, a.treatment_type,
           a.confirmation_token, a.approval_notification_sent_at,
           b.name     AS branch_name,  b.postcode AS branch_postcode,
           t.name     AS clinic_name,
           l.phone    AS lead_phone
    FROM appointments a
    JOIN  tenants t          ON t.id = a.tenant_id
    LEFT JOIN clinic_branches b ON b.id = a.branch_id
    LEFT JOIN leads l           ON l.id = a.lead_id
    WHERE a.id = $1
  `, [apptId]);

  const appt = rows[0];
  if (!appt) return;

  // Atomic stamp — duplicate guard
  const { rowCount } = await pool.query(
    `UPDATE appointments SET approval_notification_sent_at = NOW()
     WHERE id = $1 AND approval_notification_sent_at IS NULL`,
    [apptId],
  );
  if (rowCount === 0) return;

  const token = await resolveToken(appt);
  if (!token) {
    console.error(`[ApprovalNotif] could not resolve token for appt ${apptId}`);
    return;
  }

  const apiBase      = process.env.API_BASE_URL || 'https://api.carenova.ai';
  const confirmLink  = `${apiBase}/api/appointments/confirm/${token}`;
  const declineLink  = `${apiBase}/api/appointments/decline/${token}`;

  const patientPhone = appt.patient_phone || appt.lead_phone;
  const patientEmail = appt.patient_email;
  const displayDate  = String(appt.appointment_date).slice(0, 10);
  const displayTime  = String(appt.appointment_time).slice(0, 5);
  const branchLine   = appt.branch_name
    ? `${appt.branch_name}${appt.branch_postcode ? ', ' + appt.branch_postcode : ''}`
    : null;

  if (patientEmail) {
    sendApprovalNotificationEmail({
      to:              patientEmail,
      tenantId:        appt.tenant_id,
      patientName:     appt.patient_name,
      clinicName:      appt.clinic_name,
      appointmentDate: displayDate,
      appointmentTime: displayTime,
      branchName:      appt.branch_name     || null,
      branchPostcode:  appt.branch_postcode || null,
      treatmentType:   appt.treatment_type  || null,
      confirmLink,
      declineLink,
    }).catch(err => console.error('[ApprovalNotif] email failed:', err.message));
  }

  if (patientPhone) {
    const smsLines = [
      `${appt.clinic_name}: Your appointment is confirmed for ${displayDate} at ${displayTime}`,
      branchLine ? `📍 ${branchLine}` : null,
      `Please confirm your attendance: ${confirmLink}`,
    ].filter(Boolean);
    sendSms(appt.tenant_id, patientPhone, smsLines.join('. '))
      .catch(err => console.error('[ApprovalNotif] SMS failed:', err.message));
  }

  console.log(`[ApprovalNotif] dispatched — appt=${apptId} email=${!!patientEmail} sms=${!!patientPhone}`);
}

// ── Main cron entry point ─────────────────────────────────────────────────────

async function processReminders() {
  const processed1day    = [];
  const processedSameday = [];

  // ── 1-Day reminders ──
  const { rows: rows1day } = await pool.query(`
    SELECT ${APPT_COLS}
      AND a.reminder_1day_sent_at IS NULL
      AND a.appointment_date = (NOW() AT TIME ZONE COALESCE(t.timezone, 'UTC') + INTERVAL '1 day')::date
  `);

  for (const appt of rows1day) {
    const { rowCount } = await pool.query(
      `UPDATE appointments SET reminder_1day_sent_at = NOW()
       WHERE id = $1 AND reminder_1day_sent_at IS NULL`,
      [appt.id],
    );
    if (rowCount === 0) continue;
    await sendAppointmentReminder(appt, '1day');
    processed1day.push(appt.id);
  }

  // ── Same-day reminders ──
  // Intent: a morning nudge. The original rule fired ONLY 06:00–11:59
  // tenant-local with no catch-up, so if GitHub's scheduled cron dropped every
  // run in that window (it drifts and skips runs), the same-day reminder was
  // lost for the whole day. Resilient rule: fire on ANY run from 06:00 local
  // onward, as long as the appointment is still at least 1 hour away — a dropped
  // morning slot is then covered by a later run, while we never send after (or
  // moments before) the appointment, when a reminder is useless. The atomic
  // reminder_sameday_sent_at stamp still guarantees exactly one send.
  const { rows: rowsSameday } = await pool.query(`
    SELECT ${APPT_COLS}
      AND a.reminder_sameday_sent_at IS NULL
      AND a.appointment_date = (NOW() AT TIME ZONE COALESCE(t.timezone, 'UTC'))::date
      AND EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(t.timezone, 'UTC')) >= 6
      AND (a.appointment_date + a.appointment_time)
            - (NOW() AT TIME ZONE COALESCE(t.timezone, 'UTC')) >= INTERVAL '1 hour'
  `);

  for (const appt of rowsSameday) {
    const { rowCount } = await pool.query(
      `UPDATE appointments SET reminder_sameday_sent_at = NOW()
       WHERE id = $1 AND reminder_sameday_sent_at IS NULL`,
      [appt.id],
    );
    if (rowCount === 0) continue;
    await sendAppointmentReminder(appt, 'sameday');
    processedSameday.push(appt.id);
  }

  return { processed1day: processed1day.length, processedSameday: processedSameday.length };
}

// ── Rejection notification (sent when clinic rejects — gentle reschedule invite) ─

async function sendRejectionNotification(apptId) {
  const { rows } = await pool.query(`
    SELECT a.id, a.tenant_id, a.patient_name, a.patient_phone, a.patient_email,
           a.appointment_date, a.appointment_time, a.treatment_type,
           a.rejection_notification_sent_at,
           b.name     AS branch_name,  b.postcode AS branch_postcode,
           t.name     AS clinic_name,
           l.phone    AS lead_phone
    FROM appointments a
    JOIN  tenants t          ON t.id = a.tenant_id
    LEFT JOIN clinic_branches b ON b.id = a.branch_id
    LEFT JOIN leads l           ON l.id = a.lead_id
    WHERE a.id = $1
  `, [apptId]);

  const appt = rows[0];
  if (!appt) return;

  // Atomic stamp — duplicate guard
  const { rowCount } = await pool.query(
    `UPDATE appointments SET rejection_notification_sent_at = NOW()
     WHERE id = $1 AND rejection_notification_sent_at IS NULL`,
    [apptId],
  );
  if (rowCount === 0) return;

  const patientPhone = appt.patient_phone || appt.lead_phone;
  const patientEmail = appt.patient_email;
  const displayDate  = String(appt.appointment_date).slice(0, 10);
  const displayTime  = String(appt.appointment_time).slice(0, 5);

  if (patientEmail) {
    sendRejectionEmail({
      to:              patientEmail,
      tenantId:        appt.tenant_id,
      patientName:     appt.patient_name,
      clinicName:      appt.clinic_name,
      appointmentDate: displayDate,
      appointmentTime: displayTime,
      branchName:      appt.branch_name     || null,
      branchPostcode:  appt.branch_postcode || null,
      treatmentType:   appt.treatment_type  || null,
    }).catch(err => console.error('[Rejection] email failed:', err.message));
  }

  if (patientPhone) {
    const name = appt.patient_name ? ` ${appt.patient_name.split(' ')[0]}` : '';
    const smsBody =
      `${appt.clinic_name}: Hi${name}, unfortunately we're unable to accommodate ` +
      `${displayDate} at ${displayTime}. Let's find another time that works for you — ` +
      `which days suit you best? 😊`;
    sendSms(appt.tenant_id, patientPhone, smsBody)
      .catch(err => console.error('[Rejection] SMS failed:', err.message));
  }

  console.log(`[Rejection] dispatched — appt=${apptId} email=${!!patientEmail} sms=${!!patientPhone}`);
}

module.exports = {
  processReminders,
  sendAppointmentReminder,
  sendBookingConfirmation,
  sendApprovalNotification,
  sendRejectionNotification,
};

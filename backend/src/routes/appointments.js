/**
 * Appointments + Availability routes
 *
 * GET    /api/clinics/:id/availability                        — working hours + available slots
 * POST   /api/clinics/:id/availability                        — upsert availability rules
 *
 * GET    /api/clinics/:id/appointments                        — list appointments
 * POST   /api/clinics/:id/appointments                        — create appointment
 * PATCH  /api/clinics/:id/appointments/:apptId               — update appointment status/notes
 */

const express      = require('express');
const router       = express.Router({ mergeParams: true });
const { pool }     = require('../db/index');
const { authenticate } = require('../middleware/auth');
const { Resend }   = require('resend');
const { shell, getTenantBrand } = require('../utils/email');
const { sendRejectionNotification } = require('../services/appointmentReminders');
const {
  pushAppointmentCreate,
  pushAppointmentUpdate,
  pushAppointmentCancel,
} = require('../services/calendarSync');

const FROM = 'CareNova AI <noreply@carenova.ai>';

router.use(authenticate);

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapAppt(r) {
  return {
    id:                        r.id,
    tenantId:                  r.tenant_id,
    leadId:                    r.lead_id,
    patientName:               r.patient_name,
    patientPhone:              r.patient_phone,
    patientEmail:              r.patient_email              || null,
    treatmentType:             r.treatment_type,
    appointmentDate:           r.appointment_date,
    appointmentTime:           r.appointment_time,
    durationMinutes:           r.duration_minutes,
    status:                    r.status,
    notes:                     r.notes,
    assignedTo:                r.assigned_to               || null,
    branchName:                r.branch_name               || null,
    branchPostcode:            r.branch_postcode           || null,
    clinicStatus:              r.clinic_status             || 'requested',
    clinicApprovedAt:          r.clinic_approved_at        || null,
    confirmationStatus:        r.confirmation_status       || 'pending',
    reminder1daySentAt:        r.reminder_1day_sent_at     || null,
    reminderSamedaySentAt:     r.reminder_sameday_sent_at  || null,
    createdAt:                 r.created_at,
    updatedAt:                 r.updated_at,
  };
}

function mapAvail(r) {
  return {
    id:                r.id,
    tenantId:          r.tenant_id,
    dayOfWeek:         r.day_of_week,
    startTime:         r.start_time,
    endTime:           r.end_time,
    slotDurationMins:  r.slot_duration_minutes,
    isActive:          r.is_active,
  };
}

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/**
 * Generate available time slots for a given date.
 * Returns array of 'HH:MM' strings not already booked.
 */
function generateSlots(startTime, endTime, durationMins) {
  const slots = [];
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let cur = sh * 60 + sm;
  const end = eh * 60 + em;
  while (cur + durationMins <= end) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0');
    const m = String(cur % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
    cur += durationMins;
  }
  return slots;
}

// ── Availability ─────────────────────────────────────────────────────────────

// GET /api/clinics/:id/availability?date=YYYY-MM-DD
router.get('/availability', async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;   // optional — if provided, returns free slots for that date

  try {
    const { rows: rules } = await pool.query(
      `SELECT * FROM clinic_availability WHERE tenant_id = $1 ORDER BY day_of_week`, [id],
    );

    if (!date) {
      return res.json({ rules: rules.map(mapAvail) });
    }

    // Compute available slots for the requested date
    const d = new Date(date);
    const dow = d.getDay();   // 0=Sun … 6=Sat
    const rule = rules.find(r => r.day_of_week === dow && r.is_active);

    if (!rule) return res.json({ date, slots: [], reason: 'Clinic closed on this day.' });

    const allSlots = generateSlots(rule.start_time, rule.end_time, rule.slot_duration_minutes);

    // Find already-booked slots for this date
    const { rows: booked } = await pool.query(
      `SELECT appointment_time FROM appointments
       WHERE tenant_id = $1 AND appointment_date = $2
         AND status NOT IN ('cancelled')`,
      [id, date],
    );
    const bookedTimes = new Set(booked.map(b => b.appointment_time.slice(0, 5)));
    const freeSlots = allSlots.filter(s => !bookedTimes.has(s));

    return res.json({ date, dayName: DAY_NAMES[dow], slots: freeSlots, rule: mapAvail(rule) });
  } catch (err) {
    console.error('[Availability] GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch availability.' });
  }
});

// POST /api/clinics/:id/availability  — upsert working hours per day
router.post('/availability', async (req, res) => {
  const { id } = req.params;
  const rules = req.body.rules;   // array of { day_of_week, start_time, end_time, slot_duration_minutes, is_active }
  if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules array required.' });

  try {
    const saved = [];
    for (const r of rules) {
      const { rows } = await pool.query(
        `INSERT INTO clinic_availability
           (tenant_id, day_of_week, start_time, end_time, slot_duration_minutes, is_active)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (tenant_id, day_of_week) DO UPDATE SET
           start_time            = EXCLUDED.start_time,
           end_time              = EXCLUDED.end_time,
           slot_duration_minutes = EXCLUDED.slot_duration_minutes,
           is_active             = EXCLUDED.is_active
         RETURNING *`,
        [id, r.day_of_week, r.start_time || '09:00', r.end_time || '18:00',
         r.slot_duration_minutes || 30, r.is_active ?? true],
      );
      saved.push(mapAvail(rows[0]));
    }
    return res.json({ rules: saved });
  } catch (err) {
    console.error('[Availability] POST error:', err.message);
    return res.status(500).json({ error: 'Failed to save availability.' });
  }
});

// ── Appointments ─────────────────────────────────────────────────────────────

// GET /api/clinics/:id/appointments?date=YYYY-MM-DD&status=pending
router.get('/appointments', async (req, res) => {
  const { id } = req.params;
  const { date, status } = req.query;
  const isSales = req.user?.role === 'sales';

  // Sales reps see only appointments whose linked lead is assigned to them.
  // appointments.assigned_to is for dentist/nurse (clinical assignment) — not used here.
  let query, values, nextParam;
  const branchJoin = `LEFT JOIN clinic_branches b ON b.id = a.branch_id`;
  const apptCols   = `a.*, b.name AS branch_name, b.postcode AS branch_postcode`;

  if (isSales) {
    query      = `SELECT ${apptCols} FROM appointments a
                  INNER JOIN leads l ON l.id = a.lead_id AND l.assigned_to = $2
                  ${branchJoin}
                  WHERE a.tenant_id = $1`;
    values     = [id, req.user.sub];
    nextParam  = 3;
  } else {
    query      = `SELECT ${apptCols} FROM appointments a
                  ${branchJoin}
                  WHERE a.tenant_id = $1`;
    values     = [id];
    nextParam  = 2;
  }

  if (date)   { query += ` AND a.appointment_date = $${nextParam++}`; values.push(date); }
  if (status) { query += ` AND a.status = $${nextParam++}`;           values.push(status); }

  query += ` ORDER BY a.created_at DESC`;

  try {
    const { rows } = await pool.query(query, values);
    return res.json({ appointments: rows.map(mapAppt) });
  } catch (err) {
    console.error('[Appointments] GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch appointments.' });
  }
});

// POST /api/clinics/:id/appointments
router.post('/appointments', async (req, res) => {
  const { id } = req.params;
  const {
    lead_id, patient_name, patient_phone, treatment_type,
    appointment_date, appointment_time, duration_minutes = 30, notes,
    patient_email,   // optional — used for confirmation email only
    assigned_to,     // optional — UUID of dentist/nurse
  } = req.body;

  if (!patient_name?.trim())   return res.status(400).json({ error: 'patient_name required.' });
  if (!patient_phone?.trim())  return res.status(400).json({ error: 'patient_phone required.' });
  if (!appointment_date)       return res.status(400).json({ error: 'appointment_date required.' });
  if (!appointment_time)       return res.status(400).json({ error: 'appointment_time required.' });

  try {
    // Check slot isn't already taken
    const { rows: conflict } = await pool.query(
      `SELECT id FROM appointments
       WHERE tenant_id = $1 AND appointment_date = $2 AND appointment_time = $3
         AND status NOT IN ('cancelled')`,
      [id, appointment_date, appointment_time],
    );
    if (conflict.length) return res.status(409).json({ error: 'This slot is already booked.' });

    const { rows } = await pool.query(
      `INSERT INTO appointments
         (tenant_id, lead_id, patient_name, patient_phone, patient_email, treatment_type,
          appointment_date, appointment_time, duration_minutes, notes, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [id, lead_id || null, patient_name.trim(), patient_phone.trim(),
       patient_email?.trim() || null,
       treatment_type?.trim() || null, appointment_date, appointment_time,
       duration_minutes, notes?.trim() || null, assigned_to || null],
    );

    const appt = rows[0];

    // Get clinic name, email, and timezone for emails + calendar sync
    const { rows: tenantRows } = await pool.query(
      `SELECT name, email, timezone, notification_email FROM tenants WHERE id = $1`, [id],
    );
    const clinicName  = tenantRows[0]?.name     || 'Your Clinic';
    const clinicEmail = tenantRows[0]?.email    || null;
    const timezone    = tenantRows[0]?.timezone || 'UTC';

    // Fire-and-forget confirmation emails
    sendAppointmentEmails({
      tenantId: id,
      clinicName, clinicEmail,
      patient_email: appt.patient_email,
      patientName:   appt.patient_name,
      date:          appt.appointment_date,
      time:          appt.appointment_time,
      treatmentType: appt.treatment_type,
      assignedTo:    appt.assigned_to,
    }).catch(err => console.error('[Appointments] Email error:', err.message));

    // Fire-and-forget notification email to clinic
    const { sendAppointmentAlert } = require('../utils/email');
    sendAppointmentAlert({
      to:          tenantRows[0]?.notification_email,
      clinicName:  clinicName,
      patientName: appt.patient_name,
      treatment:   appt.treatment_type,
      date:        appt.appointment_date instanceof Date ? appt.appointment_date.toISOString().slice(0, 10) : appt.appointment_date,
      time:        appt.appointment_time,
    }).catch(() => {});

    // Fire-and-forget Google Calendar push — never blocks the response
    pushAppointmentCreate(appt, timezone)
      .catch(err => console.error('[Appointments] Calendar push error:', err.message));

    return res.status(201).json({ appointment: mapAppt(appt) });
  } catch (err) {
    console.error('[Appointments] POST error:', err.message);
    return res.status(500).json({ error: 'Failed to create appointment.' });
  }
});

// PATCH /api/clinics/:id/appointments/:apptId
router.patch('/appointments/:apptId', async (req, res) => {
  const { id, apptId } = req.params;
  const VALID_STATUSES = ['pending','confirmed','cancelled','completed','no_show'];
  const { status, notes, appointment_date, appointment_time } = req.body;

  if (status && !VALID_STATUSES.includes(status))
    return res.status(400).json({ error: `Invalid status. Must be: ${VALID_STATUSES.join(', ')}` });

  const fields = [];
  const values = [];
  let i = 1;
  if (status)           { fields.push(`status = $${i++}`);           values.push(status); }
  if (notes !== undefined){ fields.push(`notes  = $${i++}`);          values.push(notes); }
  if (appointment_date) { fields.push(`appointment_date = $${i++}`); values.push(appointment_date); }
  if (appointment_time) { fields.push(`appointment_time = $${i++}`); values.push(appointment_time); }

  if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });

  fields.push(`updated_at = now()`);
  values.push(id, apptId);

  try {
    const { rows } = await pool.query(
      `UPDATE appointments SET ${fields.join(', ')}
       WHERE tenant_id = $${i++} AND id = $${i++} RETURNING *`,
      values,
    );
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found.' });

    const appt = rows[0];

    // Fire-and-forget Google Calendar sync — never blocks the response.
    // Fetch timezone once up-front, then branch on cancelled vs. update.
    ;(async () => {
      const { rows: tRows } = await pool.query(
        `SELECT timezone FROM tenants WHERE id = $1`, [id],
      );
      const timezone = tRows[0]?.timezone || 'UTC';

      if (status === 'cancelled') {
        await pushAppointmentCancel(appt);
      } else {
        await pushAppointmentUpdate(appt, timezone);
      }
    })().catch(err => console.error('[Appointments] Calendar sync error:', err.message));

    return res.json({ appointment: mapAppt(appt) });
  } catch (err) {
    console.error('[Appointments] PATCH error:', err.message);
    return res.status(500).json({ error: 'Failed to update appointment.' });
  }
});

// ── PATCH /api/clinics/:id/appointments/:apptId/approve ──────────────────────

router.patch('/appointments/:apptId/approve', async (req, res) => {
  const { id, apptId } = req.params;
  const ALLOWED = ['super_admin', 'clinic_admin', 'director', 'manager'];
  if (!ALLOWED.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE appointments
       SET clinic_status = 'approved', clinic_approved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND clinic_status <> 'approved'
       RETURNING *`,
      [apptId, id],
    );
    if (!rows.length) {
      // Either not found or already approved — return current state
      const { rows: cur } = await pool.query(
        `SELECT a.*, b.name AS branch_name, b.postcode AS branch_postcode
         FROM appointments a LEFT JOIN clinic_branches b ON b.id = a.branch_id
         WHERE a.id = $1 AND a.tenant_id = $2`, [apptId, id],
      );
      if (!cur.length) return res.status(404).json({ error: 'Appointment not found.' });
      return res.json({ appointment: mapAppt(cur[0]) });
    }

    // Fire approval notification (email + SMS + confirm link) fire-and-forget
    const { sendApprovalNotification } = require('../services/appointmentReminders');
    sendApprovalNotification(apptId)
      .catch(err => console.error('[approve] notification failed:', err.message));

    console.log(`[Appointments] approved appt=${apptId} by user=${req.user?.sub}`);
    return res.json({ appointment: mapAppt(rows[0]) });
  } catch (err) {
    console.error('[Appointments] approve error:', err.message);
    return res.status(500).json({ error: 'Failed to approve appointment.' });
  }
});

// ── PATCH /api/clinics/:id/appointments/:apptId/reject ───────────────────────

router.patch('/appointments/:apptId/reject', async (req, res) => {
  const { id, apptId } = req.params;
  const ALLOWED = ['super_admin', 'clinic_admin', 'director', 'manager'];
  if (!ALLOWED.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE appointments
       SET clinic_status = 'rejected', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [apptId, id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found.' });

    const appt = rows[0];
    console.log(`[Appointments] rejected appt=${apptId} by user=${req.user?.sub}`);

    // Notify patient + re-enable AI follow-up (fire-and-forget)
    sendRejectionNotification(apptId)
      .catch(err => console.error('[rejection]', err));

    if (appt.lead_id) {
      pool.query(
        `UPDATE leads SET ai_follow_up_enabled = TRUE WHERE id = $1`,
        [appt.lead_id],
      ).catch(err => console.error('[rejection] re-enable ai follow-up failed:', err.message));
    }

    return res.json({ appointment: mapAppt(appt) });
  } catch (err) {
    console.error('[Appointments] reject error:', err.message);
    return res.status(500).json({ error: 'Failed to reject appointment.' });
  }
});

// ── Email helpers ─────────────────────────────────────────────────────────────

async function sendAppointmentEmails({ tenantId, clinicName, clinicEmail, patient_email, patientName, date, time, treatmentType, assignedTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend  = new Resend(apiKey);
  const dateStr = new Date(`${date}T${time}`).toLocaleString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // Patient-facing email is tenant-branded — same mechanism as
  // sendBankDetailsEmail / sendPaymentLinkEmail in utils/email.js.
  const brand        = tenantId ? await getTenantBrand(tenantId) : null;
  const patientFrom  = brand ? `${brand.fromName} <noreply@carenova.ai>` : FROM;

  // Resolve assigned staff name from DB
  let assignedToName = null;
  if (assignedTo) {
    try {
      const { rows: staffRows } = await pool.query(
        'SELECT first_name, last_name FROM users WHERE id = $1 AND deleted_at IS NULL',
        [assignedTo],
      );
      if (staffRows.length) {
        assignedToName = `${staffRows[0].first_name} ${staffRows[0].last_name}`;
      }
    } catch {
      // Non-critical — email sends without clinician name if lookup fails
    }
  }

  const promises = [];

  // Patient confirmation email
  if (patient_email) {
    promises.push(
      resend.emails.send({
        from:    patientFrom,
        to:      patient_email,
        subject: `✅ Appointment Confirmed — ${clinicName}`,
        html:    appointmentConfirmHtml({ patientName, clinicName, dateStr, treatmentType, assignedToName, brand }),
        text:    `Hi ${patientName},\n\nYour appointment at ${clinicName} is confirmed for ${dateStr}.\nTreatment: ${treatmentType || 'General consultation'}${assignedToName ? `\nClinician: ${assignedToName}` : ''}\n\n— ${clinicName}`,
      }),
    );
  }

  // Clinic notification email
  if (clinicEmail) {
    promises.push(
      resend.emails.send({
        from:    FROM,
        to:      clinicEmail,
        subject: `📅 New Appointment — ${patientName} on ${dateStr}`,
        html:    appointmentNotifyHtml({ patientName, clinicName, dateStr, treatmentType }),
        text:    `New appointment booked.\n\nPatient: ${patientName}\nDate: ${dateStr}\nTreatment: ${treatmentType || 'N/A'}`,
      }),
    );
  }

  await Promise.allSettled(promises);
}

// Patient-facing confirmation — tenant-branded via the central shell().
// `brand` (from getTenantBrand) drives the clinic logo/name in the header and
// the clinic name in the footer, so the patient sees the clinic's brand — not
// CareNova. Body styling mirrors sendBankDetailsEmail / sendPaymentLinkEmail.
function appointmentConfirmHtml({ patientName, clinicName, dateStr, treatmentType, assignedToName, brand }) {
  const body = `
    <h1 style="margin:0 0 8px;color:#0d2b35;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Appointment Confirmed ✅</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">Hi ${patientName}, your appointment is booked.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="background-color:#f8f4ef;border:1px solid #e8e2da;border-radius:12px;margin:0 0 24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;color:#0d2b35;font-size:14px;"><strong>Clinic:</strong> ${clinicName}</p>
          <p style="margin:0 0 6px;color:#0d2b35;font-size:14px;"><strong>Date &amp; Time:</strong> ${dateStr}</p>
          <p style="margin:0 0 6px;color:#0d2b35;font-size:14px;"><strong>Treatment:</strong> ${treatmentType || 'General Consultation'}</p>
          ${assignedToName ? `<p style="margin:0;color:#0d2b35;font-size:14px;"><strong>Your Clinician:</strong> ${assignedToName}</p>` : ''}
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">Need to reschedule? Reply to this email or WhatsApp us directly.</p>`;
  return shell(body, { brand });
}

// Clinic-facing notification — CareNova-branded (staff use the CareNova
// panel), so use the central shell() WITHOUT a tenant brand.
function appointmentNotifyHtml({ patientName, clinicName, dateStr, treatmentType }) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const body = `
    <h1 style="margin:0 0 8px;color:#0d2b35;font-size:24px;font-weight:800;letter-spacing:-0.5px;">📅 New Appointment Booked</h1>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="background-color:#f8f4ef;border:1px solid #e8e2da;border-radius:12px;margin:0 0 24px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;color:#0d2b35;font-size:14px;"><strong>Patient:</strong> ${patientName}</p>
          <p style="margin:0 0 6px;color:#0d2b35;font-size:14px;"><strong>Date &amp; Time:</strong> ${dateStr}</p>
          <p style="margin:0;color:#0d2b35;font-size:14px;"><strong>Treatment:</strong> ${treatmentType || 'N/A'}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">Manage appointments in your <a href="${appUrl}/clinics" style="color:#2563eb;">CareNova Dashboard</a>.</p>`;
  return shell(body);
}

module.exports = router;
module.exports.generateSlots = generateSlots;

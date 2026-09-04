'use strict';

/**
 * calendarSync.js — One-way push: CareNova → Google Calendar
 *
 * Three fire-and-forget functions called from appointments.js.
 * NONE of them throw — every error is caught internally and logged.
 * Appointment creation / update always succeeds regardless of Google state.
 *
 * Requires: google_event_id, sync_source columns on appointments (migration 014).
 */

const { pool }                                       = require('../db/index');
const { createEvent, updateEvent, deleteEvent }      = require('../utils/googleCalendarApi');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch the tenant's connected Google Calendar integration row.
 * Returns the DB row or null if not connected / no record.
 */
async function getConnectedIntegration(tenantId) {
  const { rows } = await pool.query(
    `SELECT *
       FROM calendar_integrations
      WHERE tenant_id = $1
        AND provider  = 'google'
        AND status    = 'connected'
      LIMIT 1`,
    [tenantId],
  );
  return rows[0] ?? null;
}

/**
 * Build a Google Calendar event resource from an appointments row.
 *
 * Google requires start.dateTime + end.dateTime in ISO 8601 format,
 * plus a timeZone string (IANA, e.g. 'Europe/London').
 *
 * appointments stores:
 *   appointment_date  DATE    e.g. '2026-06-01'
 *   appointment_time  TIME    e.g. '10:00:00' or '10:00'
 *   duration_minutes  INTEGER e.g. 30
 */
function buildEventBody(appt, timezone) {
  // Normalise appointment_date to 'YYYY-MM-DD' string.
  // pg driver returns Postgres DATE columns as JavaScript Date objects
  // (midnight UTC), so toString() would produce "Sun Jun 21 2026 …".
  // Use toISOString().slice(0,10) for Date instances; for plain strings
  // (e.g. from tests or future sources) take the first 10 chars directly.
  const dateStr = appt.appointment_date instanceof Date
    ? appt.appointment_date.toISOString().slice(0, 10)
    : String(appt.appointment_date).slice(0, 10);

  // Normalise time to HH:MM (strip seconds if present)
  const timeStr  = String(appt.appointment_time).slice(0, 5); // '10:00'
  const startStr = `${dateStr}T${timeStr}:00`;                 // '2026-06-01T10:00:00'

  // Derive end using pure wall-clock minute arithmetic — NO UTC conversion.
  // new Date() / .toISOString() are intentionally avoided so the result is
  // never influenced by the server's local timezone or DST offsets.
  //
  // Algorithm:
  //   1. Decompose start into total minutes since midnight.
  //   2. Add duration_minutes.
  //   3. If result >= 1440 (24 h), carry 1 day and wrap minutes.
  //   4. Format back to 'YYYY-MM-DDTHH:MM:SS' naive string.
  // Google interprets both start and end as wall-clock times in the given
  // timeZone, so the naive format + timeZone field is exactly what it wants.
  const [startH, startM] = timeStr.split(':').map(Number);
  const duration    = appt.duration_minutes || 30;
  let totalEndMins  = startH * 60 + startM + duration;

  let endDateStr = dateStr; // already normalised to 'YYYY-MM-DD'
  if (totalEndMins >= 1440) {
    totalEndMins -= 1440;
    // Advance date by one day using UTC-only arithmetic — server TZ cannot interfere
    const d = new Date(endDateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    endDateStr = d.toISOString().slice(0, 10); // 'YYYY-MM-DD' from UTC
  }
  const endH   = Math.floor(totalEndMins / 60);
  const endM   = totalEndMins % 60;
  const endStr = `${endDateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
  // Examples: 10:00+30m→10:30 same day | 23:50+30m→next day 00:20

  // Build human-readable summary
  const summary = appt.treatment_type
    ? `${appt.patient_name} — ${appt.treatment_type}`
    : appt.patient_name;

  // Build description from treatment + notes
  const descParts = [];
  if (appt.treatment_type) descParts.push(`Treatment: ${appt.treatment_type}`);
  if (appt.notes)          descParts.push(`Notes: ${appt.notes}`);
  const description = descParts.join('\n') || undefined;

  const eventBody = {
    summary,
    description,
    start: { dateTime: startStr, timeZone: timezone || 'UTC' },
    end:   { dateTime: endStr,   timeZone: timezone || 'UTC' },
  };

  // Optionally add patient as attendee if email is available
  if (appt.patient_email) {
    eventBody.attendees = [{ email: appt.patient_email }];
  }

  return eventBody;
}

// ─── Push functions ───────────────────────────────────────────────────────────

/**
 * Called after a new appointment is INSERTed.
 * Creates a Google Calendar event and stores the returned google_event_id.
 *
 * @param {object} appt      Row returned by RETURNING * from appointments INSERT
 * @param {string} timezone  IANA timezone from tenants.timezone (e.g. 'Europe/London')
 */
async function pushAppointmentCreate(appt, timezone) {
  try {
    const integration = await getConnectedIntegration(appt.tenant_id);
    if (!integration) return; // Not connected — normal, silent exit

    const calendarId = integration.calendar_id || 'primary';
    const eventBody  = buildEventBody(appt, timezone);

    const created = await createEvent(integration, calendarId, eventBody);

    // Persist google_event_id back to the appointment row
    await pool.query(
      `UPDATE appointments
          SET google_event_id = $1,
              sync_source     = 'carenova',
              updated_at      = NOW()
        WHERE id = $2`,
      [created.id, appt.id],
    );

    console.log(`[CalendarSync] Created event ${created.id} for appointment ${appt.id}`);
  } catch (err) {
    // Never surface to the caller — appointment creation already succeeded
    console.error(`[CalendarSync] pushAppointmentCreate failed for appointment ${appt.id}:`, err.message);
  }
}

/**
 * Called after an appointment is PATCHed (non-cancellation).
 * If the appointment has no google_event_id it was never pushed — skip.
 *
 * @param {object} appt      Row returned by RETURNING * from appointments UPDATE
 * @param {string} timezone  IANA timezone from tenants.timezone
 */
async function pushAppointmentUpdate(appt, timezone) {
  try {
    if (!appt.google_event_id) return; // Never pushed to Google — nothing to update

    const integration = await getConnectedIntegration(appt.tenant_id);
    if (!integration) return;

    const calendarId = integration.calendar_id || 'primary';
    // duration_minutes is not editable via PATCH but is present in RETURNING *
    const eventBody  = buildEventBody(appt, timezone);

    await updateEvent(integration, calendarId, appt.google_event_id, eventBody);

    console.log(`[CalendarSync] Updated event ${appt.google_event_id} for appointment ${appt.id}`);
  } catch (err) {
    console.error(`[CalendarSync] pushAppointmentUpdate failed for appointment ${appt.id}:`, err.message);
  }
}

/**
 * Called after an appointment is PATCHed to status='cancelled'.
 * Deletes the corresponding Google Calendar event (if one exists).
 * Clears google_event_id to prevent duplicate delete attempts.
 *
 * @param {object} appt  Row returned by RETURNING * from appointments UPDATE
 */
async function pushAppointmentCancel(appt) {
  try {
    if (!appt.google_event_id) return; // No Google event to delete

    const integration = await getConnectedIntegration(appt.tenant_id);
    if (!integration) return;

    const calendarId = integration.calendar_id || 'primary';

    await deleteEvent(integration, calendarId, appt.google_event_id);

    // Clear google_event_id so a re-cancel doesn't attempt a second delete
    await pool.query(
      `UPDATE appointments
          SET google_event_id = NULL,
              updated_at      = NOW()
        WHERE id = $1`,
      [appt.id],
    );

    console.log(`[CalendarSync] Deleted event ${appt.google_event_id} for appointment ${appt.id}`);
  } catch (err) {
    console.error(`[CalendarSync] pushAppointmentCancel failed for appointment ${appt.id}:`, err.message);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  pushAppointmentCreate,
  pushAppointmentUpdate,
  pushAppointmentCancel,
};

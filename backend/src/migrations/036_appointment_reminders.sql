-- Migration 036: Appointment reminder + confirmation schema.
-- Adds patient_email (if not already present), reminder tracking timestamps,
-- confirmation workflow columns, and a partial index for reminder scheduling.
-- Idempotent: safe to re-run.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS patient_email              TEXT,
  ADD COLUMN IF NOT EXISTS reminder_1day_sent_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sameday_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmation_status        TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS confirmation_token         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS confirmed_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_confirmation_sent_at TIMESTAMPTZ;

-- Index used by the reminder cron: only upcoming/pending-confirmation rows.
CREATE INDEX IF NOT EXISTS idx_appts_reminder_schedule
  ON appointments (appointment_date)
  WHERE confirmation_status <> 'declined';

-- Migration 038: rejection notification stamp
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS rejection_notification_sent_at TIMESTAMPTZ;

-- Migration 022: notification_preferences table
-- Run manually in Supabase SQL Editor.
-- Kanal-agnostik: channel column allows email now, sms/whatsapp in future without schema change.

BEGIN;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,   -- new_lead | lead_booked | appointment_reminder | urgent_escalation | no_show | ai_quota_warning
  channel     TEXT        NOT NULL DEFAULT 'email',  -- email (now); sms / whatsapp (future)
  enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_type, channel)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id);

COMMIT;

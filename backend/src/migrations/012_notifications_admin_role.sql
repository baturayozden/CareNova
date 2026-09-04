-- ============================================================
-- Migration 012: Notifications table + admin role + alert_phone
-- ============================================================

-- ── 1. Admin role (platform-level, not clinic) ───────────────────────────────
INSERT INTO roles (name, description, permissions)
VALUES (
  'admin',
  'CareNova platform admin. Can manage clinics but cannot access super admin settings.',
  '{"platform": "manage_clinics", "leads": "read", "reports": "all"}'
)
ON CONFLICT (name) DO NOTHING;

-- ── 2. Notifications table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,          -- 'escalation' | 'demo_request' | 'urgent_message' | 'system'
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL,
  link       TEXT,                          -- optional frontend deep-link
  read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant      ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread      ON notifications(tenant_id, read) WHERE read = FALSE;

-- ── 3. clinic_ai_settings: alert_phone column ────────────────────────────────
ALTER TABLE clinic_ai_settings ADD COLUMN IF NOT EXISTS alert_phone VARCHAR(20);

-- ── 4. appointments: columns added in 011 (idempotent re-run safety) ─────────
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_email TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assigned_to   UUID;

-- ── 5. clinic_ai_settings: AI provider columns ───────────────────────────────
ALTER TABLE clinic_ai_settings ADD COLUMN IF NOT EXISTS ai_provider TEXT    NOT NULL DEFAULT 'claude';
ALTER TABLE clinic_ai_settings ADD COLUMN IF NOT EXISTS ai_api_key  TEXT;
ALTER TABLE clinic_ai_settings ADD COLUMN IF NOT EXISTS ai_model    TEXT    NOT NULL DEFAULT 'claude-sonnet-4-20250514';

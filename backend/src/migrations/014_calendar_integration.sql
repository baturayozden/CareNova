-- ============================================================
-- Migration 014: Google Calendar integration infrastructure
-- ============================================================

BEGIN;

-- ── 1. calendar_integrations ─────────────────────────────────────────────────
-- Stores OAuth credentials and sync state per tenant per provider.
-- Access/refresh tokens are stored AES-256-GCM encrypted at the app layer.

CREATE TABLE IF NOT EXISTS calendar_integrations (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider             TEXT         NOT NULL DEFAULT 'google',    -- 'google' for now
  google_account_email TEXT,                                       -- primary calendar email
  access_token         TEXT,                                       -- AES-256-GCM encrypted
  refresh_token        TEXT         NOT NULL,                      -- AES-256-GCM encrypted
  token_expiry         TIMESTAMPTZ,                               -- access token expiry
  calendar_id          TEXT,                                       -- 'primary' or specific id
  sync_token           TEXT,                                       -- incremental sync cursor
  last_synced_at       TIMESTAMPTZ,
  status               TEXT         NOT NULL DEFAULT 'connected'  -- 'connected'|'error'|'disconnected'
                         CHECK (status IN ('connected', 'error', 'disconnected')),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_calendar_integrations_tenant_provider UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_tenant
  ON calendar_integrations(tenant_id);

-- ── 2. calendar_busy_blocks ───────────────────────────────────────────────────
-- Google-native events that don't originate from CareNova.
-- Read-only in our system; used for slot conflict detection.

CREATE TABLE IF NOT EXISTS calendar_busy_blocks (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  google_event_id TEXT         NOT NULL,                          -- Google Calendar event id
  start_time      TIMESTAMPTZ  NOT NULL,
  end_time        TIMESTAMPTZ  NOT NULL,
  summary         TEXT,                                            -- event title from Google
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_busy_block_google_event UNIQUE (google_event_id)
);

CREATE INDEX IF NOT EXISTS idx_busy_blocks_tenant_time
  ON calendar_busy_blocks(tenant_id, start_time, end_time);

-- ── 3. appointments — add google sync columns ────────────────────────────────

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS sync_source     TEXT NOT NULL DEFAULT 'carenova'
    CHECK (sync_source IN ('carenova', 'google'));

CREATE INDEX IF NOT EXISTS idx_appointments_google_event
  ON appointments(google_event_id) WHERE google_event_id IS NOT NULL;

-- ── updated_at trigger for calendar_integrations ─────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_calendar_integrations'
  ) THEN
    CREATE TRIGGER set_updated_at_calendar_integrations
      BEFORE UPDATE ON calendar_integrations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

COMMIT;

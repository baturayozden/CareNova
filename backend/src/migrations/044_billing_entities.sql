-- Migration 044: billing_entities table
-- Supports multiple legal entities per tenant.
-- treatment_deals gains a billing_entity_id FK so each deal knows which entity it belongs to.
--
-- NOTE (CareNova fork): the original CareDental version of this migration seeded two
-- hard-coded UK legal entities (company numbers, VAT number and bank details) against a
-- specific CareDental production tenant UUID. That data does not belong in CareNova and
-- the tenant does not exist here, so the migration failed on a clean database.
-- The seed has been removed — billing entities are created per tenant through the app.

BEGIN;

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_entities (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_key         TEXT        NOT NULL,             -- short stable slug
  legal_entity_name  TEXT        NOT NULL,
  trading_name       TEXT,
  registered_address TEXT,
  contact_phone      TEXT,
  contact_email      TEXT,
  company_number     TEXT,
  vat_number         TEXT,
  bank_name          TEXT,
  bank_account_name  TEXT,
  sort_code          TEXT,
  account_number     TEXT,
  whatsapp_number    TEXT,                             -- display number (API config via whatsapp_config_id)
  whatsapp_config_id UUID,                             -- FK to whatsapp_configs.id (nullable until wired)
  is_default         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_key)
);

CREATE INDEX IF NOT EXISTS idx_billing_entities_tenant ON billing_entities(tenant_id);

-- ── FK on treatment_deals ─────────────────────────────────────────────────────

ALTER TABLE treatment_deals
  ADD COLUMN IF NOT EXISTS billing_entity_id UUID REFERENCES billing_entities(id);

COMMIT;

-- Migration 044: billing_entities table
-- Supports multiple legal entities per tenant (e.g. Vestadent Ltd + Dentafly UK Ltd).
-- treatment_deals gains a billing_entity_id FK so each deal knows which entity it belongs to.

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_entities (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_key         TEXT        NOT NULL,             -- short stable slug, e.g. 'vestadent', 'dentafly_uk'
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

-- ── Seed — Vestadent tenant (682ba358) ───────────────────────────────────────

-- Entity 1: Vestadent Limited — populated from existing tenant_billing_profiles row.
-- Columns that may be NULL in profiles are passed through safely; nothing breaks if absent.
INSERT INTO billing_entities (
  tenant_id, entity_key, legal_entity_name, trading_name, registered_address,
  contact_phone, contact_email, company_number, vat_number,
  bank_name, bank_account_name, sort_code, account_number,
  whatsapp_number, is_default
)
SELECT
  '682ba358-434a-4126-a558-90d2ead67979',
  'vestadent',
  COALESCE(legal_entity_name, 'Vestadent Limited'),
  trading_name,
  registered_address,
  contact_phone,
  contact_email,
  company_number,
  NULL,                  -- vat_number not in tenant_billing_profiles
  bank_name,
  bank_account_name,
  sort_code,
  account_number,
  NULL,                  -- whatsapp_number filled later
  TRUE
FROM tenant_billing_profiles
WHERE tenant_id = '682ba358-434a-4126-a558-90d2ead67979'
ON CONFLICT (tenant_id, entity_key) DO NOTHING;

-- Entity 2: Dentafly Consultancy LTD (Dentafly UK)
INSERT INTO billing_entities (
  tenant_id, entity_key, legal_entity_name, trading_name, registered_address,
  contact_phone, contact_email, company_number, vat_number,
  bank_name, bank_account_name, sort_code, account_number,
  whatsapp_number, is_default
)
VALUES (
  '682ba358-434a-4126-a558-90d2ead67979',
  'dentafly_uk',
  'Dentafly Consultancy LTD',
  'Dentafly Clinic',
  '538 Chiswick High Road, London, England, W4 5RG',
  '02046299376',
  'info@dentaflylondon.co.uk',
  '14210443',
  'GB 494897804',
  'Clear Bank',
  'Dentafly Consultancy LTD',
  '04-06-05',
  '26776407',
  '+44 7838 669227',
  FALSE
)
ON CONFLICT (tenant_id, entity_key) DO NOTHING;

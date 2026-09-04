-- Migration: 004_create_whatsapp_configs / Created: 2026-05-17
-- Stores Meta (WhatsApp Business API) credentials per tenant.
-- Access tokens are stored encrypted with pgcrypto to protect them at rest.

BEGIN;

CREATE TABLE IF NOT EXISTS whatsapp_configs (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id              UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name           VARCHAR(255) NOT NULL,
  phone_number_id        VARCHAR(50)  NOT NULL,
  business_account_id    VARCHAR(50)  NOT NULL,
  access_token_encrypted TEXT        NOT NULL,
  webhook_verify_token   TEXT        NOT NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT TRUE,
  daily_message_limit    INT         NOT NULL DEFAULT 1000,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A clinic cannot register the same WhatsApp phone number twice.
  CONSTRAINT uq_whatsapp_configs_tenant_phone UNIQUE (tenant_id, phone_number_id)
);

COMMENT ON TABLE whatsapp_configs IS
  'WhatsApp Business API credentials and settings per tenant. '
  'Each row represents one connected phone number / WABA.';

COMMENT ON COLUMN whatsapp_configs.display_name IS
  'Human-readable name shown in the CareNova UI, e.g. "Dr. Smith Dental".';
COMMENT ON COLUMN whatsapp_configs.phone_number_id IS
  'Meta WhatsApp phone number ID (not the E.164 number itself).';
COMMENT ON COLUMN whatsapp_configs.business_account_id IS
  'Meta WhatsApp Business Account (WABA) ID.';
COMMENT ON COLUMN whatsapp_configs.access_token_encrypted IS
  'Permanent or system-user access token, encrypted with pgp_sym_encrypt. '
  'Decrypt at the application layer using the APP_ENCRYPTION_KEY env variable.';
COMMENT ON COLUMN whatsapp_configs.webhook_verify_token IS
  'Random secret used to verify incoming Meta webhook callbacks.';
COMMENT ON COLUMN whatsapp_configs.is_active IS
  'FALSE disables outbound sending for this config without deleting credentials.';
COMMENT ON COLUMN whatsapp_configs.daily_message_limit IS
  'Soft cap on outbound messages per day. Enforced in the application layer.';

COMMIT;

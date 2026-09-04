-- ============================================================================
-- Migration 026 — Document existing schema (treatment_cases, link_requests,
--                  tenant_billing_profiles)
-- ----------------------------------------------------------------------------
-- PURPOSE: These three tables were originally created directly in the Supabase
-- GUI and were never captured in a migration file. This migration documents
-- their CURRENT live structure so the schema is version-controlled.
--
-- SAFETY: Fully idempotent. Uses CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT
-- EXISTS, and guarded constraint creation. Running this against the live DB
-- (where the tables already exist) makes NO changes. It only recreates the
-- schema from scratch on a fresh/empty database.
--
-- NOTE: Reflects live schema as of 2026-06-22, including the status values
-- (declined/expired/bounced) and lifecycle timestamps (signed_at, paid_at,
-- etc.) added in earlier migrations this session.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- treatment_cases
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treatment_cases (
  id                       uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id                uuid        NOT NULL,
  lead_id                  uuid,
  patient_name             text,
  patient_dob              date,
  patient_address          text,
  patient_phone            text,
  patient_email            text,
  treatment_description    text,
  total_cost               numeric,
  amount_due               numeric,
  payment_method           text        NOT NULL,
  payer_type               text        NOT NULL DEFAULT 'self',
  cardholder_name          text,
  cardholder_relationship  text,
  cardholder_address       text,
  cardholder_phone         text,
  cardholder_email         text,
  card_scheme              text,
  card_first4              text,
  card_last4               text,
  photo_id_type            text,
  photo_id_ref             text,
  status                   text        NOT NULL DEFAULT 'draft',
  created_by               text,
  meta                     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  signed_at                timestamptz,
  payment_sent_at          timestamptz,
  paid_at                  timestamptz,
  declined_at              timestamptz,
  expired_at               timestamptz,
  CONSTRAINT treatment_cases_pkey PRIMARY KEY (id)
);

-- Columns added after original table creation (idempotent for existing DBs)
ALTER TABLE treatment_cases ADD COLUMN IF NOT EXISTS signed_at       timestamptz;
ALTER TABLE treatment_cases ADD COLUMN IF NOT EXISTS payment_sent_at timestamptz;
ALTER TABLE treatment_cases ADD COLUMN IF NOT EXISTS paid_at         timestamptz;
ALTER TABLE treatment_cases ADD COLUMN IF NOT EXISTS declined_at     timestamptz;
ALTER TABLE treatment_cases ADD COLUMN IF NOT EXISTS expired_at      timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cases_tenant') THEN
    ALTER TABLE treatment_cases
      ADD CONSTRAINT fk_cases_tenant FOREIGN KEY (tenant_id)
      REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_cases_lead_id_fkey') THEN
    ALTER TABLE treatment_cases
      ADD CONSTRAINT treatment_cases_lead_id_fkey FOREIGN KEY (lead_id)
      REFERENCES leads(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_cases_payer_type_check') THEN
    ALTER TABLE treatment_cases
      ADD CONSTRAINT treatment_cases_payer_type_check
      CHECK (payer_type = ANY (ARRAY['self','third_party']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_cases_payment_method_check') THEN
    ALTER TABLE treatment_cases
      ADD CONSTRAINT treatment_cases_payment_method_check
      CHECK (payment_method = ANY (ARRAY['finance','bank_transfer','card']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treatment_cases_status_check') THEN
    ALTER TABLE treatment_cases
      ADD CONSTRAINT treatment_cases_status_check
      CHECK (status = ANY (ARRAY[
        'draft','awaiting_signature','signed','payment_sent','paid',
        'finance_referred','reversed','cancelled','declined','expired','bounced'
      ]));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- link_requests
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS link_requests (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL,
  case_id      uuid,
  lead_id      uuid,
  kind         text        NOT NULL,
  recipient    text        NOT NULL DEFAULT 'patient',
  provider     text,
  target_url   text,
  short_token  text        NOT NULL,
  external_ref text,
  channel      text        NOT NULL DEFAULT 'whatsapp',
  status       text        NOT NULL DEFAULT 'created',
  created_by   text,
  meta         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  sent_at      timestamptz,
  opened_at    timestamptz,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT link_requests_pkey PRIMARY KEY (id),
  CONSTRAINT link_requests_short_token_key UNIQUE (short_token)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lr_tenant') THEN
    ALTER TABLE link_requests
      ADD CONSTRAINT fk_lr_tenant FOREIGN KEY (tenant_id)
      REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'link_requests_case_id_fkey') THEN
    ALTER TABLE link_requests
      ADD CONSTRAINT link_requests_case_id_fkey FOREIGN KEY (case_id)
      REFERENCES treatment_cases(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'link_requests_lead_id_fkey') THEN
    ALTER TABLE link_requests
      ADD CONSTRAINT link_requests_lead_id_fkey FOREIGN KEY (lead_id)
      REFERENCES leads(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'link_requests_kind_check') THEN
    ALTER TABLE link_requests
      ADD CONSTRAINT link_requests_kind_check
      CHECK (kind = ANY (ARRAY['signature','payment','bank_details']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'link_requests_recipient_check') THEN
    ALTER TABLE link_requests
      ADD CONSTRAINT link_requests_recipient_check
      CHECK (recipient = ANY (ARRAY['patient','cardholder']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'link_requests_channel_check') THEN
    ALTER TABLE link_requests
      ADD CONSTRAINT link_requests_channel_check
      CHECK (channel = ANY (ARRAY['whatsapp','email','sms']));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'link_requests_status_check') THEN
    ALTER TABLE link_requests
      ADD CONSTRAINT link_requests_status_check
      CHECK (status = ANY (ARRAY['created','sent','opened','completed','expired','cancelled']));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- tenant_billing_profiles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_billing_profiles (
  tenant_id                       uuid        NOT NULL,
  legal_entity_name               text        NOT NULL,
  company_number                  text,
  registered_address              text,
  merchant_descriptor             text,
  contact_phone                   text,
  contact_email                   text,
  bank_name                       text,
  bank_account_name               text,
  sort_code                       text,
  account_number                  text,
  iban                            text,
  trading_name                    text,
  square_payment_link             text,
  square_config                   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  square_access_token_encrypted   text,
  square_location_id              text,
  square_environment              text        DEFAULT 'production',
  square_webhook_signature_key    text,
  signwell_template_self_id       text,
  signwell_template_thirdparty_id text,
  twilio_account_sid              text,
  twilio_auth_token_encrypted     text,
  twilio_messaging_service_sid    text,
  twilio_from_number              text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_billing_profiles_pkey PRIMARY KEY (tenant_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tbp_tenant') THEN
    ALTER TABLE tenant_billing_profiles
      ADD CONSTRAINT fk_tbp_tenant FOREIGN KEY (tenant_id)
      REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- End of migration 026
-- ============================================================================

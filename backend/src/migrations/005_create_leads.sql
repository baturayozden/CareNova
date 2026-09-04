-- Migration: 005_create_leads / Created: 2026-05-17
-- Core leads table. A lead represents a prospective patient at a specific clinic.
-- Includes full GDPR consent tracking and AI follow-up state.

BEGIN;

CREATE TABLE IF NOT EXISTS leads (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_to UUID        REFERENCES users(id) ON DELETE SET NULL,

  -- Contact info
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100),
  phone       VARCHAR(20)  NOT NULL,
  email       CITEXT,

  -- Lead context
  source               VARCHAR(50)  NOT NULL DEFAULT 'manual',
  treatment_interest   VARCHAR(255),
  notes                TEXT,
  language             VARCHAR(5)   NOT NULL DEFAULT 'en',

  -- Status lifecycle
  status             VARCHAR(20)  NOT NULL DEFAULT 'new',
  status_changed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- GDPR / consent
  gdpr_consent_given   BOOLEAN     NOT NULL DEFAULT FALSE,
  gdpr_consent_at      TIMESTAMPTZ,
  gdpr_consent_ip      INET,
  gdpr_consent_method  VARCHAR(20),
  opted_out_at         TIMESTAMPTZ,
  opted_out_reason     VARCHAR(100),
  data_retention_until TIMESTAMPTZ,

  -- AI tracking
  ai_follow_up_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  ai_follow_up_count    INT     NOT NULL DEFAULT 0,
  last_ai_message_at    TIMESTAMPTZ,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,

  -- One lead per phone number per clinic.
  CONSTRAINT uq_leads_tenant_phone UNIQUE (tenant_id, phone),

  CONSTRAINT chk_leads_status CHECK (
    status IN ('new','contacted','responded','qualified','booked','attended','lost','archived')
  ),
  CONSTRAINT chk_leads_language CHECK (
    language IN ('en','tr','ar','de','fr','es','pt','ru','zh')
  )
);

COMMENT ON TABLE leads IS
  'Prospective patients for a clinic. Central entity of the CareNova workflow.';

COMMENT ON COLUMN leads.phone IS
  'WhatsApp-reachable phone number in E.164 format, e.g. +905301234567.';
COMMENT ON COLUMN leads.source IS
  'Origin of the lead: manual, website, referral, ad_campaign, missed_call.';
COMMENT ON COLUMN leads.treatment_interest IS
  'Free-text description of the treatment the lead enquired about, e.g. "implants".';
COMMENT ON COLUMN leads.language IS
  'BCP-47 language tag used to select the AI follow-up message language.';
COMMENT ON COLUMN leads.status IS
  'Lifecycle stage: new → contacted → responded → qualified → booked → attended → lost → archived.';
COMMENT ON COLUMN leads.status_changed_at IS
  'Timestamp of the last status transition. Used for follow-up scheduling.';
COMMENT ON COLUMN leads.gdpr_consent_given IS
  'TRUE once the lead has provided explicit GDPR consent to receive marketing messages.';
COMMENT ON COLUMN leads.gdpr_consent_at IS
  'Exact timestamp when GDPR consent was recorded.';
COMMENT ON COLUMN leads.gdpr_consent_ip IS
  'IP address at the time consent was given. Required for audit under GDPR Art. 7.';
COMMENT ON COLUMN leads.gdpr_consent_method IS
  'How consent was captured: web_form, verbal (logged by staff), or whatsapp reply.';
COMMENT ON COLUMN leads.opted_out_at IS
  'Set when the patient replies STOP or a staff member marks them as opted-out.';
COMMENT ON COLUMN leads.data_retention_until IS
  'Computed as consent_at + 2 years. After this date the row should be anonymised.';
COMMENT ON COLUMN leads.ai_follow_up_enabled IS
  'FALSE disables AI-generated follow-ups for this lead (e.g. already handled manually).';
COMMENT ON COLUMN leads.ai_follow_up_count IS
  'Counter of AI messages sent. Used to enforce per-plan message caps.';
COMMENT ON COLUMN leads.deleted_at IS
  'Soft-delete timestamp. NULL means the lead is visible in the UI.';

COMMIT;

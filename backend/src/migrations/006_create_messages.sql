-- Migration: 006_create_messages / Created: 2026-05-17
-- WhatsApp message log for every inbound and outbound message per lead.
-- Tracks delivery status, AI generation metadata, and WhatsApp message IDs
-- needed for status-update webhooks from Meta.

BEGIN;

CREATE TABLE IF NOT EXISTS messages (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id              UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  whatsapp_config_id   UUID        REFERENCES whatsapp_configs(id) ON DELETE SET NULL,

  direction            VARCHAR(8)   NOT NULL,
  content              TEXT         NOT NULL,
  message_type         VARCHAR(20)  NOT NULL DEFAULT 'text',
  template_name        VARCHAR(100),

  -- WhatsApp metadata
  whatsapp_message_id  VARCHAR(100) UNIQUE,
  status               VARCHAR(20)  NOT NULL DEFAULT 'pending',
  status_updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  error_code           VARCHAR(20),
  error_message        TEXT,

  -- AI metadata
  ai_generated          BOOLEAN NOT NULL DEFAULT FALSE,
  ai_model              VARCHAR(50),
  ai_prompt_tokens      INT,
  ai_completion_tokens  INT,

  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_messages_direction CHECK (direction IN ('inbound', 'outbound')),
  CONSTRAINT chk_messages_status    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  CONSTRAINT chk_messages_type      CHECK (message_type IN ('text', 'template', 'image', 'audio', 'document'))
);

COMMENT ON TABLE messages IS
  'Immutable log of every WhatsApp message exchanged with a lead. '
  'Rows are never updated except to reflect delivery status changes from Meta webhooks.';

COMMENT ON COLUMN messages.direction IS
  'inbound = received from lead; outbound = sent by clinic or AI.';
COMMENT ON COLUMN messages.message_type IS
  'text: plain text; template: approved WhatsApp template; image/audio/document: media.';
COMMENT ON COLUMN messages.template_name IS
  'WhatsApp template name used when message_type = template, e.g. follow_up_v2.';
COMMENT ON COLUMN messages.whatsapp_message_id IS
  'Opaque message ID returned by the Meta Cloud API. Used to correlate status webhooks.';
COMMENT ON COLUMN messages.status IS
  'Delivery pipeline: pending → sent → delivered → read → failed.';
COMMENT ON COLUMN messages.status_updated_at IS
  'Timestamp of the last status change, driven by Meta webhook callbacks.';
COMMENT ON COLUMN messages.error_code IS
  'Meta API error code if status = failed, e.g. 131047.';
COMMENT ON COLUMN messages.ai_generated IS
  'TRUE when the message content was produced by the AI follow-up engine.';
COMMENT ON COLUMN messages.ai_model IS
  'Model identifier used to generate this message, e.g. claude-sonnet-4-6, gpt-4o.';
COMMENT ON COLUMN messages.ai_prompt_tokens IS
  'Input token count for cost attribution and usage analytics.';
COMMENT ON COLUMN messages.ai_completion_tokens IS
  'Output token count for cost attribution and usage analytics.';
COMMENT ON COLUMN messages.sent_at IS
  'NULL until the Meta API confirms the message was accepted for delivery.';

COMMIT;

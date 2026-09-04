-- Migration 032: Add display_phone_number to whatsapp_configs.
-- Stores the human-readable WhatsApp number shown to patients (e.g. '+44 7727 394028').
-- Used by the embeddable widget to surface a "Message us on WhatsApp" button.
-- Idempotent: safe to re-run.

ALTER TABLE whatsapp_configs
  ADD COLUMN IF NOT EXISTS display_phone_number TEXT;

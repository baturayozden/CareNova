-- Migration 021: leads tablosuna eksik iletişim + GDPR kolonları
-- createLead() (manuel/web lead ekleme) bu kolonları kullanıyor.
-- Canlı tablo 005'ten daha eski bir şemada kalmış; bu migration farkı kapatır.
-- Supabase SQL Editor'da ELLE çalıştırılır.

BEGIN;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS email CITEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gdpr_consent_given BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gdpr_consent_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gdpr_consent_method VARCHAR(20);

COMMENT ON COLUMN leads.email IS 'Lead email, optional. Used by manual/web lead entry.';
COMMENT ON COLUMN leads.notes IS 'Free-text staff notes about the lead.';
COMMENT ON COLUMN leads.gdpr_consent_given IS 'TRUE once lead consented to contact (required to enable AI follow-up).';
COMMENT ON COLUMN leads.gdpr_consent_at IS 'Timestamp consent was recorded.';
COMMENT ON COLUMN leads.gdpr_consent_method IS 'How consent was captured: verbal, web_form, whatsapp.';

COMMIT;

-- Migration 069: tenant profile fields + CareNova onboarding progress.
--
-- The admin console shows, per clinic, a legal entity name, a city, a billing
-- currency, and the clinic's position in the 8-step CareNova onboarding
-- (Klinik bilgisi → … → Test → canlı). None of these had a column: tenants
-- stored only name/slug/address/phone/email.
--
--   legal_name                 Ticari unvan (e.g. "… Sağlık Hiz. A.Ş.")
--   city                       Shown and filtered on in the clinic list
--   currency                   ISO 4217; CareNova bills in EUR (utils/format.ts
--                              already carried a TODO waiting for this column)
--   onboarding_step            0..7, 7 = live
--   onboarding_step_started_at when the clinic entered its current step
--
-- "Stuck" is deliberately NOT stored: it is derived (time on the current step
-- versus a threshold) so it cannot go stale.
--
-- NOT fixed here: routes/onboarding.js reads CareDental's onboarding columns
-- (onboarding_status, notification_email, activated, activated_at,
-- first_booking_at) that no migration created, so GET/PATCH /api/onboarding
-- 500 against the real database. That route belongs to the clinic-side wizard
-- and is out of this change's scope; it is reported, not silently patched.

BEGIN;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS legal_name                 VARCHAR(200),
  ADD COLUMN IF NOT EXISTS city                       VARCHAR(120),
  ADD COLUMN IF NOT EXISTS currency                   CHAR(3) NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS onboarding_step            SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_step_started_at TIMESTAMPTZ;

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS chk_tenants_onboarding_step;
ALTER TABLE tenants ADD CONSTRAINT chk_tenants_onboarding_step
  CHECK (onboarding_step BETWEEN 0 AND 7);

COMMIT;

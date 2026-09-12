-- Migration 067: plan_tier → CareNova's packages (solo / klinik / grup).
--
-- chk_tenants_plan_tier still accepted CareDental's tiers
-- (free/starter/growth/pro/enterprise). CareNova sells three packages —
-- Solo €149 / Klinik €449 / Grup €1.190 monthly when billed annually
-- (CARENOVA-STRATEJI.md L748). A panel showing "growth" for a clinic on the
-- Klinik package is a product mismatch, and a CHECK that rejects 'klinik'
-- makes the real plan unstorable.
--
-- Existing rows are mapped before the new constraint is added, otherwise the
-- ADD CONSTRAINT would fail on them:
--   free, starter  -> solo      (entry tier)
--   growth         -> klinik    (the only value in use today: carenova-demo)
--   pro, enterprise-> grup      (multi-location tier)
--
-- routes/clinics.js defaulted new clinics to 'starter'; it is changed to
-- 'solo' in the same commit, or clinic creation would start failing here.

BEGIN;

ALTER TABLE tenants DROP CONSTRAINT IF EXISTS chk_tenants_plan_tier;

UPDATE tenants SET plan_tier = CASE plan_tier
  WHEN 'free'       THEN 'solo'
  WHEN 'starter'    THEN 'solo'
  WHEN 'growth'     THEN 'klinik'
  WHEN 'pro'        THEN 'grup'
  WHEN 'enterprise' THEN 'grup'
  ELSE plan_tier
END
WHERE plan_tier IN ('free','starter','growth','pro','enterprise');

ALTER TABLE tenants ALTER COLUMN plan_tier SET DEFAULT 'solo';

ALTER TABLE tenants ADD CONSTRAINT chk_tenants_plan_tier
  CHECK (plan_tier IN ('solo','klinik','grup'));

COMMIT;

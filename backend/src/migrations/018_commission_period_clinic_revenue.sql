-- ============================================================
-- Migration 018: Add clinic_revenue to commission_periods
-- ============================================================
-- clinicActualRevenue for a commission period is NOT derived from
-- treatment_deals — those only cover TC-originated deals and do not
-- represent total clinic revenue (which includes dentist work, hygienist
-- appointments, etc.).
--
-- clinic_revenue is entered by the director / clinic_admin from the
-- practice management system (Dentally, SOE, etc.) before running
-- POST /periods/:id/calculate.
--
-- NULL means the value has not been entered yet; the calculate endpoint
-- will reject the call with a 400 if this field is NULL.
--
-- Run manually in Supabase SQL Editor.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name  = 'commission_periods'
       AND column_name = 'clinic_revenue'
  ) THEN
    ALTER TABLE commission_periods
      ADD COLUMN clinic_revenue NUMERIC(12,2) DEFAULT NULL;

    COMMENT ON COLUMN commission_periods.clinic_revenue IS
      'Total actual clinic revenue for this period (entered manually from PMS). '
      'Used as clinicActualRevenue in the commission engine. '
      'Must be set before calling /calculate.';
  END IF;
END;
$$;

COMMIT;

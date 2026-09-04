-- Migration 033: Add 'pay_by_bank' to treatment_cases.payment_method allowed values.
-- The existing CHECK constraint only covers ['finance','bank_transfer','card'].
-- We must DROP + re-ADD (PostgreSQL does not support ALTER CHECK in-place).
-- Idempotent: both steps guard with IF EXISTS / IF NOT EXISTS.

DO $$
BEGIN
  -- Drop old constraint if still present
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'treatment_cases_payment_method_check'
  ) THEN
    ALTER TABLE treatment_cases
      DROP CONSTRAINT treatment_cases_payment_method_check;
  END IF;

  -- Add updated constraint including 'pay_by_bank'
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'treatment_cases_payment_method_check'
  ) THEN
    ALTER TABLE treatment_cases
      ADD CONSTRAINT treatment_cases_payment_method_check
      CHECK (payment_method = ANY (ARRAY['finance','bank_transfer','card','pay_by_bank']));
  END IF;
END
$$;

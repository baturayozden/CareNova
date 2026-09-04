-- Migration 045: add 'cash' to treatment_cases payment_method check constraint

ALTER TABLE treatment_cases
  DROP CONSTRAINT IF EXISTS treatment_cases_payment_method_check;

ALTER TABLE treatment_cases
  ADD CONSTRAINT treatment_cases_payment_method_check
  CHECK (payment_method IN ('finance', 'bank_transfer', 'card', 'pay_by_bank', 'cash'));

-- Migration 046: add case_id, balance_due_date, balance_reminder_sent_at to treatment_deals
-- billing_entity_id already exists from migration 044 — do not re-add.

ALTER TABLE treatment_deals
  ADD COLUMN IF NOT EXISTS case_id                  UUID        REFERENCES treatment_cases(id),
  ADD COLUMN IF NOT EXISTS balance_due_date         DATE,
  ADD COLUMN IF NOT EXISTS balance_reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_treatment_deals_case_id ON treatment_deals(case_id);

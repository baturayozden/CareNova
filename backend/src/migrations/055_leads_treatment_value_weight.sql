-- Migration 055: Add branch-agnostic treatment_value_weight to leads.
-- Replaces CareNova's hardcoded per-procedure point values (implant=25, veneers=20...)
-- in lead scoring. NULL falls back to a neutral default in leadScoring.js until the
-- branch template engine (PAKET 6) populates it from the clinic's active branch template.
BEGIN;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS treatment_value_weight SMALLINT;

COMMIT;

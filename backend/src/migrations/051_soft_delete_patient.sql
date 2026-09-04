-- Soft-delete columns for patient-linked tables.
-- leads already has deleted_at (migration 005).
ALTER TABLE treatment_deals    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE treatment_cases    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE patient_documents  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE invoices           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_treatment_deals_deleted_at    ON treatment_deals   (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_treatment_cases_deleted_at    ON treatment_cases   (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_documents_deleted_at  ON patient_documents (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at           ON invoices          (deleted_at) WHERE deleted_at IS NULL;

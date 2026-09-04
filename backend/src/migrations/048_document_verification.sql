-- 048: AI pre-screening + human verification columns for patient_documents
ALTER TABLE patient_documents
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (verification_status IN ('unreviewed', 'flagged', 'human_approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS ai_flags       JSONB,
  ADD COLUMN IF NOT EXISTS ai_analysis    TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_patient_documents_verification
  ON patient_documents(tenant_id, verification_status);

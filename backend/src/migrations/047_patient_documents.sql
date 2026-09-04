-- 047: patient documents (ID/passport uploads via Supabase Storage)
CREATE TABLE IF NOT EXISTS patient_documents (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id       UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  doc_type      TEXT        NOT NULL DEFAULT 'id',
  file_path     TEXT        NOT NULL,
  original_name TEXT,
  mime_type     TEXT,
  uploaded_by   UUID        REFERENCES users(id),
  uploaded_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_documents_lead ON patient_documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_tenant ON patient_documents(tenant_id);

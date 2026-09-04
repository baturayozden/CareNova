-- 049: manual checklist items per patient (e.g. physical ID check at reception)
CREATE TABLE IF NOT EXISTS patient_checklist_manual (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id    UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  item_key   TEXT        NOT NULL,       -- e.g. 'physical_id_check'
  checked    BOOLEAN     NOT NULL DEFAULT FALSE,
  checked_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  UNIQUE (lead_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_checklist_manual_lead
  ON patient_checklist_manual(lead_id);

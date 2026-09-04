-- Race-safe per-tenant-per-year invoice counter
CREATE TABLE IF NOT EXISTS invoice_counters (
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year        INT  NOT NULL,
  last_number INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, year)
);

-- Invoices (UK-standard, VAT-exempt)
CREATE TABLE IF NOT EXISTS invoices (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number        TEXT        NOT NULL,
  case_id               UUID        REFERENCES treatment_cases(id) ON DELETE SET NULL,
  lead_id               UUID        REFERENCES leads(id)           ON DELETE SET NULL,
  patient_name          TEXT        NOT NULL,
  patient_email         TEXT,
  patient_address       TEXT,
  treatment_description TEXT,
  amount                NUMERIC(10,2) NOT NULL,
  payment_method        TEXT,
  payment_status        TEXT        NOT NULL DEFAULT 'unpaid',
  issued_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_lead   ON invoices(lead_id);
CREATE INDEX IF NOT EXISTS idx_invoices_case   ON invoices(case_id);

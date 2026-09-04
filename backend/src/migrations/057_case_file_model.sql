-- Migration 057: Case File model (CARENOVA-STRATEJI.md Bölüm 7/M1).
--
-- Medical tourism's unit of work is a CASE, not a lead: a single patient
-- involves passport, flights, hotel, companions, interpreter, multiple
-- procedures, installment payments, and a year of aftercare. A lead is still
-- the first-contact record; when it qualifies, a case is born (leads.case_id
-- is nullable — most leads never become a case).
--
-- NOT executed tonight (no reachable database — see BLOKAJLAR.md). Written
-- and reviewed for syntax only. Rollback path at the bottom.
BEGIN;

CREATE TABLE IF NOT EXISTS cases (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id              UUID REFERENCES leads(id) ON DELETE SET NULL,
  case_number             VARCHAR(20) NOT NULL,               -- e.g. CN-2026-0142
  branch_key              VARCHAR(40),                         -- FK added in 058 once branch_templates exists
  status                  VARCHAR(30) NOT NULL DEFAULT 'new',
  source_channel          VARCHAR(40),
  source_campaign         VARCHAR(100),
  assigned_consultant_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_doctor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_coordinator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_interpreter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  patient_country         VARCHAR(2),                          -- ISO 3166-1 alpha-2
  patient_language        VARCHAR(5),
  patient_timezone        VARCHAR(60),                         -- IANA tz, distinct from clinic tz (M0.5)
  medical_eligibility     VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (medical_eligibility IN ('pending','eligible','conditional','ineligible')),
  eligibility_note        TEXT,
  eligibility_decided_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  eligibility_decided_at  TIMESTAMPTZ,
  currency                VARCHAR(3) NOT NULL DEFAULT 'EUR',
  estimated_value         NUMERIC(12,2),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at              TIMESTAMPTZ,

  CONSTRAINT chk_cases_status CHECK (status IN (
    'new','qualified','pre_assessment','awaiting_doctor','quoted','awaiting_deposit',
    'reserved','travel_planned','arrived','treated','returned','in_aftercare','completed',
    'lost','medically_ineligible'
  )),
  CONSTRAINT uq_cases_tenant_number UNIQUE (tenant_id, case_number)
);

CREATE INDEX IF NOT EXISTS idx_cases_tenant_status ON cases(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cases_patient ON cases(patient_id);

-- A lead becomes a case at qualification time; nullable, most leads stay leads.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES cases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_case_id ON leads(case_id) WHERE case_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS case_companions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  relationship  VARCHAR(60),
  phone         VARCHAR(30),
  flight_info   JSONB,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_companions_case ON case_companions(case_id);

CREATE TABLE IF NOT EXISTS case_media (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id           UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  kind              VARCHAR(20) NOT NULL CHECK (kind IN ('photo','scan','report','document')),
  whatsapp_media_id VARCHAR(120),
  storage_path      TEXT,
  template_slot_id  VARCHAR(60),                 -- maps to branch_templates.required_media[].id
  quality_ok        BOOLEAN,
  ai_extraction     JSONB,                        -- structured AI read of the media; NEVER shown to the patient (M0.3)
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by       UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_case_media_case ON case_media(case_id);

CREATE TABLE IF NOT EXISTS case_assessments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  template_key  VARCHAR(40) NOT NULL,
  answers       JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_case_assessments_case ON case_assessments(case_id);

CREATE TABLE IF NOT EXISTS case_timeline (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  day_offset  INTEGER,                            -- e.g. -1, 0, +1 relative to procedure day
  title       JSONB NOT NULL,                      -- i18n: {"tr": "...", "en": "..."}
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  location    VARCHAR(200),
  type        VARCHAR(20) NOT NULL CHECK (type IN ('consultation','procedure','checkup','transfer','flight','hotel')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_timeline_case ON case_timeline(case_id);

-- Append-only audit trail — critical for KVKK (CARENOVA-STRATEJI.md Bölüm 7/M7.3).
-- Enforced append-only at the application layer tonight; a DB-level trigger
-- blocking UPDATE/DELETE is listed as a KOMUT 15 (launch-readiness) task.
CREATE TABLE IF NOT EXISTS case_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_type  VARCHAR(60) NOT NULL,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_events_case_created ON case_events(case_id, created_at);

COMMIT;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TABLE IF EXISTS case_events;
-- DROP TABLE IF EXISTS case_timeline;
-- DROP TABLE IF EXISTS case_assessments;
-- DROP TABLE IF EXISTS case_media;
-- DROP TABLE IF EXISTS case_companions;
-- ALTER TABLE leads DROP COLUMN IF EXISTS case_id;
-- DROP TABLE IF EXISTS cases;
-- COMMIT;

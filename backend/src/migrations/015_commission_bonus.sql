-- ============================================================
-- Migration 015: Bonus & Commission Tracking System
-- ============================================================
-- Run manually in Supabase SQL Editor.
-- All money/rate columns use NUMERIC (never FLOAT).
--
-- Data model note: CareNova has no separate 'clinics' table.
-- Clinics are represented by rows in the 'tenants' table.
-- All clinic references use tenant_id → REFERENCES tenants(id).
--
-- Circular FK between treatment_deals ↔ payment_records is
-- resolved by creating payment tables first, then adding
-- the matched_payment_id FK via ALTER TABLE after treatment_deals.
--
-- User references:
--   staff_id (commission_records)          → REFERENCES users(id) ON DELETE RESTRICT
--   All other actor columns (imported_by,
--     locked_by, paid_by, approved_by,
--     assigned_staff_id, changed_by)       → REFERENCES users(id) ON DELETE SET NULL
-- ============================================================

BEGIN;

-- ── Ensure update_updated_at_column() trigger function exists ────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 1. commission_schemes ─────────────────────────────────────────────────────
-- Defines a named commission plan attached to a tenant.
-- type: 'flat_rate' | 'tiered' | 'target_based'

CREATE TABLE IF NOT EXISTS commission_schemes (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT         NOT NULL,           -- e.g. "Standard 2026", "Senior Band"
  description    TEXT,
  type           TEXT         NOT NULL
                   CHECK (type IN ('flat_rate', 'tiered', 'target_based')),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  effective_from DATE         NOT NULL,
  effective_to   DATE,                            -- NULL = open-ended
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_schemes_tenant
  ON commission_schemes(tenant_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_commission_schemes'
  ) THEN
    CREATE TRIGGER set_updated_at_commission_schemes
      BEFORE UPDATE ON commission_schemes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ── 2. commission_tiers ───────────────────────────────────────────────────────
-- Tiered rate bands for a 'tiered' or 'target_based' scheme.
-- min_revenue & max_revenue are monthly band limits (NULL max = unlimited).

CREATE TABLE IF NOT EXISTS commission_tiers (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id    UUID          NOT NULL REFERENCES commission_schemes(id) ON DELETE CASCADE,
  tier_order   INTEGER       NOT NULL,            -- 1 = lowest band
  min_revenue  NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_revenue  NUMERIC(12,2),                     -- NULL = no cap
  rate_percent NUMERIC(6,4)  NOT NULL,            -- e.g. 5.0000 = 5 %
  flat_bonus   NUMERIC(10,2) NOT NULL DEFAULT 0,  -- additional flat bonus when tier hit
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_commission_tier_order UNIQUE (scheme_id, tier_order),
  CONSTRAINT chk_tier_revenue CHECK (max_revenue IS NULL OR max_revenue > min_revenue)
);

CREATE INDEX IF NOT EXISTS idx_commission_tiers_scheme
  ON commission_tiers(scheme_id);

-- ── 3. clinic_revenue_targets ─────────────────────────────────────────────────
-- Monthly or quarterly revenue targets per tenant (clinic), used for
-- target_based commission schemes. tenant_id is the sole clinic reference
-- (there is no separate clinics table — tenants are clinics).

CREATE TABLE IF NOT EXISTS clinic_revenue_targets (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start  DATE          NOT NULL,           -- first day of the period
  period_end    DATE          NOT NULL,
  target_type   TEXT          NOT NULL DEFAULT 'monthly'
                  CHECK (target_type IN ('monthly', 'quarterly', 'annual')),
  target_amount NUMERIC(12,2) NOT NULL,
  currency      TEXT          NOT NULL DEFAULT 'GBP',
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_clinic_revenue_target UNIQUE (tenant_id, period_start, target_type),
  CONSTRAINT chk_target_period CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_clinic_revenue_targets_tenant_period
  ON clinic_revenue_targets(tenant_id, period_start);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_clinic_revenue_targets'
  ) THEN
    CREATE TRIGGER set_updated_at_clinic_revenue_targets
      BEFORE UPDATE ON clinic_revenue_targets
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ── 4. commission_performance_thresholds ─────────────────────────────────────
-- Per-scheme multipliers applied when a staff member hits performance gates.
-- e.g. 90 % of target → 0.8× base rate; 110 % → 1.25× base rate.

CREATE TABLE IF NOT EXISTS commission_performance_thresholds (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id      UUID          NOT NULL REFERENCES commission_schemes(id) ON DELETE CASCADE,
  target_percent NUMERIC(6,2)  NOT NULL,          -- e.g. 90.00 = 90 % of target
  multiplier     NUMERIC(5,4)  NOT NULL DEFAULT 1.0000,  -- 1.0000 = no adjustment
  label          TEXT,                            -- e.g. "Below target", "Overachiever"
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_perf_threshold UNIQUE (scheme_id, target_percent)
);

CREATE INDEX IF NOT EXISTS idx_commission_perf_thresholds_scheme
  ON commission_performance_thresholds(scheme_id);

-- ── 5. team_bonus_tiers ───────────────────────────────────────────────────────
-- Clinic-level (team) bonus paid out when the whole clinic hits a revenue gate.
-- Scoped to tenant_id (= clinic). No separate clinic_id column needed.

CREATE TABLE IF NOT EXISTS team_bonus_tiers (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tier_order      INTEGER       NOT NULL,
  min_revenue     NUMERIC(12,2) NOT NULL,
  max_revenue     NUMERIC(12,2),                  -- NULL = no cap
  bonus_per_staff NUMERIC(10,2) NOT NULL DEFAULT 0,  -- flat bonus per eligible staff member
  bonus_pool      NUMERIC(10,2) NOT NULL DEFAULT 0,  -- alternative: shared pool split equally
  split_method    TEXT          NOT NULL DEFAULT 'per_staff'
                    CHECK (split_method IN ('per_staff', 'pool_equal', 'pool_weighted')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_team_bonus_tier UNIQUE (tenant_id, tier_order),
  CONSTRAINT chk_team_bonus_revenue CHECK (max_revenue IS NULL OR max_revenue > min_revenue)
);

CREATE INDEX IF NOT EXISTS idx_team_bonus_tiers_tenant
  ON team_bonus_tiers(tenant_id);

-- ── 6. payment_imports ───────────────────────────────────────────────────────
-- One row per file/batch imported from an external system (Dentally, CSV, etc.)
-- Created BEFORE treatment_deals to allow payment_records FK (circular FK fix).

CREATE TABLE IF NOT EXISTS payment_imports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source        TEXT        NOT NULL
                  CHECK (source IN ('dentally', 'csv', 'manual', 'api')),
  filename      TEXT,                             -- original upload filename
  imported_by   UUID        REFERENCES users(id) ON DELETE SET NULL,  -- who triggered the import
  row_count     INTEGER     NOT NULL DEFAULT 0,
  matched_count INTEGER     NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  error_message TEXT,
  imported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_imports_tenant
  ON payment_imports(tenant_id, imported_at DESC);

-- ── 7. payment_records ───────────────────────────────────────────────────────
-- Individual payment line items, created by import or manual entry.
-- treatment_deal_id added via ALTER TABLE below to break the circular FK.

CREATE TABLE IF NOT EXISTS payment_records (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  import_id          UUID          REFERENCES payment_imports(id) ON DELETE SET NULL,
  external_ref       TEXT,                        -- Dentally payment ID, invoice no., etc.
  patient_name       TEXT,
  treatment_date     DATE,
  payment_date       DATE          NOT NULL,
  gross_amount       NUMERIC(10,2) NOT NULL,
  discount_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_amount         NUMERIC(10,2) GENERATED ALWAYS AS (gross_amount - discount_amount) STORED,
  currency           TEXT          NOT NULL DEFAULT 'GBP',
  payment_method     TEXT
                       CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'finance', 'other')),
  treatment_category TEXT,                        -- e.g. 'implant', 'orthodontics', 'general'
  is_refund          BOOLEAN       NOT NULL DEFAULT FALSE,
  match_status       TEXT          NOT NULL DEFAULT 'unmatched'
                       CHECK (match_status IN ('unmatched', 'matched', 'partial', 'disputed')),
  match_confidence   NUMERIC(5,2),               -- 0-100 auto-match confidence score
  notes              TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_payment_external_ref UNIQUE (tenant_id, external_ref)
    DEFERRABLE INITIALLY DEFERRED                -- allow import-then-dedupe pattern
);

CREATE INDEX IF NOT EXISTS idx_payment_records_tenant_date
  ON payment_records(tenant_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_payment_records_match_status
  ON payment_records(match_status) WHERE match_status != 'matched';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_payment_records'
  ) THEN
    CREATE TRIGGER set_updated_at_payment_records
      BEFORE UPDATE ON payment_records
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ── 8. treatment_deals ────────────────────────────────────────────────────────
-- CRM-side treatment opportunity — created when a lead converts or staff logs a case.
-- matched_payment_id FK added via ALTER TABLE AFTER this table is created (circular FK fix).

CREATE TABLE IF NOT EXISTS treatment_deals (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id             UUID          REFERENCES leads(id) ON DELETE SET NULL,
  assigned_staff_id   UUID          REFERENCES users(id) ON DELETE SET NULL,  -- treatment coordinator
  treatment_category  TEXT          NOT NULL,     -- e.g. 'implant', 'invisalign', 'composite'
  treatment_name      TEXT,
  quoted_amount       NUMERIC(10,2),
  agreed_amount       NUMERIC(10,2),
  deposit_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency            TEXT          NOT NULL DEFAULT 'GBP',
  deal_date           DATE          NOT NULL DEFAULT CURRENT_DATE,
  expected_start_date DATE,
  status              TEXT          NOT NULL DEFAULT 'quoted'
                        CHECK (status IN ('quoted', 'accepted', 'in_progress', 'completed', 'cancelled', 'refunded')),
  -- matched_payment_id: FK constraint added below (circular FK to payment_records)
  matched_payment_id  UUID,
  commission_locked   BOOLEAN       NOT NULL DEFAULT FALSE,  -- TRUE once commission_record finalised
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treatment_deals_tenant
  ON treatment_deals(tenant_id);

CREATE INDEX IF NOT EXISTS idx_treatment_deals_tenant_date
  ON treatment_deals(tenant_id, deal_date DESC);

CREATE INDEX IF NOT EXISTS idx_treatment_deals_assigned_staff
  ON treatment_deals(assigned_staff_id);

CREATE INDEX IF NOT EXISTS idx_treatment_deals_lead
  ON treatment_deals(lead_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_treatment_deals'
  ) THEN
    CREATE TRIGGER set_updated_at_treatment_deals
      BEFORE UPDATE ON treatment_deals
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ── Resolve circular FK: treatment_deals.matched_payment_id → payment_records ─
-- Both tables now exist; safe to add the FK constraint.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_treatment_deal_matched_payment'
  ) THEN
    ALTER TABLE treatment_deals
      ADD CONSTRAINT fk_treatment_deal_matched_payment
        FOREIGN KEY (matched_payment_id)
        REFERENCES payment_records(id)
        ON DELETE SET NULL;
  END IF;
END;
$$;

-- ── Reverse link: payment_records.treatment_deal_id → treatment_deals ─────────
-- Added separately so each table is self-contained above.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'payment_records'::regclass
      AND attname   = 'treatment_deal_id'
      AND attnum    > 0
  ) THEN
    ALTER TABLE payment_records
      ADD COLUMN treatment_deal_id UUID REFERENCES treatment_deals(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_payment_records_deal
      ON payment_records(treatment_deal_id);
  END IF;
END;
$$;

-- ── 9. commission_periods ─────────────────────────────────────────────────────
-- Represents one calculation cycle (usually a calendar month) for a given tenant.
-- status: 'open' → 'locked' → 'paid'. locked_by / paid_by track who actioned each step.

CREATE TABLE IF NOT EXISTS commission_periods (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start          DATE          NOT NULL,
  period_end            DATE          NOT NULL,
  period_label          TEXT          NOT NULL,   -- e.g. "May 2026"
  status                TEXT          NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'locked', 'paid', 'disputed')),
  locked_at             TIMESTAMPTZ,
  locked_by             UUID          REFERENCES users(id) ON DELETE SET NULL,  -- who locked the period
  paid_at               TIMESTAMPTZ,
  paid_by               UUID          REFERENCES users(id) ON DELETE SET NULL,  -- who marked as paid
  total_commission_paid NUMERIC(12,2),            -- set when period closed
  notes                 TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_commission_period UNIQUE (tenant_id, period_start),
  CONSTRAINT chk_commission_period CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_commission_periods_tenant_start
  ON commission_periods(tenant_id, period_start DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_commission_periods'
  ) THEN
    CREATE TRIGGER set_updated_at_commission_periods
      BEFORE UPDATE ON commission_periods
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ── 10. commission_records ────────────────────────────────────────────────────
-- One row per staff member per period — their final calculated commission/bonus.
--
-- staff_id: the subject of this record (NOT NULL, ON DELETE RESTRICT).
--   A user with commission records cannot be hard-deleted from the DB;
--   use soft-delete (is_active=false / deleted_at) instead.
-- approved_by: the manager who approved payout (nullable until approved).

CREATE TABLE IF NOT EXISTS commission_records (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id         UUID          NOT NULL REFERENCES commission_periods(id) ON DELETE CASCADE,
  tenant_id         UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id          UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scheme_id         UUID          REFERENCES commission_schemes(id) ON DELETE SET NULL,

  -- Revenue aggregates
  total_revenue     NUMERIC(12,2) NOT NULL DEFAULT 0,
  target_revenue    NUMERIC(12,2),                -- from clinic_revenue_targets
  target_attainment NUMERIC(6,2),                 -- actual / target * 100

  -- Breakdown
  base_commission   NUMERIC(10,2) NOT NULL DEFAULT 0,   -- from scheme tiers/rate
  performance_bonus NUMERIC(10,2) NOT NULL DEFAULT 0,   -- threshold multiplier delta
  team_bonus        NUMERIC(10,2) NOT NULL DEFAULT 0,   -- from team_bonus_tiers
  adjustment_amount NUMERIC(10,2) NOT NULL DEFAULT 0,   -- manual override (+ or -)
  adjustment_reason TEXT,
  total_commission  NUMERIC(10,2) GENERATED ALWAYS AS
                      (base_commission + performance_bonus + team_bonus + adjustment_amount) STORED,

  status            TEXT          NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'approved', 'paid', 'disputed')),
  approved_by       UUID          REFERENCES users(id) ON DELETE SET NULL,  -- approving manager
  approved_at       TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_commission_record_staff_period UNIQUE (period_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_commission_records_period
  ON commission_records(period_id);

CREATE INDEX IF NOT EXISTS idx_commission_records_staff
  ON commission_records(staff_id);

CREATE INDEX IF NOT EXISTS idx_commission_records_tenant
  ON commission_records(tenant_id, period_id DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_commission_records'
  ) THEN
    CREATE TRIGGER set_updated_at_commission_records
      BEFORE UPDATE ON commission_records
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ── 11. commission_audit_log ──────────────────────────────────────────────────
-- Immutable append-only trail for every change to a commission_record.
-- No updated_at — rows are never modified after insert.

CREATE TABLE IF NOT EXISTS commission_audit_log (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_record_id UUID          NOT NULL REFERENCES commission_records(id) ON DELETE CASCADE,
  tenant_id            UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type           TEXT          NOT NULL
                         CHECK (event_type IN (
                           'created', 'recalculated', 'adjusted', 'approved',
                           'paid', 'disputed', 'status_change'
                         )),
  changed_by           UUID          REFERENCES users(id) ON DELETE SET NULL,  -- actor; NULL = system
  previous_total       NUMERIC(10,2),
  new_total            NUMERIC(10,2),
  delta                NUMERIC(10,2) GENERATED ALWAYS AS (
                         COALESCE(new_total, 0) - COALESCE(previous_total, 0)
                       ) STORED,
  metadata             JSONB,                     -- arbitrary diff / context
  note                 TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_audit_record
  ON commission_audit_log(commission_record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commission_audit_tenant
  ON commission_audit_log(tenant_id, created_at DESC);

COMMIT;

-- Migration 034: clinic_branches — multi-branch foundation.
-- Creates clinic_branches as a first-class entity (one-to-many per tenant).
-- Adds branch_id to appointments (nullable — existing rows remain valid).
-- clinic_availability stays tenant-wide for now; branch-level scheduling is a later phase.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS clinic_branches (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  address    TEXT,
  postcode   TEXT,
  phone      TEXT,
  is_primary BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_branches_tenant
  ON clinic_branches (tenant_id)
  WHERE is_active = TRUE;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES clinic_branches(id);

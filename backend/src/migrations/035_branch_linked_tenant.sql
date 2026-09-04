-- Migration 035: Add linked_tenant_id to clinic_branches.
-- NULL = normal branch (appointment stays in same tenant).
-- Non-NULL = cross-tenant bridge: appointment is written to the linked tenant instead.
-- Idempotent: safe to re-run.

ALTER TABLE clinic_branches
  ADD COLUMN IF NOT EXISTS linked_tenant_id UUID REFERENCES tenants(id);

-- Migration: 008_create_audit_logs / Created: 2026-05-17
-- APPEND-ONLY audit log for all significant data mutations.
-- IMPORTANT: This table must never be updated or deleted from.
-- PostgreSQL rules below enforce the append-only constraint at the database level.

BEGIN;

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id   UUID        REFERENCES tenants(id) ON DELETE SET NULL,
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,

  action      VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id   UUID,

  old_values  JSONB,
  new_values  JSONB,

  ip_address  INET,
  user_agent  TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS
  'Append-only compliance audit trail. UPDATE and DELETE are blocked by database rules. '
  'Captures all create/update/delete events plus auth events (login, logout, export, opt-out).';

COMMENT ON COLUMN audit_logs.tenant_id IS
  'NULL-safe FK: set to NULL if the tenant is later deleted (preserves audit history).';
COMMENT ON COLUMN audit_logs.user_id IS
  'NULL-safe FK: set to NULL if the user is later deleted (preserves audit history).';
COMMENT ON COLUMN audit_logs.action IS
  'Verb describing what happened: created, updated, deleted, login, logout, exported, opted_out.';
COMMENT ON COLUMN audit_logs.entity_type IS
  'Which domain object was affected: lead, message, user, whatsapp_config, subscription.';
COMMENT ON COLUMN audit_logs.entity_id IS
  'UUID of the affected row. NULL for auth events that are not tied to a single entity.';
COMMENT ON COLUMN audit_logs.old_values IS
  'JSON snapshot of the row before the change. NULL for create events.';
COMMENT ON COLUMN audit_logs.new_values IS
  'JSON snapshot of the row after the change. NULL for delete events.';
COMMENT ON COLUMN audit_logs.ip_address IS
  'Originating IP address of the request, recorded for security and GDPR compliance.';

-- ---------------------------------------------------------------------------
-- Enforce append-only: block all UPDATE and DELETE on audit_logs.
-- Any attempt silently does nothing at the database level.
-- ---------------------------------------------------------------------------

CREATE RULE no_update_audit_logs AS
  ON UPDATE TO audit_logs DO INSTEAD NOTHING;

CREATE RULE no_delete_audit_logs AS
  ON DELETE TO audit_logs DO INSTEAD NOTHING;

COMMIT;

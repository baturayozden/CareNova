-- Migration: 070_audit_logs_append_only_trigger
--
-- Keeps audit_logs append-only, and makes the promise in its own column
-- comments actually hold.
--
-- THE BUG. Migration 008 enforced append-only with two rules:
--   CREATE RULE no_update_audit_logs AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
--   CREATE RULE no_delete_audit_logs AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
-- and declared tenant_id / user_id as "NULL-safe FK: set to NULL if the
-- tenant/user is later deleted (preserves audit history)" — ON DELETE SET NULL.
-- Those two cannot coexist. A SET NULL cascade is an UPDATE; the rule rewrites
-- it into nothing; PostgreSQL's referential-integrity trigger then aborts with
--   referential integrity query on "users" from constraint
--   "audit_logs_user_id_fkey" on "audit_logs" gave unexpected result
-- for EVERY user or tenant delete — even when audit_logs holds no row that
-- references it (verified on a schema copy, Sept 2026). In practice no tenant
-- and no user could be hard-deleted: not a KVKK erasure, not a demo purge.
--
-- A second, quieter problem: DO INSTEAD NOTHING fails silently. Code that
-- tried to DELETE or UPDATE the log was told it succeeded (0 rows).
--
-- THE FIX. Replace the rules with a trigger that:
--   * rejects DELETE and TRUNCATE loudly (an error, not a silent no-op);
--   * rejects every UPDATE except the one the schema itself declares: nulling
--     tenant_id and/or user_id when the referenced tenant/user is deleted, with
--     every other column untouched. That is exactly the FK cascade, and it is
--     what "preserves audit history" means — the event stays, the pointer to a
--     row that no longer exists goes.
-- The log stays append-only for every other purpose.

BEGIN;

CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- UPDATE: only the ON DELETE SET NULL cascade may pass.
  IF (NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id OR NEW.tenant_id IS NULL)
     AND (NEW.user_id IS NOT DISTINCT FROM OLD.user_id OR NEW.user_id IS NULL)
     AND (to_jsonb(NEW) - 'tenant_id' - 'user_id') = (to_jsonb(OLD) - 'tenant_id' - 'user_id')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'audit_logs is append-only: UPDATE is not allowed'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP RULE IF EXISTS no_update_audit_logs ON audit_logs;
DROP RULE IF EXISTS no_delete_audit_logs ON audit_logs;

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only();

COMMENT ON TABLE audit_logs IS
  'Append-only compliance audit trail. DELETE, TRUNCATE and UPDATE raise an error (trigger trg_audit_logs_append_only, migration 070); the only permitted UPDATE is the ON DELETE SET NULL cascade of tenant_id/user_id.';

COMMIT;

-- Migration 052: Allow commission_audit_log rows without a commission_record_id.
-- Needed for deal-level status-change events (case→deal sync) that are not yet
-- attached to a commission period record.
BEGIN;

ALTER TABLE commission_audit_log
  ALTER COLUMN commission_record_id DROP NOT NULL;

COMMIT;

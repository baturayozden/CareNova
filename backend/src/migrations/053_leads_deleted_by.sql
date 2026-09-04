-- Migration 053: Add deleted_by audit column to leads.
-- Records which admin user triggered the soft-delete (GDPR audit trail).
BEGIN;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

COMMIT;

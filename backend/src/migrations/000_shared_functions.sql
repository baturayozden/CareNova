-- Migration: 000_shared_functions
-- Shared helper functions that later migrations depend on.
--
-- WHY THIS FILE EXISTS:
-- update_updated_at_column() is first USED by 014_calendar_integration.sql
-- but was only DEFINED in 015_commission_bonus.sql and 016_roles_and_superadmin_seed.sql.
-- Running the migrations in order against a clean database therefore failed at 014.
-- Defining it here (before everything else) fixes the ordering. The later
-- CREATE OR REPLACE statements in 015/016 remain harmless no-ops.

BEGIN;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;

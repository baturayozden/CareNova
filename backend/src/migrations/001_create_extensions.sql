-- Migration: 001_create_extensions / Created: 2026-05-17
-- Enables required PostgreSQL extensions for the CareNova schema.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4() for primary keys
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- pgp_sym_encrypt / pgp_sym_decrypt for sensitive values
CREATE EXTENSION IF NOT EXISTS "citext";      -- case-insensitive text type for email columns

COMMIT;

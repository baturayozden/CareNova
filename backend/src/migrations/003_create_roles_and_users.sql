-- Migration: 003_create_roles_and_users / Created: 2026-05-17
-- Creates system-wide roles and the users table.
-- Roles are platform-global (not per-tenant). Users belong to exactly one tenant
-- except super_admin users who have tenant_id = NULL.

BEGIN;

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
  id          SMALLINT  PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB       NOT NULL DEFAULT '{}'
);

COMMENT ON TABLE roles IS
  'Platform-wide role definitions. Not scoped per tenant.';

COMMENT ON COLUMN roles.name IS
  'Role identifier: super_admin, clinic_owner, clinic_admin, receptionist, doctor.';
COMMENT ON COLUMN roles.permissions IS
  'JSON object describing coarse-grained permission grants, e.g. {"leads": "all"}.';

-- Seed the five built-in roles.
INSERT INTO roles (name, description, permissions) VALUES
  (
    'super_admin',
    'Full platform access. Anthropic / CareNova staff only.',
    '{"all": true}'
  ),
  (
    'clinic_owner',
    'Owns a tenant. Full access within their clinic including billing.',
    '{"tenant": "all", "leads": "all", "users": "all", "billing": "all"}'
  ),
  (
    'clinic_admin',
    'Manages day-to-day clinic operations. Cannot access billing.',
    '{"leads": "all", "users": "read_write", "reports": "read"}'
  ),
  (
    'receptionist',
    'Handles incoming patient leads and WhatsApp conversations.',
    '{"leads": "read_write", "messages": "read_write"}'
  ),
  (
    'doctor',
    'Read-only view of patient context and message history.',
    '{"leads": "read", "messages": "read"}'
  )
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  role_id       SMALLINT    NOT NULL REFERENCES roles(id),
  email         CITEXT      NOT NULL,
  password_hash TEXT        NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  avatar_url    TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,

  -- Email must be unique within a tenant; two different tenants may share the same email.
  CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);

-- Enforce via trigger: super_admin users must have tenant_id = NULL.
-- (CHECK constraints cannot use subqueries in PostgreSQL.)
CREATE OR REPLACE FUNCTION fn_check_super_admin_no_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT name FROM roles WHERE id = NEW.role_id) = 'super_admin'
     AND NEW.tenant_id IS NOT NULL THEN
    RAISE EXCEPTION 'super_admin users must have tenant_id = NULL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_super_admin_no_tenant
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_check_super_admin_no_tenant();

COMMENT ON TABLE users IS
  'Platform users. Belongs to one tenant except super_admin (tenant_id IS NULL).';

COMMENT ON COLUMN users.tenant_id IS
  'NULL only for super_admin users. All clinic users must have a tenant_id.';
COMMENT ON COLUMN users.role_id IS
  'References roles.id. Determines permission set for this user.';
COMMENT ON COLUMN users.email IS
  'CITEXT — stored and compared case-insensitively. Unique within a tenant.';
COMMENT ON COLUMN users.password_hash IS
  'bcrypt hash of the password. Never store plain-text passwords.';
COMMENT ON COLUMN users.is_active IS
  'FALSE means the account is disabled (cannot log in) but not deleted.';
COMMENT ON COLUMN users.deleted_at IS
  'Soft-delete timestamp. NULL means the user is not deleted.';

COMMIT;

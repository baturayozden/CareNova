-- Migration: 002_create_tenants / Created: 2026-05-17
-- Creates the tenants table — the top-level multi-tenancy boundary.
-- Every clinic that signs up is a tenant. All other tables reference tenant_id.

BEGIN;

CREATE TABLE IF NOT EXISTS tenants (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  status      VARCHAR(20)  NOT NULL DEFAULT 'active',
  plan_tier   VARCHAR(20)  NOT NULL DEFAULT 'free',
  country     VARCHAR(2),
  timezone    VARCHAR(50)  NOT NULL DEFAULT 'UTC',
  logo_url    TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,

  CONSTRAINT chk_tenants_status
    CHECK (status IN ('active', 'suspended', 'cancelled')),
  CONSTRAINT chk_tenants_plan_tier
    CHECK (plan_tier IN ('free', 'starter', 'growth', 'enterprise'))
);

COMMENT ON TABLE tenants IS
  'Top-level multi-tenancy boundary. One row per dental clinic (or clinic group).';

COMMENT ON COLUMN tenants.slug IS
  'URL-safe identifier used in subdomains and API paths, e.g. bright-smile-dental.';
COMMENT ON COLUMN tenants.status IS
  'Lifecycle state of the tenant: active, suspended (payment issue), cancelled.';
COMMENT ON COLUMN tenants.plan_tier IS
  'Billing plan tier. Mirrors the subscription plan for quick reads without a JOIN.';
COMMENT ON COLUMN tenants.country IS
  'ISO 3166-1 alpha-2 country code, e.g. TR, GB, DE. Used for regional compliance.';
COMMENT ON COLUMN tenants.timezone IS
  'IANA timezone name used to localise scheduled messages, e.g. Europe/Istanbul.';
COMMENT ON COLUMN tenants.deleted_at IS
  'Soft-delete timestamp. NULL means the tenant is not deleted.';

COMMIT;

-- Migration 039: user_tenants — many-to-many users ↔ tenants with per-tenant role.
-- A single user can belong to multiple tenants (e.g. a clinic group owner).
-- Phase 0: table creation + backfill from users.tenant_id. Behaviour unchanged.
--
-- Run manually in Supabase SQL editor. Safe to re-run (all statements idempotent).

-- ── 1. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_tenants (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID      NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  tenant_id   UUID      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id     SMALLINT  NOT NULL REFERENCES roles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tenants_user   ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON user_tenants(tenant_id);

-- ── 2. Backfill from users.tenant_id ─────────────────────────────────────────
-- Every existing user that has a tenant_id gets a row in user_tenants.
-- Platform admins (tenant_id IS NULL) are skipped — they are not tenant-scoped.

INSERT INTO user_tenants (user_id, tenant_id, role_id)
SELECT id, tenant_id, role_id
FROM   users
WHERE  tenant_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;

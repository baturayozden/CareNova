-- ============================================================
-- Migration 016: Add 'nurse' role + seed super admin in DB
-- ============================================================
-- Run manually in Supabase SQL Editor.
--
-- Live roles table as of 2026-05-23 (verified):
--   1=super_admin, 2=director, 3=clinic_admin, 4=receptionist,
--   5=dentist, 6=treatment_coordinator, 7=admin
-- This migration adds the missing id=8 (nurse) and seeds the
-- platform super admin into the Postgres users table.
-- ============================================================

BEGIN;

-- ── 0. Ensure trigger function ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 1. Add missing 'nurse' role (id=8) ───────────────────────────────────────
-- roles.id is GENERATED ALWAYS AS IDENTITY; explicit id requires OVERRIDING SYSTEM VALUE.
-- ON CONFLICT (id) DO NOTHING makes this idempotent.

INSERT INTO roles (id, name, description, permissions)
OVERRIDING SYSTEM VALUE
VALUES (
  8,
  'nurse',
  'Dental nurse. Read-only view of patient context and message history.',
  '{"leads":"read","messages":"read"}'
)
ON CONFLICT (id) DO NOTHING;

-- Advance identity sequence past id=8 so future auto-inserts start at 9+
SELECT setval(pg_get_serial_sequence('roles', 'id'), (SELECT MAX(id) FROM roles));

-- ── 2. Super admin seed ───────────────────────────────────────────────────────
-- role_id = 1 (super_admin — verified in live roles table).
-- Fixed UUID: 65a3f713-e30a-4416-9424-9770e7a9b5df
--   → use this in Tur 0b to replace the hardcoded 'super-admin-seed-id' string.
--   → if seed.js already ran, the existing UUID is preserved; read it from
--     the SELECT below.
--
-- password_hash: bcryptjs (rounds=12) of 'CareNova2026!' — generated with:
--   node -e "require('bcryptjs').hash('CareNova2026!',12).then(console.log)"
-- Plain-text password does NOT appear in this file.
--
-- WHY a DO block: PostgreSQL treats NULLs as distinct in UNIQUE constraints,
-- so (NULL, 'email') does NOT trigger ON CONFLICT — a DO block with an
-- explicit EXISTS check is the only safe approach.

DO $$
DECLARE
  v_uuid     UUID := '65a3f713-e30a-4416-9424-9770e7a9b5df';
  v_existing UUID;
BEGIN
  SELECT id INTO v_existing
  FROM   users
  WHERE  email     = 'baturay@carenova.ai'
    AND  tenant_id IS NULL
  LIMIT  1;

  IF v_existing IS NOT NULL THEN
    -- Already exists (e.g. seed.js ran) — update in place, preserve UUID
    UPDATE users SET
      role_id       = 1,
      password_hash = '$2b$12$JcS9XHu7YSLIYrhWRqfCpe0rvROgkdG1SxZUxgRM43ZhiEokNIWa.',
      first_name    = 'Baturay',
      last_name     = 'Ozden',
      is_active     = TRUE,
      updated_at    = NOW()
    WHERE id = v_existing;
    RAISE NOTICE 'Super admin already existed — updated in place. UUID: %', v_existing;
  ELSE
    -- First time — insert with fixed UUID
    INSERT INTO users (
      id, tenant_id, role_id, email, password_hash,
      first_name, last_name, is_active
    ) VALUES (
      v_uuid,
      NULL,
      1,
      'baturay@carenova.ai',
      '$2b$12$JcS9XHu7YSLIYrhWRqfCpe0rvROgkdG1SxZUxgRM43ZhiEokNIWa.',
      'Baturay',
      'Ozden',
      TRUE
    );
    RAISE NOTICE 'Super admin inserted. UUID: %', v_uuid;
  END IF;
END;
$$;

-- ── 3. Verify ─────────────────────────────────────────────────────────────────
-- Read the UUID from this output for Tur 0b.

SELECT
  u.id,
  u.email,
  r.name  AS role,
  u.is_active,
  u.tenant_id,
  u.created_at
FROM users u
JOIN roles r ON r.id = u.role_id
WHERE u.email     = 'baturay@carenova.ai'
  AND u.tenant_id IS NULL;

COMMIT;

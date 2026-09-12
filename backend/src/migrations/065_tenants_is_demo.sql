-- Migration: 065_tenants_is_demo
--
-- Marks a tenant as demo/sample data at the source.
--
-- Why this exists: the app and admin panels show fabricated patients and
-- clinics that are indistinguishable from real records. Today that data is
-- imported straight into React components, so the marking lives in the
-- frontend (lib/demoProvenance.ts). Once the same data is served by the API
-- from real rows, the frontend can no longer tell demo from real by where the
-- data came from -- the flag has to travel WITH the row.
--
-- This is a health product: a coordinator acting on a fabricated appointment,
-- or a doctor reading a fabricated pre-assessment, is not an acceptable
-- failure mode. Every screen that renders rows belonging to a tenant with
-- is_demo = true must show the DEMO VERI banner and the record-level badge.
--
-- Defaults to false, so every existing and future real tenant is unaffected.
BEGIN;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN tenants.is_demo IS
  'True for sample/demo tenants. Rows under such a tenant are fabricated and must be visibly marked in every UI that renders them.';

COMMIT;

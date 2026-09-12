-- Migration 068: demo_requests — the table routes/demo.js has always written to.
--
-- routes/demo.js INSERTs every marketing-site demo request into demo_requests
-- and the admin console reads it back, but no migration ever created the table
-- (a CareDental table that was not carried through the fork). Against the real
-- database both POST and GET /api/demo returned 500.
--
-- Columns keep the names the route already uses (clinic_name, notes,
-- updated_at) so the public form works unchanged. Status adopts the CareNova
-- sales funnel the admin screen shows — new → contacted → demo_done → won/lost —
-- instead of CareDental's pending/contacted/converted; routes/demo.js's PATCH
-- validation is updated in the same commit.
--
-- is_demo marks seeded example requests, so a real prospect is never mixed
-- into the same list indistinguishably (same reason as tenants.is_demo, 065).

BEGIN;

CREATE TABLE IF NOT EXISTS demo_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(160) NOT NULL,
  email        VARCHAR(254) NOT NULL,
  clinic_name  VARCHAR(200) NOT NULL,
  city         VARCHAR(120),
  phone        VARCHAR(40),
  branch_key   VARCHAR(40),
  status       VARCHAR(16) NOT NULL DEFAULT 'new'
    CONSTRAINT chk_demo_requests_status CHECK (status IN ('new','contacted','demo_done','won','lost')),
  notes        TEXT,
  is_demo      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_requests_created ON demo_requests (created_at DESC);

COMMIT;

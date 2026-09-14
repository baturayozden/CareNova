-- Migration: 071_demo_clock
--
-- Keeps the demo data from ageing out from under the panel.
--
-- THE PROBLEM. Migration 065 + the demo seeds write timestamps relative to
-- now() AT SEED TIME. Every "last 24 hours" figure on the admin overview is
-- therefore alive on the day of seeding and dead the day after: measured on
-- 14 Sept 2026 the demo tenants had 587 messages in the trailing 24 h, and
-- zero in the same window 24 h later. A panel that has to be demoable to a
-- clinic on any given day cannot be reseeded by hand before each demo.
--
-- THE FIX. One function that slides EVERY timestamp belonging to a demo
-- tenant forward by the same delta, so the newest demo message is always a
-- few minutes old and every relative distance inside the data set — how long
-- a case took, how stale a lead is, how far an insurance policy is from
-- expiring — is preserved exactly. Scheduled hourly with pg_cron, so nobody
-- has to remember it.
--
-- WHY IT IS CATALOG-DRIVEN. The column list is read from
-- information_schema at run time rather than spelled out here. A table added
-- by a later migration is covered the moment it exists; there is no list to
-- forget to update. What the function cannot infer, it refuses to guess: a
-- table with no way to tell a demo row from a real one is left untouched
-- (demo.clock_scope returns NULL), which is why this is safe to keep running
-- after the first real clinic onboards.
--
-- KNOWN, DELIBERATE SIDE EFFECT. leads/users/tenants/subscriptions and a few
-- others carry BEFORE UPDATE triggers that set updated_at = now(). Their
-- updated_at therefore lands on the roll time instead of shifted-old. That is
-- accurate — the row genuinely was just written — and not worth suppressing.

BEGIN;

CREATE SCHEMA IF NOT EXISTS demo;
COMMENT ON SCHEMA demo IS
  'Demo-data maintenance (migration 071). Deliberately NOT in the PostgREST exposed schema list: nothing here should be reachable from the anon or authenticated API.';

-- ── What the clock must not touch ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION demo.clock_skips_table(p_table text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_table IN (
    'schema_migrations',                  -- migration history, not demo data
    'audit_logs',                         -- append-only (070): UPDATE raises.
                                          -- Handled by appending instead, below.
    'blog_posts',                         -- editorial dates, not clinic activity
    'subscription_events',                -- webhook receipts: real arrival times
    'notification_preferences',
    'commission_tiers',
    'commission_performance_thresholds'
  );
$$;

CREATE OR REPLACE FUNCTION demo.clock_skips_column(p_table text, p_column text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT (p_table, p_column) IN (
    -- Security expiries. Sliding these forward would extend the life of a live
    -- password-reset token or OAuth credential, which is the one thing a
    -- cosmetic demo job must never do.
    ('users', 'reset_token_expires_at'),
    ('calendar_integrations', 'token_expiry'),
    -- A date of birth is not a relative date. A blind catalog sweep would move
    -- it forward every day and make the patient younger every day.
    ('treatment_cases', 'patient_dob')
  );
$$;

-- ── Which rows are demo rows ─────────────────────────────────────────────────
-- Returns a WHERE fragment, or NULL when demo rows cannot be distinguished
-- from real ones — in which case the table is skipped rather than guessed at.

CREATE OR REPLACE FUNCTION demo.clock_scope(p_table text) RETURNS text
LANGUAGE plpgsql STABLE AS $$
DECLARE v_has boolean;
BEGIN
  IF p_table = 'tenants' THEN
    RETURN 'is_demo';
  END IF;
  IF p_table = 'demo_requests' THEN
    -- Every row is a demo-request form submission; the table is demo by nature.
    RETURN 'true';
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = p_table
                    AND column_name = 'tenant_id') INTO v_has;
  IF v_has THEN
    RETURN 'tenant_id IN (SELECT id FROM public.tenants WHERE is_demo)';
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = p_table
                    AND column_name = 'case_id') INTO v_has;
  IF v_has THEN
    RETURN 'case_id IN (SELECT id FROM public.cases'
        || ' WHERE tenant_id IN (SELECT id FROM public.tenants WHERE is_demo))';
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = p_table
                    AND column_name = 'lead_id') INTO v_has;
  IF v_has THEN
    RETURN 'lead_id IN (SELECT id FROM public.leads'
        || ' WHERE tenant_id IN (SELECT id FROM public.tenants WHERE is_demo))';
  END IF;

  RETURN NULL;
END;
$$;

-- ── The audit trail cannot be shifted, so it is extended ─────────────────────
-- audit_logs is append-only (070). Appending is also the honest thing: a live
-- platform produces new audit rows, it does not rewrite old ones. One row per
-- demo tenant per roll, attributed to a real user of that tenant and pointing
-- at one of its own cases — never a made-up actor.

CREATE OR REPLACE FUNCTION demo.append_audit() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_n integer;
BEGIN
  -- Case-scoped actions only, so entity_type is always 'case' and entity_id
  -- always points at a case that exists. A log line whose entity cannot be
  -- opened is worse than no line.
  WITH acts(action) AS (
    VALUES ('case.status_changed'), ('case.eligibility_decided'),
           ('case.viewed'),         ('case.quote_sent'),
           ('case.assigned'),       ('case.medical_file_viewed')
  ),
  pick AS (
    SELECT t.id AS tenant_id,
           (SELECT u.id FROM users u
             WHERE u.tenant_id = t.id AND u.deleted_at IS NULL
             ORDER BY random() LIMIT 1) AS user_id,
           (SELECT c.id FROM cases c
             WHERE c.tenant_id = t.id AND c.deleted_at IS NULL
             ORDER BY random() LIMIT 1) AS case_id,
           (SELECT a.action FROM acts a ORDER BY random() LIMIT 1) AS action
    FROM tenants t
    WHERE t.is_demo AND t.deleted_at IS NULL AND t.status <> 'pending'
  )
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, created_at)
  SELECT p.tenant_id, p.user_id, p.action, 'case', p.case_id,
         now() - (random() * interval '20 hours')
  FROM pick p
  WHERE p.user_id IS NOT NULL AND p.case_id IS NOT NULL;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- ── The clock ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION demo.roll_clock(
  p_lag        interval DEFAULT interval '5 minutes',
  p_min_shift  interval DEFAULT interval '1 hour'
) RETURNS interval
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_newest timestamptz;
  v_delta  interval;
  r        record;
  v_scope  text;
BEGIN
  -- The hand of the clock is the newest ACTIVITY row across every table the
  -- clock shifts, not just messages. With messages alone, any row seeded
  -- slightly newer than the newest message drifts one roll further into the
  -- future each time — which is exactly what happened on the first run
  -- (58 future-dated case_events).
  SELECT max(x) INTO v_newest FROM (
    SELECT max(m.created_at) AS x FROM messages m
      WHERE m.tenant_id IN (SELECT id FROM tenants WHERE is_demo)
    UNION ALL
    SELECT max(e.created_at) FROM compliance_events e
      WHERE e.tenant_id IN (SELECT id FROM tenants WHERE is_demo)
    UNION ALL
    SELECT max(ev.created_at) FROM case_events ev
      JOIN cases c ON c.id = ev.case_id
      WHERE c.tenant_id IN (SELECT id FROM tenants WHERE is_demo)
  ) hands;

  IF v_newest IS NULL THEN
    RETURN NULL;  -- nothing seeded yet; nothing to keep fresh
  END IF;

  v_delta := date_trunc('second', (now() - p_lag) - v_newest);

  -- Never move backwards, and don't churn 20 000 rows for a few minutes' drift.
  IF v_delta < p_min_shift THEN
    RETURN interval '0';
  END IF;

  FOR r IN
    SELECT c.table_name AS tbl,
           string_agg(
             CASE WHEN c.data_type = 'date'
                  THEN format('%I = (%I + $1)::date', c.column_name, c.column_name)
                  ELSE format('%I = %I + $1', c.column_name, c.column_name)
             END, ', ' ORDER BY c.column_name) AS sets
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = 'public' AND t.table_name = c.table_name
     AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.data_type IN ('timestamp with time zone', 'date')
      AND NOT demo.clock_skips_table(c.table_name)
      AND NOT demo.clock_skips_column(c.table_name, c.column_name)
    GROUP BY c.table_name
  LOOP
    v_scope := demo.clock_scope(r.tbl);
    CONTINUE WHEN v_scope IS NULL;
    EXECUTE format('UPDATE public.%I SET %s WHERE %s', r.tbl, r.sets, v_scope)
      USING v_delta;
  END LOOP;

  PERFORM demo.append_audit();

  RETURN v_delta;
END;
$$;

COMMENT ON FUNCTION demo.roll_clock(interval, interval) IS
  'Slides every timestamp belonging to a demo tenant forward so the newest demo message stays minutes old, preserving all relative distances. Catalog-driven: new tables are covered automatically, and tables whose demo rows cannot be identified are skipped, not guessed. Scheduled hourly as carenova-demo-clock.';

REVOKE ALL ON SCHEMA demo FROM PUBLIC;

COMMIT;

-- ── Schedule ─────────────────────────────────────────────────────────────────
-- Outside the transaction: cron.schedule cannot be rolled back cleanly, and
-- re-running it with the same job name replaces the schedule rather than
-- stacking a second job.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('carenova-demo-clock', '17 * * * *', $cron$SELECT demo.roll_clock()$cron$);

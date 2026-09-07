-- Migration 063: security hardening (Aşama 1 kapanış — RLS + function
-- search_path).
--
-- WHY THIS FILE EXISTS
-- ---------------------------------------------------------------------------
-- Supabase publishes every table in the `public` schema over PostgREST
-- automatically. With Row Level Security (RLS) off, anyone holding the
-- project's `anon` key can call `https://<ref>.supabase.co/rest/v1/<table>`
-- directly and read/write every row — no backend involved. This project
-- stores patient health data (KVKK "özel nitelikli kişisel veri"), so that
-- surface has to be closed. This was already done by hand against the live
-- database (48/48 tables, RLS ON), but hand-applied changes don't exist for
-- a database built from scratch (staging, a new developer, CI) — this file
-- is what makes that fix reproducible.
--
-- WHY RLS IS ENABLED HERE WITH **NO POLICIES**
-- ---------------------------------------------------------------------------
-- Enabling RLS with zero policies means: by default, NO row is visible or
-- writable to anyone except a role that bypasses RLS. That's the point.
-- CareNova's frontend never holds a Supabase key at all (`frontend/.env`
-- only ships `REACT_APP_API_URL`/`REACT_APP_DEMO_MODE`/`REACT_APP_APP_URL`/
-- `REACT_APP_ADMIN_URL`/`REACT_APP_MARKETING_URL`); every request goes
-- through the Express backend's own `pg` Pool, connected as the `postgres`
-- role, and `lib/supabaseStorage.js` uses the `service_role` key. Both
-- `postgres` and `service_role` have BYPASSRLS — confirmed live (see
-- GUVENLIK-SERTLESTIRME-KOMUTU.md's Görev 5 report), not just assumed here.
-- So: RLS-with-no-policies closes the anon/PostgREST hole completely and
-- changes nothing about how the app itself behaves.
--
-- 🔴 DO NOT ADD `CREATE POLICY` STATEMENTS TO THIS FILE (OR ANY FUTURE ONE)
-- WITHOUT A DELIBERATE TENANT-ISOLATION DESIGN FIRST. A policy written
-- without that design is worse than no policy: it creates the appearance
-- of row-level tenant isolation while the backend still does its own
-- authorization in application code, and the two can silently disagree.
-- If/when the frontend is ever given a direct Supabase connection (anon or
-- authenticated key), THAT is the point to design and add real policies —
-- not before.
--
-- WHAT THIS FILE DOES
-- 1. Enables RLS on every table that exists in `public` right now (a
--    one-time sweep — new tables created by migrations after this one need
--    their own coverage, which is what #2 is for).
-- 2. Installs an event trigger (`trg_auto_enable_rls`) that automatically
--    enables RLS on any new table created in `public` from now on. This
--    turns "RLS enabled" from a manual-discipline requirement into a
--    structural guarantee — no future migration can silently ship an
--    unprotected table. Kept in this same file rather than a separate
--    064: it's the forward-looking half of the exact same concern as #1,
--    and splitting a single cohesive fix into two migrations would be
--    artificial.
-- 3. Pins `search_path = pg_catalog, public` on the 4 SECURITY-relevant
--    functions the Supabase advisor flagged (`function_search_path_mutable`)
--    so none of them can be tricked by a caller-controlled search_path into
--    resolving an object from an attacker-writable schema. Wrapped so a
--    function that doesn't exist in a given database is skipped, not an
--    error — none of the 4 are new here, but this makes the file safe to
--    run against a database at any point in its migration history.
--
-- WHAT THIS FILE DELIBERATELY DOES NOT TOUCH: `citext`
-- ---------------------------------------------------------------------------
-- The Supabase advisor also flags `extension_in_public` for `citext`
-- (installed in `public`, used by `users.email` and `leads.email` — i.e.
-- the login path). Moving it to a dedicated schema is the "correct" fix in
-- general, but NOT done here:
--   - This is a WARN, not an ERROR. The real risk it describes is a
--     low-privilege role with CREATE on `public` shadowing a function —
--     CareNova has no such role (only `postgres`/`service_role`, both
--     already trusted/superuser-equivalent).
--   - `ALTER EXTENSION citext SET SCHEMA extensions` would move citext's
--     `=` operator and `lower()`-equivalent functions out of `public`. The
--     backend connects as `postgres` with the default `search_path =
--     "$user", public` — it does NOT include `extensions` — so every
--     citext comparison on `users.email`/`leads.email` (i.e. login) would
--     break immediately with `operator does not exist: citext = unknown`.
--   - If this is ever revisited: (1) first
--     `ALTER ROLE postgres SET search_path = "$user", public, extensions;`,
--     (2) then move the extension, (3) then a login smoke test before
--     considering it done. Doing the extension move before the role's
--     search_path is updated is the failure mode described above.
-- No code or schema change accompanies this decision — this comment block
-- IS the fix for Görev 3 (a documented, deliberate no-op).
--
-- Idempotent: `ENABLE ROW LEVEL SECURITY` and `ALTER FUNCTION ... SET
-- search_path` are both safe to re-run; the event trigger is dropped and
-- recreated so re-running this file never fails on "already exists".

BEGIN;

-- ── 1. Enable RLS on every table that exists in `public` right now ─────────

DO $do$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', tbl.schemaname, tbl.tablename);
  END LOOP;
END;
$do$;

-- ── 2. Auto-enable RLS on every future `public` table ───────────────────────
--
-- SECURITY DEFINER + a pinned search_path so the function itself can't be
-- hijacked the same way the functions in step 3 could have been. Skips
-- partition children (relispartition) since `CREATE TABLE child PARTITION
-- OF parent` also fires a 'CREATE TABLE' ddl_command_end event — enabling
-- RLS on the partitioned parent (relkind 'p') already covers its children;
-- enabling it again per-child is redundant, not wrong, but the brief asked
-- for partitions to be skipped, so they are. Temp tables (relpersistence
-- 't') are skipped because they're session-local scratch space, never
-- reachable via PostgREST.

CREATE OR REPLACE FUNCTION public.trg_auto_enable_rls_fn()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $fn$
DECLARE
  obj record;
  is_real_table boolean;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF obj.command_tag = 'CREATE TABLE' AND obj.schema_name = 'public' THEN
      SELECT (c.relkind IN ('r', 'p') AND c.relpersistence <> 't' AND NOT c.relispartition)
        INTO is_real_table
      FROM pg_class c
      WHERE c.oid = obj.objid;

      IF is_real_table THEN
        EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
      END IF;
    END IF;
  END LOOP;
END;
$fn$;

DROP EVENT TRIGGER IF EXISTS trg_auto_enable_rls;

CREATE EVENT TRIGGER trg_auto_enable_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.trg_auto_enable_rls_fn();

-- ── 3. Pin search_path on the 4 advisor-flagged functions ──────────────────

DO $do$
BEGIN
  IF to_regprocedure('public.fn_check_super_admin_no_tenant()') IS NOT NULL THEN
    ALTER FUNCTION public.fn_check_super_admin_no_tenant() SET search_path = pg_catalog, public;
  END IF;

  IF to_regprocedure('public.trigger_set_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.trigger_set_updated_at() SET search_path = pg_catalog, public;
  END IF;

  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    ALTER FUNCTION public.update_updated_at_column() SET search_path = pg_catalog, public;
  END IF;

  IF to_regprocedure('public.set_blog_posts_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.set_blog_posts_updated_at() SET search_path = pg_catalog, public;
  END IF;
END;
$do$;

COMMIT;

-- ── Rollback (NOT RECOMMENDED — reopens the anon/PostgREST hole this file
-- closes; only for local debugging of the event trigger itself) ───────────
-- BEGIN;
-- DROP EVENT TRIGGER IF EXISTS trg_auto_enable_rls;
-- DROP FUNCTION IF EXISTS public.trg_auto_enable_rls_fn();
-- -- Disabling RLS per table and reverting search_path is deliberately left
-- -- out — there is no legitimate reason to run this rollback in any
-- -- environment holding real patient data.
-- COMMIT;

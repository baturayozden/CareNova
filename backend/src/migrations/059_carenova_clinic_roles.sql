-- Migration 059: CareNova clinic roles (CARENOVA-STRATEJI.md Bölüm 7/M8,
-- GECE-3-BRIEFI.md Bölüm E).
--
-- Replaces CareDental's inherited role names (director, clinic_admin,
-- receptionist, dentist, treatment_coordinator — seeded across migrations
-- 003/016 and the one-off db/migrate-roles.js script) with CareNova's own
-- 7 clinic roles. Platform roles (super_admin, admin) are untouched — M8
-- only redefines CLINIC-level roles.
--
-- NOT executed tonight (no reachable database — see BLOKAJLAR.md B2).
-- Written and reviewed for syntax only.
--
-- Discovered while writing this: `backend/src/routes/clinics.js`'s
-- ROLE_IDS map has hardcoded `sales: 9`, but NO migration or seed script
-- anywhere in this repo ever inserts a role row named 'sales' — id 9 is
-- either unassigned or belongs to something else entirely. This has been
-- a live, unrelated bug (any attempt to create a 'sales' clinic user would
-- hit a role_id foreign-key violation) that this migration makes moot: the
-- mapping below includes 'sales' → 'hasta_danismani' for completeness, but
-- since no 'sales' role row exists to match against, that specific mapping
-- is a harmless no-op in practice. See GECE-LOG.md Bölüm E for the full
-- investigation.
BEGIN;

INSERT INTO roles (name, description, permissions) VALUES
  ('klinik_sahibi', 'Clinic owner. Full access including billing.',
    '{"cases":"all","users":"all","billing":"all","reports":"all"}'),
  ('operasyon_muduru', 'Operations manager. Cases, team, reports.',
    '{"cases":"all","users":"read_write","reports":"all"}'),
  ('hasta_danismani', 'Patient consultant. Own cases only, chats, quote drafts.',
    '{"cases":"own","messages":"read_write","quotes":"draft"}'),
  ('doktor', 'Doctor. Approval queue, medical file, complication escalation.',
    '{"cases":"medical_review","medical_file":"all"}'),
  ('koordinator', 'Coordinator. Travel, hotel, transfer, interpreter scheduling.',
    '{"travel":"all","cases":"read"}'),
  ('tercuman', 'Interpreter. Chats of assigned cases only — medical file restricted.',
    '{"cases":"assigned_chat_only","medical_file":"none"}'),
  ('muhasebe', 'Accounting. Payments, invoices, commission.',
    '{"billing":"all","cases":"read"}')
ON CONFLICT (name) DO NOTHING;

-- Move existing users from their legacy role to the CareNova equivalent
-- (GECE-3-BRIEFI.md Bölüm E.1's own mapping table). A legacy role with no
-- matching row in `roles` (i.e. 'sales' — see header) is simply skipped,
-- not an error.
DO $$
DECLARE
  v_map JSONB := '{
    "director": "operasyon_muduru",
    "clinic_admin": "klinik_sahibi",
    "clinic_owner": "klinik_sahibi",
    "treatment_coordinator": "hasta_danismani",
    "dentist": "doktor",
    "receptionist": "koordinator",
    "sales": "hasta_danismani"
  }'::jsonb;
  v_old TEXT;
  v_new TEXT;
  v_old_id SMALLINT;
  v_new_id SMALLINT;
  v_moved INT;
BEGIN
  FOR v_old, v_new IN SELECT key, value FROM jsonb_each_text(v_map)
  LOOP
    SELECT id INTO v_old_id FROM roles WHERE name = v_old;
    SELECT id INTO v_new_id FROM roles WHERE name = v_new;
    IF v_old_id IS NOT NULL AND v_new_id IS NOT NULL THEN
      UPDATE users SET role_id = v_new_id, updated_at = now() WHERE role_id = v_old_id;
      GET DIAGNOSTICS v_moved = ROW_COUNT;
      RAISE NOTICE 'Moved % user(s) from % (id=%) to % (id=%)', v_moved, v_old, v_old_id, v_new, v_new_id;
    ELSE
      RAISE NOTICE 'Skipped mapping % -> % (source role not found in roles table)', v_old, v_new;
    END IF;
  END LOOP;
END $$;

-- 'nurse' (id=8, added in migration 016) has no CareNova equivalent in
-- M8's 7-role table — deliberately left unmapped rather than guessed at.
-- If real nurse users exist when this runs, decide their target role by
-- hand before/after this migration; do not silently fold them into
-- koordinator or hasta_danismani without confirming with Baturay.

COMMIT;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- Reversing the user role_id reassignment above requires knowing each
-- user's PRE-migration role, which this migration does not snapshot
-- anywhere — if you need to undo this, restore users.role_id from a
-- pre-migration backup rather than trying to reverse-map by name.
-- BEGIN;
-- DELETE FROM roles WHERE name IN (
--   'klinik_sahibi','operasyon_muduru','hasta_danismani','doktor',
--   'koordinator','tercuman','muhasebe'
-- );
-- COMMIT;

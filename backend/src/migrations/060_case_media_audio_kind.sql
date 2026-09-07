-- Migration 060: allow case_media.kind = 'audio' (GECE-4-BRIEFI.md Bölüm C.1).
--
-- migration 057 only allowed ('photo','scan','report','document') — voice
-- notes have nowhere to go once transcribed and matched to a case. Widens
-- the CHECK constraint; no data migration needed since no rows exist yet.
--
-- NOT executed tonight (no reachable database — see BLOKAJLAR.md B2).
BEGIN;

ALTER TABLE case_media DROP CONSTRAINT IF EXISTS case_media_kind_check;
ALTER TABLE case_media ADD CONSTRAINT case_media_kind_check
  CHECK (kind IN ('photo','scan','report','document','audio'));

COMMENT ON COLUMN case_media.kind IS
  'photo/scan/report/document: image or PDF uploads. audio: transcribed WhatsApp voice notes — ai_extraction holds {transcript, detected_language, confidence} instead of a vision read.';

COMMIT;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- BEGIN;
-- ALTER TABLE case_media DROP CONSTRAINT IF EXISTS case_media_kind_check;
-- ALTER TABLE case_media ADD CONSTRAINT case_media_kind_check
--   CHECK (kind IN ('photo','scan','report','document'));
-- COMMIT;

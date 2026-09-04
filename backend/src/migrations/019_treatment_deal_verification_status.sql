-- ============================================================
-- Migration 019: Add verification_status to treatment_deals
-- ============================================================
-- Tracks payment verification state for each deal.
-- Used by the payment import / fuzzy matching pipeline:
--
--   'unverified'       — default; no payment matched yet
--   'auto_matched'     — paymentMatcher confidence >= 85; written automatically
--   'manually_approved'— director confirmed the match
--   'rejected'         — director rejected the match suggestion
--
-- The commission calculate endpoint (POST /periods/:id/calculate)
-- uses requireVerification (default true) to include only
-- 'auto_matched' | 'manually_approved' deals when computing commissions.
--
-- Run manually in Supabase SQL Editor.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name  = 'treatment_deals'
       AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE treatment_deals
      ADD COLUMN verification_status TEXT
        NOT NULL DEFAULT 'unverified'
        CHECK (verification_status IN (
          'unverified', 'auto_matched', 'manually_approved', 'rejected'
        ));

    COMMENT ON COLUMN treatment_deals.verification_status IS
      'Payment verification state set by the CSV import / fuzzy matching pipeline. '
      'Calculate only includes auto_matched and manually_approved deals by default.';
  END IF;
END;
$$;

COMMIT;

-- ============================================================
-- Migration 017: Add tier_application to commission_schemes
-- ============================================================
-- Adds a tier_application column to commission_schemes.
--
-- tier_application controls HOW rate tiers are applied to revenue:
--   'flat'     — the rate of the single matching band is applied to
--                the ENTIRE personal revenue (whole-revenue single rate).
--   'marginal' — each band's slice of revenue is taxed at that band's
--                rate (progressive / tax-bracket style).
--
-- This is a separate concern from the scheme type:
--   e.g. a 'tiered' type scheme can be 'flat' application (Dentafly style).
--
-- Default: 'flat' — preserves existing scheme behaviour.
-- Run manually in Supabase SQL Editor.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name  = 'commission_schemes'
       AND column_name = 'tier_application'
  ) THEN
    ALTER TABLE commission_schemes
      ADD COLUMN tier_application TEXT
        NOT NULL DEFAULT 'flat'
        CHECK (tier_application IN ('flat', 'marginal'));
  END IF;
END;
$$;

COMMIT;

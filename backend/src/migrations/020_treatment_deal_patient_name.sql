-- ============================================================
-- Migration 020: Add patient_name to treatment_deals
-- ============================================================
-- Hasta adını deal'in kendi verisi olarak saklar.
-- Birincil kaynak: deal.patient_name (elle girilen veya lead'den kopyalanan).
-- paymentMatcher bu alanı doğrudan kullanır; lead_id opsiyonel olan
-- deal'lerde (kapıdan gelen hasta, CRM'siz giriş) matcher çalışmaya
-- devam eder.
-- Nullable — mevcut deal'lerde boş kalabilir; matcher leads JOIN'ini
-- fallback olarak kullanır.
--
-- Run manually in Supabase SQL Editor.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name  = 'treatment_deals'
       AND column_name = 'patient_name'
  ) THEN
    ALTER TABLE treatment_deals
      ADD COLUMN patient_name TEXT;

    COMMENT ON COLUMN treatment_deals.patient_name IS
      'Patient full name stored directly on the deal. Primary source for '
      'paymentMatcher fuzzy matching. Falls back to leads.first_name + last_name '
      'if null (for deals linked to a lead record).';
  END IF;
END;
$$;

COMMIT;

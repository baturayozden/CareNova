-- Migration 043 — Add patient_email and patient_phone to treatment_deals
ALTER TABLE treatment_deals
  ADD COLUMN IF NOT EXISTS patient_email TEXT,
  ADD COLUMN IF NOT EXISTS patient_phone TEXT;

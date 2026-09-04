-- Migration 042 — Add patient_phone to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS patient_phone TEXT;

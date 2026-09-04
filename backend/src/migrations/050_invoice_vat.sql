-- 050: VAT support on invoices (inclusive 20% for UK VAT-registered entities, e.g. Dentafly UK)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS vat_applied BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vat_rate    NUMERIC DEFAULT 20,
  ADD COLUMN IF NOT EXISTS vat_amount  NUMERIC,
  ADD COLUMN IF NOT EXISTS net_amount  NUMERIC;

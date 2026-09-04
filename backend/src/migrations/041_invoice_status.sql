-- Add invoice lifecycle status column (draft | finalized)
-- Existing rows default to 'finalized' (they already have invoice numbers)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'finalized';

-- Draft invoices have no invoice_number yet — make it nullable
ALTER TABLE invoices ALTER COLUMN invoice_number DROP NOT NULL;

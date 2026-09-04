-- Add per-tenant finance payment method control.
-- Defaults to TRUE so all existing tenants retain finance access.
-- Set to FALSE for tenants that are not permitted to offer finance (e.g. Dentafly).

ALTER TABLE tenant_billing_profiles
  ADD COLUMN IF NOT EXISTS finance_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Dentafly: finance not permitted
UPDATE tenant_billing_profiles
   SET finance_enabled = FALSE
 WHERE tenant_id = '772222bf-16bd-4046-b527-c819e4efbfc1';

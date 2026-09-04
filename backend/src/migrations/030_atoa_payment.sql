-- Migration 030: Atoa payment provider support
-- Adds Atoa (UK Open Banking + card, pay-by-bank) columns to tenant_billing_profiles.
-- Pattern mirrors Stripe: API secret ENCRYPTED (AES-256-GCM via TOKEN_ENCRYPTION_KEY),
-- webhook secret stored PLAIN (same as stripe_webhook_secret / square_webhook_signature_key).
-- Idempotent: safe to re-run.
--
-- payment_provider values: 'square' (default) | 'stripe' | 'atoa'
-- No CHECK constraint on payment_provider (consistent with existing free-text usage).

-- Atoa Bearer API token (used for POST /api/payments/process-payment) — ENCRYPTED
ALTER TABLE tenant_billing_profiles
  ADD COLUMN IF NOT EXISTS atoa_api_token_encrypted TEXT;

-- Atoa webhook V2 signing secret (HMAC-SHA256 of raw body, X-Atoa-Signature) — PLAIN
ALTER TABLE tenant_billing_profiles
  ADD COLUMN IF NOT EXISTS atoa_webhook_secret TEXT;

-- Atoa environment: 'sandbox' | 'production' (mirrors square_environment)
ALTER TABLE tenant_billing_profiles
  ADD COLUMN IF NOT EXISTS atoa_environment TEXT;

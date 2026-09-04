-- Migration 031: Embeddable widget support — public site_key + origin allowlist.
-- site_key is PUBLIC (visible in browser, like Stripe pk_*) — stored PLAIN, NOT hashed.
-- Security comes from origin allowlist, not key secrecy.
-- Idempotent: safe to re-run.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS widget_site_key      TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS widget_allowed_origins TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tenants_widget_site_key
  ON tenants (widget_site_key)
  WHERE widget_site_key IS NOT NULL;

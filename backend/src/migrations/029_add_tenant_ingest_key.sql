-- Site form ingest: per-tenant public key for unauthenticated lead submission.
-- Only the SHA-256 hash is stored; the raw key is shown once at generation time.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ingest_key_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_ingest_key_hash
  ON tenants (ingest_key_hash)
  WHERE ingest_key_hash IS NOT NULL;

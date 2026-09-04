-- Migration: 025_add_password_reset_tokens / Created: 2026-06-22
-- Self-service şifre sıfırlama: hash'li token + süre. Tek kullanımlık.
-- Token düz metin olarak ASLA saklanmaz; yalnızca SHA-256 hash'i tutulur.

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

-- token aramasını hızlandır (yalnızca aktif token'lar index'e girer)
CREATE INDEX IF NOT EXISTS idx_users_reset_token_hash
  ON users (reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;

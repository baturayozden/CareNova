-- Migration 013: rename whatsapp_configs.access_token_encrypted → access_token
BEGIN;
ALTER TABLE whatsapp_configs
  RENAME COLUMN access_token_encrypted TO access_token;
COMMIT;

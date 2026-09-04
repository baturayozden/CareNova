-- Migration: 024_add_hot_alert_flag
-- Hot-lead email bildirimi: lead başına tek sefer damgalanır.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hot_alert_sent_at TIMESTAMPTZ;

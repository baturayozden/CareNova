-- Migration 064: add the missing leads.action_required flag.
--
-- routes/activity.js has always both READ and WRITTEN this column — it is set
-- TRUE when a human takes over a conversation from the AI (POST
-- /api/activity/:leadId/take-over) and FALSE again on resolve — but no
-- migration ever created it. Against the real database every
-- GET /api/activity call therefore failed with
--   column l.action_required does not exist
-- and the whole "Aksiyon Gerekiyor" tab was a 500. Demo mode never revealed
-- this because demoAdapter.ts answers that endpoint from a hardcoded array
-- and never reaches SQL.
--
-- The semantics are not invented here: they are exactly what activity.js
-- already writes. Default FALSE matches the take-over/resolve pair, where a
-- lead only becomes "action required" through an explicit human take-over.
BEGIN;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS action_required BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN leads.action_required IS
  'TRUE when a human has taken this conversation over from the AI and it still needs a call back. Set by POST /api/activity/:leadId/take-over, cleared by the resolve endpoint.';

-- The "Action Required" tab and the summary badge both filter on this flag,
-- always alongside deleted_at IS NULL and a tenant scope.
CREATE INDEX IF NOT EXISTS idx_leads_action_required
  ON leads (tenant_id, action_required)
  WHERE deleted_at IS NULL AND action_required;

COMMIT;

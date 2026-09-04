-- Add signwell_document_id to link_requests so each signature request row
-- carries the UUID of the SignWell document it was created from.
-- This allows signed-doc to find the completed document even if
-- treatment_cases.signwell_document_id was later overwritten by a re-send.

ALTER TABLE link_requests
  ADD COLUMN IF NOT EXISTS signwell_document_id TEXT;

-- Migration 037: two-stage approval columns
-- clinic_status tracks the clinic's decision (independent of patient confirmation_status)
-- clinic_status: 'requested' | 'approved' | 'rejected'
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS clinic_status TEXT NOT NULL DEFAULT 'requested',
  ADD COLUMN IF NOT EXISTS clinic_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_notification_sent_at TIMESTAMPTZ;

-- Fast look-up for the approval queue
CREATE INDEX IF NOT EXISTS idx_appts_clinic_status
  ON appointments (tenant_id, clinic_status);

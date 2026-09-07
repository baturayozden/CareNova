-- Migration 061: compliance_events (GECE-4-BRIEFI.md Bölüm E,
-- CARENOVA-STRATEJI.md M7.1). Append-only log of every outbound AI message
-- blocked by services/complianceGuard.js — Tanıtım Yönetmeliği / KVKK
-- violations caught before they ever reached a patient.
--
-- Not scoped to a case (case_id nullable) because the guard runs on every
-- outbound AI message, and not every conversation has become a case yet —
-- same reasoning as leads vs cases in migration 057.
--
-- NOT executed tonight (no reachable database — see BLOKAJLAR.md B2).
BEGIN;

CREATE TABLE IF NOT EXISTS compliance_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id      UUID REFERENCES leads(id) ON DELETE SET NULL,
  case_id      UUID REFERENCES cases(id) ON DELETE SET NULL,
  rule         VARCHAR(60) NOT NULL,   -- e.g. 'price_announcement_tr', 'testimonial_share',
                                        -- 'outcome_guarantee', 'before_after_no_consent',
                                        -- 'medical_advice'
  blocked_text TEXT NOT NULL,          -- the message that was NOT sent
  language     VARCHAR(5),
  actor        VARCHAR(20) NOT NULL DEFAULT 'ai',  -- 'ai' | a user id string for staff-authored content
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_events_tenant_created ON compliance_events(tenant_id, created_at DESC);

COMMENT ON TABLE compliance_events IS
  'Append-only. Every message services/complianceGuard.js blocked before it reached a patient — who/when/what/which rule. Never deleted or edited (KVKK/Tanıtım Yönetmeliği audit trail).';

COMMIT;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TABLE IF EXISTS compliance_events;
-- COMMIT;

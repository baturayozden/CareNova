-- Migration: 009_create_indexes / Created: 2026-05-17
-- Performance indexes and the updated_at trigger function.
-- Must run after all previous migrations (001-008).

BEGIN;

-- ---------------------------------------------------------------------------
-- updated_at auto-stamp trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table that has an updated_at column.
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON whatsapp_configs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------

-- Fast lookup by slug (URL routing, subdomain resolution).
CREATE INDEX idx_tenants_slug
  ON tenants(slug)
  WHERE deleted_at IS NULL;

-- Filter active / suspended tenants for ops dashboards.
CREATE INDEX idx_tenants_status
  ON tenants(status)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

-- All users belonging to a tenant (used on every authenticated request).
CREATE INDEX idx_users_tenant
  ON users(tenant_id)
  WHERE deleted_at IS NULL;

-- Login lookup by email (tenant_id + email covered by the UNIQUE constraint,
-- this covers single-email lookups for super_admin flows).
CREATE INDEX idx_users_email
  ON users(email)
  WHERE deleted_at IS NULL;

-- Filter users by role (e.g. list all doctors in a tenant).
CREATE INDEX idx_users_role
  ON users(role_id);

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------

-- All leads for a tenant (default listing query).
CREATE INDEX idx_leads_tenant
  ON leads(tenant_id)
  WHERE deleted_at IS NULL;

-- Leads by status within a tenant (Kanban board, pipeline views).
CREATE INDEX idx_leads_status
  ON leads(tenant_id, status)
  WHERE deleted_at IS NULL;

-- Phone lookup within a tenant (duplicate detection, inbound message matching).
CREATE INDEX idx_leads_phone
  ON leads(tenant_id, phone);

-- Leads assigned to a specific user (My Leads view).
CREATE INDEX idx_leads_assigned
  ON leads(assigned_to)
  WHERE deleted_at IS NULL;

-- AI follow-up scheduler: finds leads that are overdue for an AI message.
-- Composite index covers the three columns used in the WHERE / ORDER BY clause
-- of the scheduler query. The partial predicate excludes opted-out and
-- terminal-status leads so the index stays small and hot.
CREATE INDEX idx_leads_ai_followup
  ON leads(tenant_id, ai_follow_up_enabled, last_ai_message_at)
  WHERE deleted_at IS NULL
    AND opted_out_at IS NULL
    AND status NOT IN ('booked', 'attended', 'lost', 'archived');

-- GDPR retention sweep: finds leads whose retention window has expired.
CREATE INDEX idx_leads_gdpr_retention
  ON leads(data_retention_until)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

-- Conversation thread for a lead, newest first.
CREATE INDEX idx_messages_lead
  ON messages(lead_id, created_at DESC);

-- Tenant-wide message feed (reporting, dashboards).
CREATE INDEX idx_messages_tenant
  ON messages(tenant_id, created_at DESC);

-- Status webhook correlation: Meta sends whatsapp_message_id back in callbacks.
CREATE INDEX idx_messages_whatsapp_id
  ON messages(whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

-- Pending / in-flight messages for retry and monitoring jobs.
CREATE INDEX idx_messages_status
  ON messages(status)
  WHERE status IN ('pending', 'sent');

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------

-- Tenant-scoped audit trail, newest first (compliance export).
CREATE INDEX idx_audit_tenant
  ON audit_logs(tenant_id, created_at DESC);

-- Look up all audit events for a specific entity (e.g. full history of a lead).
CREATE INDEX idx_audit_entity
  ON audit_logs(entity_type, entity_id);

-- Audit events performed by a specific user.
CREATE INDEX idx_audit_user
  ON audit_logs(user_id, created_at DESC);

COMMIT;

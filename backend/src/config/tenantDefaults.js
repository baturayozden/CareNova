'use strict';

// Maps tenant_id → user_id of the default assignee for WhatsApp inbound leads.
// Used by upsertLead when no explicit assignee is provided.
// Extend this map when onboarding new tenants; a future migration can move
// this into a tenants.default_lead_assignee_id column when the need arises.
const DEFAULT_LEAD_ASSIGNEES = {
  '682ba358-434a-4126-a558-90d2ead67979': '91fbbff0-9e28-4898-a696-81a5ec255345', // Vestadent → info@vestadentclinic.co.uk
};

function getDefaultAssignee(tenantId) {
  return DEFAULT_LEAD_ASSIGNEES[tenantId] || null;
}

module.exports = { getDefaultAssignee };

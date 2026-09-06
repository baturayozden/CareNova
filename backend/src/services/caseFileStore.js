'use strict';

// Health-tourism Case File model (CARENOVA-STRATEJI.md Bölüm 7/M1, schema in
// migrations/057-058). NOT the same thing as services/caseStore.js, which is
// CareDental's inherited "treatment_cases" table (consent forms + payment
// collection, routes/cases.js at /api/cases) — a completely different
// concept that happens to share the word "case". Named caseFileStore.js
// (routes: caseFiles.js at /api/case-files) specifically to avoid colliding
// with that existing, working feature. GECE-LOG.md Bölüm E has the full
// naming-collision writeup.
//
// GECE-2-BRIEFI.md Bölüm E: no reachable Postgres tonight (BLOKAJLAR.md B2)
// — every query below is written and unit-tested (with a mocked pool) but
// never run against a real database. The one rule that matters most here —
// "a tenant must never be able to see another tenant's case" — is enforced
// by construction: every read/write below takes tenantId as a required
// parameter and includes it in the WHERE clause, never as an afterthought
// filter applied to an already-fetched row.

const { pool } = require('../db/index');

function requireTenantId(tenantId) {
  if (!tenantId) throw new Error('tenantId is required');
}

async function createCase(tenantId, input, client) {
  requireTenantId(tenantId);
  const db = client || pool;
  const {
    caseNumber, patientId = null, branchKey = null, sourceChannel = null,
    sourceCampaign = null, patientCountry = null, patientLanguage = null,
    patientTimezone = null, currency = 'EUR', estimatedValue = null,
  } = input;

  const { rows } = await db.query(
    `INSERT INTO cases (
       tenant_id, patient_id, case_number, branch_key, source_channel, source_campaign,
       patient_country, patient_language, patient_timezone, currency, estimated_value
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [tenantId, patientId, caseNumber, branchKey, sourceChannel, sourceCampaign,
      patientCountry, patientLanguage, patientTimezone, currency, estimatedValue],
  );
  return rows[0];
}

// Tenant-scoped fetch by id. Returns undefined (→ route responds 404, not
// 403) both when the case doesn't exist AND when it belongs to another
// tenant — a 403 would confirm the id exists at all, which is itself a
// cross-tenant information leak.
async function getCaseById(tenantId, id) {
  requireTenantId(tenantId);
  const { rows } = await pool.query(
    `SELECT * FROM cases WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return rows[0];
}

async function listCases(tenantId, { status, branchKey, limit = 50, offset = 0 } = {}) {
  requireTenantId(tenantId);
  const clauses = ['tenant_id = $1', 'deleted_at IS NULL'];
  const params = [tenantId];
  if (status) { params.push(status); clauses.push(`status = $${params.length}`); }
  if (branchKey) { params.push(branchKey); clauses.push(`branch_key = $${params.length}`); }
  params.push(limit); params.push(offset);
  const { rows } = await pool.query(
    `SELECT * FROM cases WHERE ${clauses.join(' AND ')}
     ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}

const VALID_STATUSES = [
  'new', 'qualified', 'pre_assessment', 'awaiting_doctor', 'quoted',
  'awaiting_deposit', 'reserved', 'travel_planned', 'arrived', 'treated',
  'returned', 'in_aftercare', 'completed', 'lost', 'medically_ineligible',
];

async function updateCaseStatus(tenantId, id, status, actorId) {
  requireTenantId(tenantId);
  if (!VALID_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);
  const { rows } = await pool.query(
    `UPDATE cases SET status = $1, updated_at = now()
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [status, id, tenantId],
  );
  const updated = rows[0];
  if (!updated) return undefined; // wrong tenant or missing — caller returns 404
  await appendCaseEvent(tenantId, id, 'status_changed', actorId, { status });
  return updated;
}

async function addMedia(tenantId, caseId, input, uploadedBy) {
  requireTenantId(tenantId);
  const owned = await getCaseById(tenantId, caseId);
  if (!owned) return undefined;
  const { kind, whatsappMediaId = null, storagePath = null, templateSlotId = null, qualityOk = null, aiExtraction = null } = input;
  const { rows } = await pool.query(
    `INSERT INTO case_media (case_id, kind, whatsapp_media_id, storage_path, template_slot_id, quality_ok, ai_extraction, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [caseId, kind, whatsappMediaId, storagePath, templateSlotId, qualityOk, aiExtraction, uploadedBy],
  );
  return rows[0];
}

async function upsertAssessment(tenantId, caseId, templateKey, answers, completed) {
  requireTenantId(tenantId);
  const owned = await getCaseById(tenantId, caseId);
  if (!owned) return undefined;
  const { rows } = await pool.query(
    `INSERT INTO case_assessments (case_id, template_key, answers, completed_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [caseId, templateKey, JSON.stringify(answers || {}), completed ? new Date() : null],
  );
  return rows[0];
}

async function addTimelineEntry(tenantId, caseId, input) {
  requireTenantId(tenantId);
  const owned = await getCaseById(tenantId, caseId);
  if (!owned) return undefined;
  const { dayOffset = null, title, startsAt = null, endsAt = null, location = null, type } = input;
  const { rows } = await pool.query(
    `INSERT INTO case_timeline (case_id, day_offset, title, starts_at, ends_at, location, type)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [caseId, dayOffset, JSON.stringify(title), startsAt, endsAt, location, type],
  );
  return rows[0];
}

// Append-only by convention (no updateCaseEvent/deleteCaseEvent export
// exists at all — KVKK audit requirement, CARENOVA-STRATEJI.md Bölüm 7/M7.3).
async function appendCaseEvent(tenantId, caseId, eventType, actorId, payload = {}) {
  requireTenantId(tenantId);
  const { rows } = await pool.query(
    `INSERT INTO case_events (case_id, event_type, actor_id, payload)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [caseId, eventType, actorId, JSON.stringify(payload)],
  );
  return rows[0];
}

async function listCaseEvents(tenantId, caseId) {
  requireTenantId(tenantId);
  const owned = await getCaseById(tenantId, caseId);
  if (!owned) return undefined;
  const { rows } = await pool.query(
    `SELECT * FROM case_events WHERE case_id = $1 ORDER BY created_at DESC`,
    [caseId],
  );
  return rows;
}

module.exports = {
  VALID_STATUSES,
  createCase, getCaseById, listCases, updateCaseStatus,
  addMedia, upsertAssessment, addTimelineEntry,
  appendCaseEvent, listCaseEvents,
};

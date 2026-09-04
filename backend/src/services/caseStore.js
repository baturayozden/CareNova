const { pool }     = require('../db/index');
const leadStore    = require('./leadStore');
const { normalizePhone } = leadStore;

// Split "Full Name" → { firstName, lastName }.
// First whitespace-delimited word = firstName; remainder = lastName.
function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: 'Unknown', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// Map case status to a reasonable initial lead status.
function leadStatusFromCase(caseStatus) {
  return ['signed', 'payment_sent', 'paid'].includes(caseStatus) ? 'booked' : 'new';
}

// camelCase → snake_case map for updateCase field filtering
const UPDATE_MAP = {
  patientName:             'patient_name',
  patientDob:              'patient_dob',
  patientAddress:          'patient_address',
  patientPhone:            'patient_phone',
  patientEmail:            'patient_email',
  treatmentDescription:    'treatment_description',
  totalCost:               'total_cost',
  amountDue:               'amount_due',
  paymentMethod:           'payment_method',
  payerType:               'payer_type',
  cardholderName:          'cardholder_name',
  cardholderRelationship:  'cardholder_relationship',
  cardholderAddress:       'cardholder_address',
  cardholderPhone:         'cardholder_phone',
  cardholderEmail:         'cardholder_email',
  cardScheme:              'card_scheme',
  cardFirst4:              'card_first4',
  cardLast4:               'card_last4',
  photoIdType:             'photo_id_type',
  photoIdRef:              'photo_id_ref',
  status:                  'status',
};

// client: optional pg PoolClient — when provided all queries run on that client
// (transaction-aware for atomic deal+case creation from commissions.js).
// Callers that omit client continue to use the shared pool (backward-compatible).
async function createCase(tenantId, input, client) {
  const db = client || pool;

  const {
    leadId, patientName, patientDob, patientAddress, patientPhone, patientEmail,
    treatmentDescription, totalCost, amountDue, paymentMethod, payerType = 'self',
    cardholderName, cardholderRelationship, cardholderAddress, cardholderPhone,
    cardholderEmail, cardScheme, cardFirst4, cardLast4,
    photoIdType, photoIdRef, status = 'draft', createdBy, assignedTo,
  } = input;

  let pName  = patientName  || null;
  let pPhone = patientPhone ? normalizePhone(patientPhone) : null;
  let pEmail = patientEmail || null;

  let resolvedLeadId  = leadId || null;
  let effectiveAssignee = assignedTo || null;

  if (resolvedLeadId) {
    // Lead explicitly provided — inherit name/phone/email and owner from the existing lead.
    const { rows: leadRows } = await db.query(
      `SELECT first_name, last_name, phone, email, assigned_to FROM leads WHERE id = $1 AND tenant_id = $2`,
      [resolvedLeadId, tenantId],
    );
    if (leadRows[0]) {
      const l = leadRows[0];
      const fullName = `${l.first_name} ${l.last_name}`.trim();
      if (!pName)  pName  = fullName || null;
      if (!pPhone) pPhone = l.phone  || null;
      if (!pEmail) pEmail = l.email  || null;
      effectiveAssignee = l.assigned_to || assignedTo || null;
    }
  } else {
    // No explicit lead — try to find one by phone first to avoid duplicates.
    if (pPhone) {
      const { rows: phoneMatch } = await db.query(
        `SELECT id, assigned_to FROM leads WHERE tenant_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1`,
        [tenantId, pPhone],
      );
      if (phoneMatch[0]) {
        resolvedLeadId    = phoneMatch[0].id;
        effectiveAssignee = phoneMatch[0].assigned_to || assignedTo || null;
      }
    }

    // Still no lead — create one inline using the transaction client (or pool).
    // Phone may be null; PostgreSQL NULL ≠ NULL so the unique constraint is safe.
    if (!resolvedLeadId) {
      const { firstName, lastName } = splitName(pName);
      try {
        const { rows: [newLead] } = await db.query(
          `INSERT INTO leads
             (tenant_id, first_name, last_name, phone, email, source, status,
              ai_follow_up_enabled, ai_follow_up_count, gdpr_consent_given, assigned_to)
           VALUES ($1,$2,$3,$4,$5,'payment_case',$6,FALSE,0,FALSE,$7)
           RETURNING id`,
          [
            tenantId, firstName, lastName,
            pPhone || null, pEmail || null,
            leadStatusFromCase(status),
            effectiveAssignee || createdBy || null,
          ],
        );
        resolvedLeadId = newLead.id;
        console.log(`[CaseStore] Auto-created lead ${newLead.id} for payment case (no prior lead)`);
      } catch (leadErr) {
        if (leadErr.code === '23505') {
          // Race on phone unique constraint — fetch the winner and link to it.
          const { rows: dupRows } = await db.query(
            `SELECT id, assigned_to FROM leads WHERE tenant_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1`,
            [tenantId, pPhone],
          );
          if (dupRows[0]) {
            resolvedLeadId    = dupRows[0].id;
            effectiveAssignee = dupRows[0].assigned_to || assignedTo || null;
          }
        } else {
          // Non-blocking: log but don't prevent case creation.
          console.error('[CaseStore] auto-create lead failed:', leadErr.message);
        }
      }
    }
  }

  const effectiveAmountDue = amountDue !== undefined && amountDue !== null
    ? amountDue
    : (totalCost || null);

  const { rows } = await db.query(`
    INSERT INTO treatment_cases (
      tenant_id, lead_id,
      patient_name, patient_dob, patient_address, patient_phone, patient_email,
      treatment_description, total_cost, amount_due,
      payment_method, payer_type,
      cardholder_name, cardholder_relationship, cardholder_address,
      cardholder_phone, cardholder_email,
      card_scheme, card_first4, card_last4,
      photo_id_type, photo_id_ref,
      status, created_by, assigned_to, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW(),NOW()
    ) RETURNING *
  `, [
    tenantId, resolvedLeadId,
    pName, patientDob || null, patientAddress || null, pPhone, pEmail,
    treatmentDescription || null, totalCost || null, effectiveAmountDue,
    paymentMethod || null, payerType,
    cardholderName || null, cardholderRelationship || null, cardholderAddress || null,
    cardholderPhone || null, cardholderEmail || null,
    cardScheme || null, cardFirst4 || null, cardLast4 || null,
    photoIdType || null, photoIdRef || null,
    status, createdBy || null, effectiveAssignee,
  ]);
  return rows[0];
}

async function listCases(tenantId, { status, assignedTo = null } = {}) {
  const params = [tenantId];
  const statusClause   = status     ? (params.push(status),     `AND status = $${params.length}`)      : '';
  const assignedClause = assignedTo ? (params.push(assignedTo), `AND assigned_to = $${params.length}`) : '';
  const { rows } = await pool.query(`
    SELECT * FROM treatment_cases
    WHERE tenant_id = $1 AND deleted_at IS NULL ${statusClause} ${assignedClause}
    ORDER BY created_at DESC
  `, params);
  return rows;
}

async function getCaseById(id, tenantId) {
  const { rows } = await pool.query(`
    SELECT tc.*,
      COALESCE(
        json_agg(lr ORDER BY lr.created_at ASC) FILTER (WHERE lr.id IS NOT NULL),
        '[]'
      ) AS links
    FROM treatment_cases tc
    LEFT JOIN link_requests lr ON lr.case_id = tc.id
    WHERE tc.id = $1 AND tc.tenant_id = $2 AND tc.deleted_at IS NULL
    GROUP BY tc.id
  `, [id, tenantId]);
  return rows[0] || null;
}

async function updateCase(id, tenantId, fields) {
  const setClauses = [];
  const params = [];
  for (const [camel, snake] of Object.entries(UPDATE_MAP)) {
    if (camel in fields) {
      params.push(fields[camel]);
      setClauses.push(`${snake} = $${params.length}`);
    }
  }
  if (setClauses.length === 0) return null;
  if (fields.status === 'paid') {
    setClauses.push('paid_at = COALESCE(paid_at, NOW())');
  }
  params.push(id, tenantId);
  const { rows } = await pool.query(`
    UPDATE treatment_cases
    SET ${setClauses.join(', ')}, updated_at = NOW()
    WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
    RETURNING *
  `, params);
  return rows[0] || null;
}

// Case status → deal status mapping.
// Guards: only updates deals where commission_locked = FALSE and deleted_at IS NULL.
const CASE_TO_DEAL_STATUS = {
  draft:              'quoted',
  awaiting_signature: 'quoted',
  signed:             'accepted',
  payment_sent:       'accepted',
  paid:               'completed',
  finance_referred:   'quoted',
  reversed:           'refunded',
  cancelled:          'cancelled',
  declined:           'cancelled',
  expired:            'quoted',
  bounced:            'quoted',
};

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'director', 'clinic_admin']);

// actor: { actorId, actorRole, tenantId } — null actorRole means system/webhook.
// Verification rules:
//   webhook (actorRole null) → auto_matched
//   admin role               → manually_approved (always overrides)
//   TC / other               → unverified, but never downgrades manually_approved
async function syncDealStatusFromCase(caseId, caseStatus, actor = {}, db) {
  const { actorId = null, actorRole = null, tenantId = null } = actor;
  const dealStatus = CASE_TO_DEAL_STATUS[caseStatus];
  if (!dealStatus) return 0;

  const verifStatus = actorRole === null
    ? 'auto_matched'
    : ADMIN_ROLES.has(actorRole)
      ? 'manually_approved'
      : 'unverified';

  const client = db || pool;

  const { rows: updated } = await client.query(
    `WITH before AS (
       SELECT id, status AS old_status
       FROM treatment_deals
       WHERE case_id = $2 AND deleted_at IS NULL AND commission_locked = FALSE
     ),
     upd AS (
       UPDATE treatment_deals td
       SET status = $1,
           verification_status = CASE
             WHEN $3 IN ('manually_approved', 'auto_matched') THEN $3
             WHEN td.verification_status = 'manually_approved'  THEN td.verification_status
             ELSE 'unverified'
           END,
           updated_at = NOW()
       WHERE td.case_id = $2 AND td.deleted_at IS NULL AND td.commission_locked = FALSE
       RETURNING td.id, td.status AS new_status, td.verification_status, td.tenant_id
     )
     SELECT b.old_status, u.id, u.new_status, u.verification_status, u.tenant_id
     FROM upd u JOIN before b ON b.id = u.id`,
    [dealStatus, caseId, verifStatus],
  );

  if (updated.length === 0) return 0;

  const logTenantId = tenantId || updated[0].tenant_id;
  if (logTenantId) {
    await Promise.all(updated.map(row =>
      client.query(
        `INSERT INTO commission_audit_log (tenant_id, event_type, changed_by, metadata)
         VALUES ($1, 'status_change', $2, $3)`,
        [logTenantId, actorId, JSON.stringify({
          deal_id:            row.id,
          case_id:            caseId,
          old_status:         row.old_status,
          new_status:         row.new_status,
          verification_status: row.verification_status,
        })],
      )
    ));
  }

  return updated.length;
}

module.exports = { createCase, listCases, getCaseById, updateCase, syncDealStatusFromCase, splitName, leadStatusFromCase };

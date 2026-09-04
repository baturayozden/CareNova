/**
 * Lead and message persistence layer.
 * All functions are async and write to Railway PostgreSQL.
 * Interface is identical to the previous in-memory version
 * so callers (whatsapp route, leads route) need no structural changes.
 */

const { pool } = require('../db/index');

// ---------------------------------------------------------------------------
// Phone normalization
// Produces the same format Meta webhook delivers (e.g. 447700900123) so that
// manually-created and WhatsApp-originated leads dedup correctly.
// ---------------------------------------------------------------------------

function normalizePhone(raw) {
  if (!raw) return raw;
  const s = raw.toString().trim();
  const hasPlus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');        // strip everything except digits
  if (hasPlus)              return digits;     // +447... → 447...
  if (digits.startsWith('00')) return digits.slice(2);   // 00447... → 447...
  if (digits.startsWith('0'))  return '44' + digits.slice(1); // 07... → 447...
  return digits;                               // already 447... or other country code
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

async function upsertLead({ phone, senderName, tenantId, language = 'en', assignedTo = null }) {
  if (!tenantId) throw new Error('upsertLead: tenantId is required — no default-tenant fallback');
  const tid = tenantId;

  const [firstName, ...rest] = (senderName || 'Unknown').split(' ');

  const { rows } = await pool.query(`
    INSERT INTO leads
      (tenant_id, phone, first_name, last_name, language, status, source,
       ai_follow_up_enabled, ai_follow_up_count, assigned_to)
    VALUES ($1, $2, $3, $4, $5, 'new', 'whatsapp', TRUE, 0, $6)
    ON CONFLICT (tenant_id, phone) DO UPDATE SET
      first_name = CASE
        WHEN EXCLUDED.first_name <> 'Unknown' THEN EXCLUDED.first_name
        ELSE leads.first_name
      END,
      updated_at = NOW()
    RETURNING *
  `, [tid, phone, firstName || 'Unknown', rest.join(' ') || '', language, assignedTo]);

  return pgLeadToStore(rows[0]);
}

async function createLead({ tenantId, firstName, lastName = '', phone, email = null, treatmentInterest = null, notes = null, language = 'en', source = 'manual', aiFollowUpEnabled = false, gdprConsentGiven = false, gdprConsentMethod = null, assignedTo = null }) {
  if (!tenantId) throw new Error('tenantId required');
  if (!firstName || !phone) throw new Error('firstName and phone are required');
  const normalizedPhone = normalizePhone(phone);
  try {
    const { rows } = await pool.query(`
      INSERT INTO leads
        (tenant_id, first_name, last_name, phone, email, source,
         treatment_interest, notes, language, status,
         ai_follow_up_enabled, ai_follow_up_count,
         gdpr_consent_given, gdpr_consent_at, gdpr_consent_method,
         assigned_to)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'new',$10,0,$11,
              CASE WHEN $11 THEN NOW() ELSE NULL END, $12, $13)
      RETURNING *
    `, [tenantId, firstName, lastName, normalizedPhone, email, source,
        treatmentInterest, notes, language, aiFollowUpEnabled,
        gdprConsentGiven, gdprConsentMethod, assignedTo]);
    return pgLeadToStore(rows[0]);
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'uq_leads_tenant_phone') {
      const e = new Error('A lead with this phone number already exists for this clinic.');
      e.code = 'DUPLICATE_PHONE';
      throw e;
    }
    throw err;
  }
}

async function bulkCreateLeads(tenantId, rows, { assignedTo = null } = {}) {
  // rows: [{ firstName, lastName, phone, email, treatmentInterest, notes, language }]
  // Toplu lead: AI follow-up ve GDPR consent HER ZAMAN kapalı (GDPR güvenliği).
  const inserted = [];
  const skipped  = [];  // { row: <1-based index>, reason }
  const validLangs = ['en', 'tr', 'ar', 'de', 'fr', 'es', 'pt', 'ru', 'zh'];

  for (let i = 0; i < rows.length; i++) {
    const r      = rows[i];
    const rowNum = i + 1;

    if (!r.firstName || !r.phone) {
      skipped.push({ row: rowNum, reason: 'Missing required field (name or phone)' });
      continue;
    }

    const lang     = (r.language || 'en').toLowerCase();
    const safeLang = validLangs.includes(lang) ? lang : 'en';

    try {
      const lead = await createLead({
        tenantId,
        firstName:         r.firstName,
        lastName:          r.lastName          || '',
        phone:             r.phone,
        email:             r.email             || null,
        treatmentInterest: r.treatmentInterest || null,
        notes:             r.notes             || null,
        language:          safeLang,
        source:            'bulk_csv',
        aiFollowUpEnabled: false,
        gdprConsentGiven:  false,
        gdprConsentMethod: null,
        assignedTo,
      });
      inserted.push(lead);
    } catch (err) {
      if (err.code === 'DUPLICATE_PHONE') {
        skipped.push({ row: rowNum, reason: 'Phone already exists for this clinic' });
      } else {
        skipped.push({ row: rowNum, reason: 'Database error' });
        console.error(`[Leads] bulk row ${rowNum} error:`, err.message);
      }
    }
  }

  return {
    insertedCount: inserted.length,
    skippedCount:  skipped.length,
    skipped,
    inserted,
  };
}

async function updateLead(id, tenantId, fields) {
  const allowed = {
    first_name:           fields.firstName,
    last_name:            fields.lastName,
    phone:                fields.phone,
    email:                fields.email,
    language:             fields.language,
    treatment_interest:   fields.treatmentInterest,
    notes:                fields.notes,
    ai_follow_up_enabled: fields.aiFollowUpEnabled,
    gdpr_consent_given:   fields.gdprConsentGiven,
    status:               fields.status,
    assigned_to:          fields.assignedTo,
  };
  // Only include keys that were actually provided (not undefined)
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [col, val] of Object.entries(allowed)) {
    if (val !== undefined) {
      sets.push(`${col} = $${i++}`);
      vals.push(val);
    }
  }
  // If consent is being granted now, stamp consent metadata
  if (fields.gdprConsentGiven === true) {
    sets.push(`gdpr_consent_at = COALESCE(gdpr_consent_at, NOW())`);
    sets.push(`gdpr_consent_method = COALESCE(gdpr_consent_method, 'verbal')`);
  }
  if (sets.length === 0) {
    return getLeadById(id); // nothing to update
  }
  sets.push(`updated_at = NOW()`);
  vals.push(id);
  vals.push(tenantId);
  try {
    const { rows } = await pool.query(`
      UPDATE leads SET ${sets.join(', ')}
      WHERE id = $${i++} AND tenant_id = $${i++} AND deleted_at IS NULL
      RETURNING *
    `, vals);
    return rows[0] ? pgLeadToStore(rows[0]) : null;
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'uq_leads_tenant_phone') {
      const e = new Error('A lead with this phone number already exists for this clinic.');
      e.code = 'DUPLICATE_PHONE';
      throw e;
    }
    throw err;
  }
}

async function updateLeadStatus(phone, status) {
  const { rows } = await pool.query(`
    UPDATE leads
    SET status = $1, status_changed_at = NOW(), updated_at = NOW()
    WHERE phone = $2 AND deleted_at IS NULL
    RETURNING *
  `, [status, phone]);
  return rows[0] ? pgLeadToStore(rows[0]) : null;
}

async function updateLeadAiFields(leadId, { language, aiFollowUpCount, lastAiMessageAt }) {
  await pool.query(`
    UPDATE leads
    SET language              = COALESCE($2, language),
        ai_follow_up_count    = $3,
        last_ai_message_at    = $4,
        updated_at            = NOW()
    WHERE id = $1
  `, [leadId, language, aiFollowUpCount, lastAiMessageAt]);
}

async function getLeadByPhone(phone) {
  const { rows } = await pool.query(
    'SELECT * FROM leads WHERE phone = $1 AND deleted_at IS NULL LIMIT 1',
    [phone]
  );
  return rows[0] ? pgLeadToStore(rows[0]) : null;
}

async function getAllLeads(tenantId, { page = 1, limit = 20, assignedTo = null } = {}) {
  const safePage  = Math.max(1, parseInt(page,  10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset    = (safePage - 1) * safeLimit;

  let where  = tenantId ? 'WHERE l.deleted_at IS NULL AND l.tenant_id = $1' : 'WHERE l.deleted_at IS NULL';
  let params = tenantId ? [tenantId] : [];

  if (assignedTo) {
    params = [...params, assignedTo];
    where += ` AND l.assigned_to = $${params.length}`;
  }

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(`
      SELECT l.*, t.name AS tenant_name
      FROM leads l
      JOIN tenants t ON t.id = l.tenant_id
      ${where}
      ORDER BY l.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, safeLimit, offset]),
    pool.query(`
      SELECT COUNT(*) AS total
      FROM leads l
      ${where}
    `, params),
  ]);

  return {
    leads:      rows.map(pgLeadToStore),
    total:      parseInt(countRows[0].total, 10),
    page:       safePage,
    limit:      safeLimit,
    totalPages: Math.ceil(parseInt(countRows[0].total, 10) / safeLimit),
  };
}

async function getLeadById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM leads WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  return rows[0] ? pgLeadToStore(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

async function saveMessage({ leadId, direction, content, aiGenerated = false, whatsappMessageId = null, status = 'pending', scenarioType = null, objectionType = null, whatsappConfigId = null }) {
  const { rows } = await pool.query(`
    INSERT INTO messages
      (tenant_id, lead_id, direction, content, ai_generated,
       whatsapp_message_id, status, scenario_type, objection_type, sent_at, whatsapp_config_id)
    SELECT
      l.tenant_id, l.id, $2::text, $3, $4::boolean, $5, $6::text, $7, $8,
      CASE WHEN $2::text = 'outbound' THEN NOW() ELSE NULL END,
      $9
    FROM leads l WHERE l.id = $1
    RETURNING *
  `, [leadId, direction, content, aiGenerated, whatsappMessageId, status, scenarioType, objectionType, whatsappConfigId]);
  return rows[0] ? pgMsgToStore(rows[0]) : null;
}

async function updateMessageStatus(whatsappMessageId, status) {
  const { rows } = await pool.query(`
    UPDATE messages SET status = $1, status_updated_at = NOW()
    WHERE whatsapp_message_id = $2
    RETURNING *
  `, [status, whatsappMessageId]);
  return rows[0] ? pgMsgToStore(rows[0]) : null;
}

async function getMessages(leadId, tenantId = null) {
  const params = [leadId];
  const tenantClause = tenantId ? `AND tenant_id = $2` : '';
  if (tenantId) params.push(tenantId);
  const { rows } = await pool.query(
    `SELECT * FROM messages WHERE lead_id = $1 ${tenantClause} ORDER BY created_at ASC`,
    params,
  );
  return rows.map(pgMsgToStore);
}

// ---------------------------------------------------------------------------
// Row mappers — snake_case DB columns → camelCase store objects
// ---------------------------------------------------------------------------

function pgLeadToStore(r) {
  return {
    id:                r.id,
    tenantId:          r.tenant_id,
    tenantName:        r.tenant_name || null,
    phone:             r.phone,
    firstName:         r.first_name,
    lastName:          r.last_name,
    email:             r.email,
    language:          r.language,
    status:            r.status,
    source:            r.source,
    treatmentInterest: r.treatment_interest,
    treatmentValue:    r.treatment_value != null ? parseFloat(r.treatment_value) : null,
    aiFollowUpEnabled: r.ai_follow_up_enabled,
    aiFollowUpCount:   r.ai_follow_up_count,
    lastAiMessageAt:   r.last_ai_message_at,
    gdprConsentGiven:  r.gdpr_consent_given,
    optedOutAt:        r.opted_out_at,
    leadScore:         r.lead_score        != null ? parseInt(r.lead_score, 10) : null,
    scoreLabel:        r.score_label       || null,
    scoreTags:         r.score_tags        || [],
    scoreReasoning:    r.score_reasoning   || null,
    scoreUpdatedAt:    r.score_updated_at  || null,
    assignedTo:        r.assigned_to  || null,
    createdAt:         r.created_at,
    updatedAt:         r.updated_at,
  };
}

function pgMsgToStore(r) {
  return {
    id:               r.id,
    leadId:           r.lead_id,
    direction:        r.direction,
    content:          r.content,
    aiGenerated:      r.ai_generated,
    whatsappMessageId: r.whatsapp_message_id,
    status:           r.status,
    scenarioType:     r.scenario_type    || null,
    objectionType:    r.objection_type   || null,
    createdAt:        r.created_at,
  };
}

module.exports = {
  normalizePhone,
  upsertLead,
  createLead,
  bulkCreateLeads,
  updateLead,
  updateLeadStatus,
  updateLeadAiFields,
  saveMessage,
  updateMessageStatus,
  getLeadByPhone,
  getLeadById,
  getMessages,
  getAllLeads,
};

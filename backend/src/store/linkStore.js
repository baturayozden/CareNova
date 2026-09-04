'use strict';

const crypto   = require('crypto');
const { pool } = require('../db/index');

async function genToken() {
  for (let i = 0; i < 3; i++) {
    const token = crypto.randomBytes(8).toString('hex');
    const { rows } = await pool.query(
      'SELECT 1 FROM link_requests WHERE short_token = $1',
      [token],
    );
    if (!rows.length) return token;
  }
  // Collision extremely unlikely; fall back to longer token
  return crypto.randomBytes(16).toString('hex');
}

async function createLinkRequest({
  tenantId, caseId, leadId, kind, recipient, channel,
  targetUrl, provider, createdBy, signwellDocumentId,
}) {
  const shortToken = await genToken();
  const { rows } = await pool.query(`
    INSERT INTO link_requests
      (tenant_id, case_id, lead_id, kind, recipient, channel,
       target_url, provider, created_by, short_token, status, created_at,
       signwell_document_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'created',NOW(),$11)
    RETURNING *
  `, [tenantId, caseId, leadId || null, kind, recipient, channel,
      targetUrl || null, provider || null, createdBy || null, shortToken,
      signwellDocumentId || null]);
  return rows[0];
}

async function setTargetUrl(id, targetUrl) {
  await pool.query(
    'UPDATE link_requests SET target_url = $1 WHERE id = $2',
    [targetUrl, id],
  );
}

async function markSent(id) {
  const { rows } = await pool.query(
    `UPDATE link_requests SET status = 'sent', sent_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id],
  );
  return rows[0];
}

async function markOpened(id) {
  const { rows } = await pool.query(
    `UPDATE link_requests SET status = 'opened', opened_at = NOW()
     WHERE id = $1 AND opened_at IS NULL RETURNING *`,
    [id],
  );
  return rows[0];
}

async function markCompleted(id) {
  const { rows } = await pool.query(
    `UPDATE link_requests SET status = 'completed'
     WHERE id = $1 RETURNING *`,
    [id],
  );
  return rows[0];
}

async function getByToken(token) {
  const { rows } = await pool.query(`
    SELECT
      lr.*,
      tc.patient_name,
      tc.treatment_description,
      tc.total_cost,
      tc.amount_due,
      tbp.trading_name,
      tbp.legal_entity_name,
      tbp.bank_name,
      tbp.bank_account_name,
      tbp.sort_code,
      tbp.account_number
    FROM link_requests lr
    JOIN  treatment_cases       tc  ON tc.id         = lr.case_id
    LEFT JOIN tenant_billing_profiles tbp ON tbp.tenant_id = lr.tenant_id
    WHERE lr.short_token = $1
      AND lr.status NOT IN ('expired', 'cancelled')
  `, [token]);
  return rows[0] || null;
}

module.exports = { createLinkRequest, setTargetUrl, markSent, markOpened, markCompleted, getByToken };

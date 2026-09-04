/**
 * Activity routes — paginated conversation list, summary stats,
 * weekly report, CSV export, and lead action endpoints.
 *
 * All routes require the `authenticate` middleware (applied in index.js).
 * Non-super-admin users are ALWAYS scoped to their own tenantId.
 */

const express = require('express');
const router  = express.Router();
const { pool } = require('../db/index');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a WHERE clause fragment and params array for the date-range filter
 * applied to l.last_ai_message_at.
 *
 * @param {string} dateRange  'today' | 'this_week' | 'this_month' | 'custom'
 * @param {string} dateFrom   ISO string (required when dateRange='custom')
 * @param {string} dateTo     ISO string (required when dateRange='custom')
 * @param {Array}  params     Existing params array; new values are appended.
 * @returns {{ sql: string, params: Array }}
 */
function buildDateFilter(dateRange, dateFrom, dateTo, params) {
  const fragments = [];

  if (!dateRange || dateRange === 'all') {
    return ''; // no date filter
  } else if (dateRange === 'today') {
    params.push(new Date().toISOString().slice(0, 10));
    fragments.push(`l.last_ai_message_at >= $${params.length}::date`);
  } else if (dateRange === 'this_month') {
    params.push(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
    fragments.push(`l.last_ai_message_at >= $${params.length}`);
  } else if (dateRange === 'last_7') {
    const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0);
    params.push(d.toISOString());
    fragments.push(`l.last_ai_message_at >= $${params.length}`);
  } else if (dateRange === 'last_30') {
    const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0);
    params.push(d.toISOString());
    fragments.push(`l.last_ai_message_at >= $${params.length}`);
  } else if (dateRange === 'last_90') {
    const d = new Date(); d.setDate(d.getDate() - 90); d.setHours(0, 0, 0, 0);
    params.push(d.toISOString());
    fragments.push(`l.last_ai_message_at >= $${params.length}`);
  } else if (dateRange === 'custom' && dateFrom && dateTo) {
    params.push(dateFrom);
    fragments.push(`l.last_ai_message_at >= $${params.length}`);
    params.push(dateTo);
    fragments.push(`l.last_ai_message_at <= $${params.length}`);
  } else {
    // default: this_week — Monday 00:00 of current week
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    params.push(monday.toISOString());
    fragments.push(`l.last_ai_message_at >= $${params.length}`);
  }

  return fragments.length ? `AND (${fragments.join(' AND ')})` : '';
}

/**
 * Derive outcome string from lead status + whether any inbound messages exist.
 * Used in SELECT as a CASE expression.
 */
const OUTCOME_CASE = `
  CASE
    WHEN l.status IN ('booked','attended')           THEN 'booked'
    WHEN l.status IN ('lost','archived')             THEN 'lost'
    WHEN l.status IN ('responded','qualified')
      OR last_reply.id IS NOT NULL                   THEN 'replied'
    ELSE 'no_response'
  END
`;

/**
 * Build the shared CTE + base SELECT used by both the list and export endpoints.
 * Returns { sql, params }.
 */
function buildListQuery(user, query, forExport = false) {
  const {
    clinic_id, date_range = 'all', date_from, date_to,
    scenario = 'all', outcome = 'all', language = 'all',
    action_required,
    page = 1, limit = 20,
  } = query;

  const params = [];

  // ── Tenant scoping ─────────────────────────────────────────────────────────
  let tenantFilter;
  if (['super_admin', 'admin'].includes(user.role)) {
    if (clinic_id) {
      params.push(clinic_id);
      tenantFilter = `AND l.tenant_id = $${params.length}`;
    } else {
      tenantFilter = '';
    }
  } else {
    // clinic_id param is intentionally ignored for non-platform-admin roles;
    // they are always locked to their own tenant.
    params.push(user.tenantId);
    tenantFilter = `AND l.tenant_id = $${params.length}`;
  }

  // ── Date filter ────────────────────────────────────────────────────────────
  const dateFilter = buildDateFilter(date_range, date_from, date_to, params);

  // ── Scenario filter ────────────────────────────────────────────────────────
  let scenarioFilter = '';
  if (scenario && scenario !== 'all') {
    params.push(scenario);
    scenarioFilter = `AND last_ai.scenario_type = $${params.length}`;
  }

  // ── Language filter ────────────────────────────────────────────────────────
  let languageFilter = '';
  if (language && language !== 'all') {
    params.push(language);
    languageFilter = `AND l.language = $${params.length}`;
  }

  // ── Action required filter ─────────────────────────────────────────────────
  let actionFilter = '';
  if (action_required === 'true' || action_required === true) {
    actionFilter = 'AND l.action_required = TRUE';
  } else if (action_required === 'false' || action_required === false) {
    actionFilter = 'AND l.action_required = FALSE';
  }

  const cte = `
    WITH last_ai AS (
      SELECT DISTINCT ON (lead_id)
        id, lead_id, content, created_at, status, scenario_type
      FROM messages
      WHERE direction = 'outbound' AND ai_generated = TRUE
      ORDER BY lead_id, created_at DESC
    ),
    last_reply AS (
      SELECT DISTINCT ON (lead_id)
        id, lead_id, content, created_at
      FROM messages
      WHERE direction = 'inbound'
      ORDER BY lead_id, created_at DESC
    ),
    last_inbound AS (
      SELECT DISTINCT ON (lead_id)
        lead_id, objection_type
      FROM messages
      WHERE direction = 'inbound' AND objection_type IS NOT NULL
      ORDER BY lead_id, created_at DESC
    )
  `;

  const selectCols = forExport
    ? `
        l.first_name || ' ' || COALESCE(l.last_name, '')  AS patient_name,
        l.phone,
        t.name                                             AS clinic,
        l.language,
        l.treatment_interest                               AS treatment,
        l.treatment_value,
        last_ai.scenario_type                              AS scenario,
        l.ai_follow_up_count                               AS ai_messages,
        ${OUTCOME_CASE}                                    AS outcome,
        last_ai.created_at                                 AS last_contact,
        l.status
      `
    : `
        l.id                                               AS "leadId",
        l.first_name || ' ' || COALESCE(l.last_name, '')  AS "patientName",
        l.phone,
        l.language,
        t.name                                             AS clinic,
        t.id                                               AS "clinicId",
        last_ai.scenario_type                              AS scenario,
        ${OUTCOME_CASE}                                    AS outcome,
        l.treatment_interest                               AS treatment,
        l.treatment_value                                  AS "treatmentValue",
        l.ai_follow_up_count                               AS "aiMessages",
        last_ai.content                                    AS "lastAiContent",
        last_ai.created_at                                 AS "lastAiAt",
        last_ai.status                                     AS "deliveryStatus",
        last_reply.content                                 AS "lastReplyContent",
        last_reply.created_at                              AS "lastReplyAt",
        last_inbound.objection_type                        AS "objectionType",
        l.action_required                                  AS "actionRequired",
        l.ai_follow_up_enabled                             AS "aiFollowUpEnabled",
        l.created_at                                       AS "leadCreatedAt"
      `;

  const fromClause = `
    FROM leads l
    JOIN tenants t ON t.id = l.tenant_id
    LEFT JOIN last_ai      ON last_ai.lead_id      = l.id
    LEFT JOIN last_reply   ON last_reply.lead_id   = l.id
    LEFT JOIN last_inbound ON last_inbound.lead_id = l.id
    WHERE l.deleted_at IS NULL
      ${tenantFilter}
      ${dateFilter}
      ${scenarioFilter}
      ${languageFilter}
      ${actionFilter}
  `;

  // outcome is a derived expression; filter happens in HAVING or as subquery
  // We wrap it to filter on derived outcome
  let outcomeHaving = '';
  if (outcome && outcome !== 'all') {
    outcomeHaving = `HAVING (${OUTCOME_CASE}) = '${outcome.replace(/'/g, "''")}'`;
  }

  const groupBy = forExport
    ? `GROUP BY l.id, t.id, t.name, last_ai.id, last_ai.scenario_type, last_ai.content,
               last_ai.created_at, last_ai.status, last_reply.id, last_reply.content, last_reply.created_at,
               last_inbound.objection_type`
    : `GROUP BY l.id, t.id, t.name, last_ai.id, last_ai.scenario_type, last_ai.content,
               last_ai.created_at, last_ai.status, last_reply.id, last_reply.content, last_reply.created_at,
               last_inbound.objection_type`;

  const orderBy = 'ORDER BY last_ai.created_at DESC NULLS LAST';

  if (forExport) {
    const sql = `${cte} SELECT ${selectCols} ${fromClause} ${groupBy} ${outcomeHaving} ${orderBy}`;
    return { sql, params };
  }

  // Pagination
  const pageNum  = Math.max(1, parseInt(page, 10)  || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  params.push(limitNum);
  const limitParam = params.length;
  params.push((pageNum - 1) * limitNum);
  const offsetParam = params.length;

  const sql = `
    ${cte}
    SELECT ${selectCols}
    ${fromClause}
    ${groupBy}
    ${outcomeHaving}
    ${orderBy}
    LIMIT $${limitParam} OFFSET $${offsetParam}
  `;

  return { sql, params, pageNum, limitNum };
}

// ─── GET /api/activity ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { sql, params, pageNum, limitNum } = buildListQuery(req.user, req.query);

    const { rows } = await pool.query(sql, params);

    // Count total (same filters but no pagination)
    const { sql: countSql, params: countParams } = buildListQuery(req.user, req.query, false);
    // We can't easily reuse the paged query for count; build a simpler count query
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM (${countSql.replace(/LIMIT \$\d+ OFFSET \$\d+/, '')}) sub`,
      countParams.slice(0, countParams.length - 2)  // remove limit/offset params
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    // Count action_required (scoped)
    let arScopeFilter = '';
    const arParams = [];
    if (req.user.role !== 'super_admin') {
      arParams.push(req.user.tenantId);
      arScopeFilter = `AND tenant_id = $${arParams.length}`;
    }
    const { rows: arRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM leads WHERE deleted_at IS NULL AND action_required = TRUE ${arScopeFilter}`,
      arParams
    );
    const actionRequired = parseInt(arRows[0]?.cnt || 0, 10);

    res.json({
      conversations: rows,
      total,
      pages: Math.ceil(total / limitNum),
      summary: { total, actionRequired },
    });
  } catch (err) {
    console.error('[Activity] GET / error:', err.message);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// ─── GET /api/activity/summary ─────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const tenantId     = req.user.tenantId;

    // Tenant scope helpers
    const scopeParams = isSuperAdmin ? [] : [tenantId];
    const scopeSql    = isSuperAdmin ? '' : `AND tenant_id = $1`;

    // todayMessages — outbound ai_generated today
    const { rows: todayRows } = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM messages
      WHERE direction = 'outbound'
        AND ai_generated = TRUE
        AND created_at >= NOW()::date
        ${scopeSql}
    `, scopeParams);
    const todayMessages = parseInt(todayRows[0]?.cnt || 0, 10);

    // todayLeadsContacted — distinct leads with AI outbound today
    const { rows: todayLeadsRows } = await pool.query(`
      SELECT COUNT(DISTINCT lead_id) AS cnt
      FROM messages
      WHERE direction = 'outbound'
        AND ai_generated = TRUE
        AND created_at >= NOW()::date
        ${scopeSql}
    `, scopeParams);
    const todayLeadsContacted = parseInt(todayLeadsRows[0]?.cnt || 0, 10);

    // replyRate this week — % of AI-contacted leads that got an inbound reply
    const now = new Date();
    const day  = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.toISOString();

    const weekScopeParams = isSuperAdmin ? [weekStart] : [tenantId, weekStart];
    const weekScopeSql    = isSuperAdmin ? '' : `AND ai.tenant_id = $1`;
    const weekStartParam  = isSuperAdmin ? 1 : 2;

    const { rows: replyRows } = await pool.query(`
      SELECT
        COUNT(DISTINCT ai.lead_id)                                       AS contacted,
        COUNT(DISTINCT inb.lead_id)                                      AS replied
      FROM messages ai
      LEFT JOIN messages inb ON inb.lead_id = ai.lead_id
        AND inb.direction = 'inbound'
        AND inb.created_at >= $${weekStartParam}
      WHERE ai.direction = 'outbound'
        AND ai.ai_generated = TRUE
        AND ai.created_at >= $${weekStartParam}
        ${weekScopeSql}
    `, weekScopeParams);

    const contacted  = parseInt(replyRows[0]?.contacted || 0, 10);
    const replied    = parseInt(replyRows[0]?.replied    || 0, 10);
    const replyRate  = contacted > 0 ? parseFloat((replied / contacted * 100).toFixed(1)) : 0;

    // conversionRate this week — booked/attended among leads contacted this week
    const { rows: convRows } = await pool.query(`
      SELECT
        COUNT(DISTINCT ai.lead_id)                                                       AS contacted,
        COUNT(DISTINCT ai.lead_id) FILTER (WHERE l.status IN ('booked','attended'))      AS converted
      FROM messages ai
      JOIN leads l ON l.id = ai.lead_id
      WHERE ai.direction = 'outbound'
        AND ai.ai_generated = TRUE
        AND ai.created_at >= $${weekStartParam}
        ${weekScopeSql}
    `, weekScopeParams);

    const convContacted    = parseInt(convRows[0]?.contacted || 0, 10);
    const convConverted    = parseInt(convRows[0]?.converted  || 0, 10);
    const conversionRate   = convContacted > 0
      ? parseFloat((convConverted / convContacted * 100).toFixed(1)) : 0;

    // pendingActions
    const { rows: paRows } = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM leads
      WHERE deleted_at IS NULL AND action_required = TRUE
        ${isSuperAdmin ? '' : `AND tenant_id = $1`}
    `, isSuperAdmin ? [] : [tenantId]);
    const pendingActions = parseInt(paRows[0]?.cnt || 0, 10);

    res.json({
      todayMessages,
      replyRate,
      conversionRate,
      pendingActions,
      todayLeadsContacted,
    });
  } catch (err) {
    console.error('[Activity] GET /summary error:', err.message);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ─── GET /api/activity/weekly-report ──────────────────────────────────────────
router.get('/weekly-report', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const tenantId     = req.user.tenantId;

    const { period = 'this_week', date_from, date_to } = req.query;
    const now = new Date();
    let curStart, curEnd, prevStart, prevEnd, compareLabel;

    if (period === 'today') {
      curStart = new Date(now); curStart.setHours(0, 0, 0, 0);
      curEnd   = now;
      prevStart = new Date(curStart); prevStart.setDate(curStart.getDate() - 1);
      prevEnd   = new Date(curStart);
      compareLabel = 'vs yesterday';
    } else if (period === 'last_7') {
      curStart = new Date(now); curStart.setDate(now.getDate() - 7); curStart.setHours(0, 0, 0, 0);
      curEnd   = now;
      prevStart = new Date(curStart); prevStart.setDate(curStart.getDate() - 7);
      prevEnd   = new Date(curStart);
      compareLabel = 'vs prev 7 days';
    } else if (period === 'last_30') {
      curStart = new Date(now); curStart.setDate(now.getDate() - 30); curStart.setHours(0, 0, 0, 0);
      curEnd   = now;
      prevStart = new Date(curStart); prevStart.setDate(curStart.getDate() - 30);
      prevEnd   = new Date(curStart);
      compareLabel = 'vs prev 30 days';
    } else if (period === 'last_90') {
      curStart = new Date(now); curStart.setDate(now.getDate() - 90); curStart.setHours(0, 0, 0, 0);
      curEnd   = now;
      prevStart = new Date(curStart); prevStart.setDate(curStart.getDate() - 90);
      prevEnd   = new Date(curStart);
      compareLabel = 'vs prev 90 days';
    } else if (period === 'custom' && date_from && date_to) {
      curStart  = new Date(date_from);
      curEnd    = new Date(date_to);
      const rangeMs = curEnd.getTime() - curStart.getTime();
      prevEnd   = new Date(curStart);
      prevStart = new Date(curStart.getTime() - rangeMs);
      compareLabel = 'vs prev period';
    } else {
      // this_week (default): Monday 00:00 → now
      const day  = now.getDay();
      const diff = (day === 0 ? -6 : 1 - day);
      curStart = new Date(now); curStart.setDate(now.getDate() + diff); curStart.setHours(0, 0, 0, 0);
      curEnd   = now;
      prevStart = new Date(curStart); prevStart.setDate(curStart.getDate() - 7);
      prevEnd   = new Date(curStart);
      compareLabel = 'vs last week';
    }

    async function getWeekStats(start, end) {
      const params    = [start.toISOString(), end ? end.toISOString() : now.toISOString()];
      const tenantIdx = 3;
      if (!isSuperAdmin) params.push(tenantId);
      const tenantSql = isSuperAdmin ? '' : `AND l.tenant_id = $${tenantIdx}`;
      const mTenantSql = isSuperAdmin ? '' : `AND m.tenant_id = $${tenantIdx}`;

      // leadsRecovered: first AI message in period, not lost/archived
      const { rows: recovRows } = await pool.query(`
        SELECT
          COUNT(DISTINCT l.id)               AS leads_recovered,
          COALESCE(SUM(l.treatment_value), 0) AS pipeline_value
        FROM leads l
        JOIN messages first_ai ON first_ai.id = (
          SELECT id FROM messages
          WHERE lead_id = l.id
            AND direction = 'outbound'
            AND ai_generated = TRUE
          ORDER BY created_at ASC
          LIMIT 1
        )
        WHERE first_ai.created_at >= $1
          AND first_ai.created_at < $2
          AND l.status NOT IN ('lost','archived')
          AND l.deleted_at IS NULL
          ${tenantSql}
      `, params);

      // bookingsMade: status_changed_at in period + status booked/attended
      const { rows: bookRows } = await pool.query(`
        SELECT COUNT(*) AS bookings_made
        FROM leads l
        WHERE l.status IN ('booked','attended')
          AND l.status_changed_at >= $1
          AND l.status_changed_at < $2
          AND l.deleted_at IS NULL
          ${tenantSql}
      `, params);

      // avgResponseSecs: AVG time from first inbound to first outbound per lead
      const { rows: respRows } = await pool.query(`
        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (first_out.created_at - first_in.created_at))), 0) AS avg_secs
        FROM (
          SELECT DISTINCT ON (lead_id) lead_id, created_at
          FROM messages m
          WHERE direction = 'inbound'
            AND created_at >= $1 AND created_at < $2
            ${mTenantSql}
          ORDER BY lead_id, created_at ASC
        ) first_in
        JOIN (
          SELECT DISTINCT ON (lead_id) lead_id, created_at
          FROM messages m
          WHERE direction = 'outbound'
            AND created_at >= $1 AND created_at < $2
            ${mTenantSql}
          ORDER BY lead_id, created_at ASC
        ) first_out ON first_out.lead_id = first_in.lead_id
        WHERE first_out.created_at > first_in.created_at
      `, params);

      // topScenario
      const { rows: scRows } = await pool.query(`
        SELECT scenario_type, COUNT(*) AS cnt
        FROM messages m
        WHERE scenario_type IS NOT NULL
          AND created_at >= $1 AND created_at < $2
          ${mTenantSql}
        GROUP BY scenario_type
        ORDER BY cnt DESC
        LIMIT 1
      `, params);

      return {
        leadsRecovered: parseInt(recovRows[0]?.leads_recovered  || 0, 10),
        pipelineValue:  parseFloat(recovRows[0]?.pipeline_value || 0),
        bookingsMade:   parseInt(bookRows[0]?.bookings_made     || 0, 10),
        avgResponseSecs: Math.round(parseFloat(respRows[0]?.avg_secs || 0)),
        topScenario:    scRows[0]?.scenario_type || null,
      };
    }

    const [current, previous] = await Promise.all([
      getWeekStats(curStart, curEnd),
      getWeekStats(prevStart, prevEnd),
    ]);

    res.json({ current, previous, compareLabel });
  } catch (err) {
    console.error('[Activity] GET /weekly-report error:', err.message);
    res.status(500).json({ error: 'Failed to fetch weekly report' });
  }
});

// ─── GET /api/activity/export ─────────────────────────────────────────────────
router.get('/export', async (req, res) => {
  try {
    const { sql, params } = buildListQuery(req.user, req.query, true);
    const { rows } = await pool.query(sql, params);

    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="carenova-activity-${today}.csv"`);

    const headers = ['Name', 'Phone', 'Clinic', 'Language', 'Treatment', 'Value (€)', 'Scenario', 'AI Messages', 'Outcome', 'Last Contact', 'Status'];
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push([
        escape(row.patient_name),
        escape(row.phone),
        escape(row.clinic),
        escape(row.language),
        escape(row.treatment),
        escape(row.treatment_value),
        escape(row.scenario),
        escape(row.ai_messages),
        escape(row.outcome),
        escape(row.last_contact ? new Date(row.last_contact).toISOString() : ''),
        escape(row.status),
      ].join(','));
    }

    res.send(lines.join('\r\n'));
  } catch (err) {
    console.error('[Activity] GET /export error:', err.message);
    res.status(500).json({ error: 'Failed to export activity' });
  }
});

// ─── POST /api/activity/leads/:leadId/take-over ────────────────────────────────
router.post('/leads/:leadId/take-over', async (req, res) => {
  try {
    const { leadId } = req.params;
    const isSuperAdmin = req.user.role === 'super_admin';

    // Build scope check
    const scopeParams = isSuperAdmin ? [leadId] : [leadId, req.user.tenantId];
    const scopeSql    = isSuperAdmin ? '' : 'AND tenant_id = $2';

    const { rows } = await pool.query(`
      UPDATE leads
      SET ai_follow_up_enabled = FALSE,
          action_required      = TRUE,
          updated_at           = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
        ${scopeSql}
      RETURNING id
    `, scopeParams);

    if (!rows.length) return res.status(404).json({ error: 'Lead not found' });

    res.json({ success: true, leadId: rows[0].id });
  } catch (err) {
    console.error('[Activity] POST /take-over error:', err.message);
    res.status(500).json({ error: 'Failed to take over lead' });
  }
});

// ─── POST /api/activity/leads/:leadId/mark-called ─────────────────────────────
router.post('/leads/:leadId/mark-called', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { note }   = req.body || {};
    const isSuperAdmin = req.user.role === 'super_admin';

    const scopeParams = isSuperAdmin ? [leadId] : [leadId, req.user.tenantId];
    const scopeSql    = isSuperAdmin ? '' : 'AND tenant_id = $2';

    const { rows } = await pool.query(`
      UPDATE leads
      SET status           = 'qualified',
          status_changed_at = NOW(),
          action_required  = FALSE,
          updated_at       = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
        ${scopeSql}
      RETURNING id, tenant_id
    `, scopeParams);

    if (!rows.length) return res.status(404).json({ error: 'Lead not found' });

    const { id: lid, tenant_id: tenantId } = rows[0];

    if (note && note.trim()) {
      await pool.query(`
        INSERT INTO messages
          (tenant_id, lead_id, direction, content, ai_generated, status, sent_at, created_at)
        VALUES ($1, $2, 'outbound', $3, FALSE, 'sent', NOW(), NOW())
      `, [tenantId, lid, note.trim()]);
    }

    res.json({ success: true, leadId: lid });
  } catch (err) {
    console.error('[Activity] POST /mark-called error:', err.message);
    res.status(500).json({ error: 'Failed to mark lead as called' });
  }
});

module.exports = router;

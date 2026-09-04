/**
 * insights.js — Super-admin global insights across all clinics.
 * GET /api/insights/global
 */

const express = require('express');
const router  = express.Router();
const { pool } = require('../db/index');

const OBJECTION_LABELS = {
  price_too_high:         'Price Too High',
  comparing_competitors:  'Comparing Competitors',
  timing_issue:           'Timing Issue',
  anxiety_fear:           'Anxiety / Fear',
  trust_concern:          'Trust Concern',
  availability:           'Availability',
  finance_options:        'Finance Options',
  general_enquiry:        'General Enquiry',
};

function parseDateRange(query) {
  const { period = 'last_30', date_from, date_to } = query;
  const now = new Date();
  let start, end = new Date(now);

  if (period === 'today') {
    start = new Date(now); start.setHours(0, 0, 0, 0);
  } else if (period === 'this_week') {
    start = new Date(now);
    const d = now.getDay();
    start.setDate(now.getDate() - (d === 0 ? 6 : d - 1));
    start.setHours(0, 0, 0, 0);
  } else if (period === 'last_7') {
    start = new Date(now); start.setDate(now.getDate() - 7);
  } else if (period === 'last_90') {
    start = new Date(now); start.setDate(now.getDate() - 90);
  } else if (period === 'custom' && date_from && date_to) {
    start = new Date(date_from); end = new Date(date_to);
  } else {
    // last_30 (default)
    start = new Date(now); start.setDate(now.getDate() - 30);
  }
  return { start, end };
}

// ── GET /api/insights/global ──────────────────────────────────────────────────
router.get('/global', async (req, res) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin only' });
  }

  try {
    const { start, end } = parseDateRange(req.query);
    const p = [start.toISOString(), end.toISOString()];

    // ── Top objections ────────────────────────────────────────────────────────
    const { rows: objRows } = await pool.query(`
      SELECT objection_type, COUNT(*) AS cnt
      FROM messages
      WHERE direction = 'inbound'
        AND objection_type IS NOT NULL
        AND objection_type <> 'general_enquiry'
        AND created_at >= $1 AND created_at < $2
      GROUP BY objection_type
      ORDER BY cnt DESC
      LIMIT 8
    `, p);

    // ── Scenario conversion performance ──────────────────────────────────────
    const { rows: scRows } = await pool.query(`
      SELECT
        m.scenario_type,
        COUNT(DISTINCT m.lead_id)                                                    AS total_leads,
        COUNT(DISTINCT m.lead_id) FILTER (WHERE l.status IN ('booked','attended'))   AS booked
      FROM messages m
      JOIN leads l ON l.id = m.lead_id
      WHERE m.direction = 'outbound'
        AND m.ai_generated = TRUE
        AND m.scenario_type IS NOT NULL
        AND m.created_at >= $1 AND m.created_at < $2
      GROUP BY m.scenario_type
      ORDER BY booked DESC
    `, p);

    // ── Weekly sentiment (rule-based positive/negative keyword detection) ─────
    const { rows: sentRows } = await pool.query(`
      SELECT
        DATE_TRUNC('week', created_at) AS week,
        SUM(CASE WHEN content ~* 'great|perfect|wonderful|love|yes|definitely|thank|booked|confirmed|happy|excellent|interested|sounds good|let.s do it|book me' THEN 1 ELSE 0 END)  AS positive,
        SUM(CASE WHEN content ~* '\mnot\M|\mno\M|too expensive|scared|can.t|won.t|maybe not|too busy|not ready|not sure|doubt|cancel|stop' THEN 1 ELSE 0 END)                       AS negative,
        COUNT(*) AS total
      FROM messages
      WHERE direction = 'inbound'
        AND created_at >= $1 AND created_at < $2
      GROUP BY week
      ORDER BY week ASC
    `, p);

    // ── Clinic activity leaderboard — two pre-aggregated subqueries, no cartesian ──
    const { rows: clinicRows } = await pool.query(`
      SELECT
        t.id   AS clinic_id,
        t.name AS clinic_name,
        COALESCE(l.leads,      0) AS leads,
        COALESCE(l.bookings,   0) AS bookings,
        COALESCE(m.ai_messages,0) AS ai_messages
      FROM tenants t
      LEFT JOIN (
        SELECT tenant_id,
          COUNT(*) FILTER (WHERE deleted_at IS NULL)                              AS leads,
          COUNT(*) FILTER (WHERE status IN ('booked','attended') AND deleted_at IS NULL) AS bookings
        FROM leads
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY tenant_id
      ) l ON l.tenant_id = t.id
      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS ai_messages
        FROM messages
        WHERE direction = 'outbound' AND ai_generated = TRUE
          AND created_at >= $1 AND created_at < $2
        GROUP BY tenant_id
      ) m ON m.tenant_id = t.id
      WHERE t.deleted_at IS NULL
        AND (COALESCE(m.ai_messages, 0) > 0 OR COALESCE(l.leads, 0) > 0)
      ORDER BY COALESCE(m.ai_messages, 0) DESC
      LIMIT 10
    `, p);

    // ── Language distribution across all inbound ──────────────────────────────
    const { rows: langRows } = await pool.query(`
      SELECT l.language, COUNT(*) AS cnt
      FROM messages m
      JOIN leads l ON l.id = m.lead_id
      WHERE m.direction = 'inbound'
        AND m.created_at >= $1 AND m.created_at < $2
        AND l.language IS NOT NULL
      GROUP BY l.language
      ORDER BY cnt DESC
    `, p);

    // ── Overall funnel ────────────────────────────────────────────────────────
    const { rows: funnelRows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2)                          AS new_leads,
        COUNT(*) FILTER (WHERE status IN ('responded','qualified','booked','attended')
                           AND created_at >= $1 AND created_at < $2)                          AS engaged,
        COUNT(*) FILTER (WHERE status IN ('booked','attended')
                           AND created_at >= $1 AND created_at < $2)                          AS booked,
        COUNT(*) FILTER (WHERE status = 'attended'
                           AND created_at >= $1 AND created_at < $2)                          AS attended
      FROM leads
      WHERE deleted_at IS NULL
    `, p);

    const funnel = funnelRows[0] || {};

    // ── Language pct ──────────────────────────────────────────────────────────
    const langTotal = langRows.reduce((s, r) => s + parseInt(r.cnt, 10), 0) || 1;

    // ── Funnel pct ────────────────────────────────────────────────────────────
    const nl     = parseInt(funnel.new_leads || 0, 10) || 1;
    const pctOf  = (n) => parseFloat((parseInt(n || 0, 10) / nl * 100).toFixed(1));

    res.json({
      period: { start: start.toISOString(), end: end.toISOString() },

      topObjections: objRows.map(r => ({
        type:  r.objection_type,
        count: parseInt(r.cnt, 10),
        label: OBJECTION_LABELS[r.objection_type] || r.objection_type,
      })),

      scenarioPerformance: scRows.map(r => {
        const total = parseInt(r.total_leads, 10);
        const book  = parseInt(r.booked,      10);
        return {
          scenario:       r.scenario_type,
          total:          total,
          booked:         book,
          conversionRate: total > 0 ? parseFloat((book / total * 100).toFixed(1)) : 0,
        };
      }),

      sentimentTrend: sentRows.map(r => ({
        week:     r.week,
        positive: parseInt(r.positive, 10),
        negative: parseInt(r.negative, 10),
        neutral:  Math.max(0, parseInt(r.total, 10) - parseInt(r.positive, 10) - parseInt(r.negative, 10)),
      })),

      clinicActivity: clinicRows.map(r => {
        const leads    = parseInt(r.leads,       10);
        const bookings = parseInt(r.bookings,    10);
        return {
          clinicId:       r.clinic_id,
          clinicName:     r.clinic_name,
          leads:          leads,
          aiMessages:     parseInt(r.ai_messages, 10),
          bookings:       bookings,
          conversionRate: leads > 0 ? parseFloat((bookings / leads * 100).toFixed(1)) : 0,
        };
      }),

      languageDistribution: langRows.map(r => ({
        language: r.language,
        count:    parseInt(r.cnt, 10),
        pct:      parseFloat((parseInt(r.cnt, 10) / langTotal * 100).toFixed(1)),
      })),

      funnel: [
        { stage: 'New Leads', count: parseInt(funnel.new_leads || 0, 10), pct: 100 },
        { stage: 'Engaged',   count: parseInt(funnel.engaged   || 0, 10), pct: pctOf(funnel.engaged)  },
        { stage: 'Booked',    count: parseInt(funnel.booked    || 0, 10), pct: pctOf(funnel.booked)   },
        { stage: 'Attended',  count: parseInt(funnel.attended  || 0, 10), pct: pctOf(funnel.attended) },
      ],
    });
  } catch (err) {
    console.error('[Insights] GET /global error:', err.message);
    res.status(500).json({ error: 'Failed to load insights' });
  }
});

module.exports = router;

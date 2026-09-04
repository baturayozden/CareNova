/**
 * Migration: add scenario_type to messages + action_required to leads.
 * Populates scenario_type via content heuristics on existing messages.
 * Updates action_required on all leads.
 *
 * Usage: node src/db/migrate-activity-fields.js
 */

require('dotenv').config({ override: true, path: require('path').join(__dirname, '../../.env') });
const { pool } = require('./index');

async function run() {
  const client = await pool.connect();
  try {
    console.log('[Migrate] Starting activity-fields migration…');

    // ── 1. Add scenario_type to messages ─────────────────────────────────────
    await client.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS scenario_type VARCHAR(50)
    `);
    console.log('[Migrate] OK: messages.scenario_type column ensured');

    // ── 2. Add action_required to leads ──────────────────────────────────────
    await client.query(`
      ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS action_required BOOLEAN NOT NULL DEFAULT FALSE
    `);
    console.log('[Migrate] OK: leads.action_required column ensured');

    // ── 3. Populate scenario_type on existing messages ────────────────────────
    // All updates run in order; later rules take precedence where multiple
    // conditions match (but they are written to be reasonably exclusive).

    // 3a. missed_call — lead source takes highest priority
    const { rowCount: mc } = await client.query(`
      UPDATE messages m
      SET scenario_type = 'missed_call'
      FROM leads l
      WHERE m.lead_id = l.id
        AND l.source = 'missed_call'
        AND m.scenario_type IS NULL
    `);
    console.log(`[Migrate] scenario_type=missed_call: ${mc} messages`);

    // 3b. finance_objection — price / cost keywords (EN/TR/AR)
    const { rowCount: fo } = await client.query(`
      UPDATE messages
      SET scenario_type = 'finance_objection'
      WHERE scenario_type IS NULL
        AND (
          content ILIKE '%price%'   OR content ILIKE '%cost%'    OR
          content ILIKE '%afford%'  OR content ILIKE '%expensive%' OR
          content ILIKE '%cheap%'   OR content LIKE '%€%'         OR
          content ILIKE '%fiyat%'   OR content ILIKE '%ücret%'    OR
          content LIKE '%سعر%'
        )
    `);
    console.log(`[Migrate] scenario_type=finance_objection: ${fo} messages`);

    // 3c. new_enquiry — treatment keywords
    const { rowCount: ne } = await client.query(`
      UPDATE messages
      SET scenario_type = 'new_enquiry'
      WHERE scenario_type IS NULL
        AND (
          content ILIKE '%implant%'     OR content ILIKE '%veneer%'  OR
          content ILIKE '%invisalign%'  OR content ILIKE '%whitening%' OR
          content ILIKE '%rehab%'
        )
    `);
    console.log(`[Migrate] scenario_type=new_enquiry: ${ne} messages`);

    // 3d. cold_lead — first outbound message per lead that has ≥3 prior AI messages
    //     "prior" means messages created before this outbound message.
    const { rowCount: cl } = await client.query(`
      UPDATE messages m
      SET scenario_type = 'cold_lead'
      FROM (
        -- For each lead, find the earliest outbound message id where, at the
        -- time it was created, ≥3 AI messages already existed for that lead.
        SELECT DISTINCT ON (m2.lead_id) m2.id AS msg_id
        FROM messages m2
        WHERE m2.direction = 'outbound'
        AND (
          SELECT COUNT(*)
          FROM messages m3
          WHERE m3.lead_id    = m2.lead_id
            AND m3.ai_generated = TRUE
            AND m3.created_at  < m2.created_at
        ) >= 3
        ORDER BY m2.lead_id, m2.created_at ASC
      ) sub
      WHERE m.id = sub.msg_id
        AND m.scenario_type IS NULL
    `);
    console.log(`[Migrate] scenario_type=cold_lead: ${cl} messages`);

    // ── 4. Update action_required on leads ────────────────────────────────────
    const { rowCount: ar } = await client.query(`
      UPDATE leads
      SET action_required = CASE
        WHEN ai_follow_up_count >= 2
          AND status NOT IN ('booked','attended','lost','archived','qualified')
          AND ai_follow_up_enabled = TRUE
        THEN TRUE
        ELSE FALSE
      END
      WHERE deleted_at IS NULL
    `);
    console.log(`[Migrate] action_required updated on ${ar} leads`);

    // ── Summary ───────────────────────────────────────────────────────────────
    const { rows: scenarioStats } = await client.query(`
      SELECT scenario_type, COUNT(*) AS cnt
      FROM messages
      GROUP BY scenario_type
      ORDER BY cnt DESC
    `);
    console.log('[Migrate] scenario_type distribution:');
    for (const row of scenarioStats) {
      console.log(`  ${row.scenario_type ?? 'NULL'}: ${row.cnt}`);
    }

    const { rows: arStats } = await client.query(`
      SELECT action_required, COUNT(*) AS cnt
      FROM leads
      WHERE deleted_at IS NULL
      GROUP BY action_required
    `);
    console.log('[Migrate] action_required distribution:');
    for (const row of arStats) {
      console.log(`  action_required=${row.action_required}: ${row.cnt}`);
    }

    console.log('[Migrate] Done ✅');
  } catch (err) {
    console.error('[Migrate] Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('[Migrate] Fatal:', err.message);
  process.exit(1);
});

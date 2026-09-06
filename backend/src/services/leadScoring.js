/**
 * Lead Scoring AI service
 *
 * scoreLeadAsync(leadId, messages)  — fire-and-forget; never throws
 * scoreLead(leadId, messages)       — returns score object; throws on error
 * POST /api/leads/:id/score         — manual trigger endpoint helper
 */

const Anthropic          = require('@anthropic-ai/sdk');
const { pool }           = require('../db/index');
const { sendHotLeadAlert } = require('../utils/email');

const MODEL = 'claude-sonnet-4-5';

const SCORING_PROMPT = `Analyze this healthcare clinic WhatsApp conversation and score the lead.

Conversation:
{messages}

Patient info: {name}, language: {language}

Score on these dimensions (total 100):
- Intent (40pts): Did they mention a specific treatment? Ask about availability? Use booking language?
- Urgency (25pts): Pain/emergency mentioned? Specific timeframe? ASAP language?
- Value (25pts): Treatment scope and value relative to this clinic's typical case (use treatment_value_weight below, 0-25)? Multiple treatments?
- Engagement (10pts): Response speed, message count, detail level

treatment_value_weight: {treatmentValueWeight} (branch-specific 0-25 scale supplied by the clinic's branch template; use it directly as the Value sub-score baseline, then adjust for multiple treatments)

Return ONLY valid JSON (no markdown, no explanation):
{
  "score": <0-100>,
  "label": "<Hot|Warm|Cool|Ghost Risk>",
  "tags": ["<tag1>", "<tag2>"],
  "reasoning": "<one sentence explanation>"
}

Tags can include: treatment_serious, finance_likely, high_value, price_sensitive, urgent_care, comparing_options, ghost_risk, ready_to_book, cosmetic_interest, family_patient`;

// Branch-independent default when no branch template value is configured yet.
const DEFAULT_TREATMENT_VALUE_WEIGHT = 15;

/**
 * Format messages array into a readable conversation string.
 */
function formatMessages(messages) {
  if (!messages || messages.length === 0) return '(no messages yet)';
  return messages
    .slice(-20) // last 20 msgs to stay within token budget
    .map(m => `[${m.direction === 'inbound' ? 'Patient' : 'AI'}]: ${m.content}`)
    .join('\n');
}

/**
 * Core scoring logic — calls Claude, parses response, updates DB.
 * Throws on failure so callers can decide how to handle.
 */
async function scoreLead(leadId, messages) {
  // Fetch lead details + previous scoring state for hot-transition detection
  const { rows: leadRows } = await pool.query(
    `SELECT first_name, last_name, language, phone, tenant_id,
            score_label, hot_alert_sent_at, treatment_value_weight
     FROM leads WHERE id = $1`,
    [leadId],
  );
  if (!leadRows.length) throw new Error(`Lead ${leadId} not found`);

  const lead           = leadRows[0];
  const name           = `${lead.first_name} ${lead.last_name}`.trim() || 'Unknown';
  const language       = lead.language || 'en';
  const prevLabel      = lead.score_label       || null;
  const alreadyAlerted = !!lead.hot_alert_sent_at;
  const leadPhone      = lead.phone             || null;
  const tenantId       = lead.tenant_id;

  const prompt = SCORING_PROMPT
    .replace('{messages}', formatMessages(messages))
    .replace('{name}',     name)
    .replace('{language}', language)
    .replace('{treatmentValueWeight}', String(lead.treatment_value_weight ?? DEFAULT_TREATMENT_VALUE_WEIGHT));

  const client   = new Anthropic();
  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 256,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw  = response.content[0]?.text?.trim() || '';

  // Strip possible markdown fences
  const jsonStr = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  const parsed  = JSON.parse(jsonStr);

  const score     = Math.max(0, Math.min(100, parseInt(parsed.score, 10) || 0));
  const label     = parsed.label     || 'Cool';
  const tags      = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [];
  const reasoning = parsed.reasoning || '';

  // Persist to DB
  await pool.query(`
    UPDATE leads
    SET lead_score       = $2,
        score_label      = $3,
        score_tags       = $4,
        score_reasoning  = $5,
        score_updated_at = NOW(),
        updated_at       = NOW()
    WHERE id = $1
  `, [leadId, score, label, tags, reasoning]);

  console.log(`[LeadScore] lead=${leadId} score=${score} label=${label}`);

  // Hot-lead transition — fire-and-forget, never blocks scoring or webhook
  if (label === 'Hot' && prevLabel !== 'Hot' && !alreadyAlerted) {
    try {
      // Atomic stamp: only the first process to win this UPDATE sends the alert
      const stamp = await pool.query(
        `UPDATE leads SET hot_alert_sent_at = now()
         WHERE id = $1 AND hot_alert_sent_at IS NULL`,
        [leadId],
      );
      if (stamp.rowCount === 0) {
        // Another process already stamped — skip to avoid duplicate
        return { score, label, tags, reasoning };
      }

      // Fetch operasyon_muduru + klinik_sahibi + hasta_danismani emails for this tenant
      const staff = await pool.query(
        `SELECT u.email FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.tenant_id = $1
           AND u.deleted_at IS NULL
           AND r.name IN ('operasyon_muduru','klinik_sahibi','hasta_danismani')`,
        [tenantId],
      );
      const recipients = staff.rows.map(x => x.email).filter(Boolean);

      sendHotLeadAlert({ recipients, leadName: name, leadPhone, score, label, reasoning, leadId })
        .catch(err => console.error('[HotLead] alert failed:', err.message));
    } catch (err) {
      console.error('[HotLead] transition handling failed (non-fatal):', err.message);
    }
  }

  return { score, label, tags, reasoning };
}

/**
 * Fire-and-forget wrapper — safe to call in the middle of a WhatsApp pipeline.
 */
async function scoreLeadAsync(leadId, messages) {
  try {
    await scoreLead(leadId, messages);
  } catch (err) {
    console.error('[LeadScore] scoring failed (non-fatal):', err.message);
  }
}

module.exports = { scoreLead, scoreLeadAsync };

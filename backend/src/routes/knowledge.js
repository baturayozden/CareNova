/**
 * Knowledge Base + AI Settings routes
 *
 * GET    /api/clinics/:id/knowledge              — list all entries
 * POST   /api/clinics/:id/knowledge              — create entry
 * PUT    /api/clinics/:id/knowledge/:kid         — update entry
 * DELETE /api/clinics/:id/knowledge/:kid         — delete entry
 *
 * GET    /api/clinics/:id/ai-settings            — get AI settings
 * PUT    /api/clinics/:id/ai-settings            — upsert AI settings
 */

const express  = require('express');
const router   = express.Router({ mergeParams: true });   // inherits :id from parent
const { pool } = require('../db/index');
const { authenticate } = require('../middleware/auth');

const VALID_CATEGORIES = ['pricing','treatments','doctors','hours','location','policies','faq','consent','custom'];
const VALID_TONES      = ['professional','friendly','casual','formal'];

// All routes require auth
router.use(authenticate);

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapEntry(r) {
  return {
    id:        r.id,
    tenantId:  r.tenant_id,
    category:  r.category,
    title:     r.title,
    content:   r.content,
    isActive:  r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapSettings(r) {
  return {
    tenantId:            r.tenant_id,
    tone:                r.tone,
    languageMode:        r.language_mode,
    welcomeMessage:      r.welcome_message,
    outOfHoursMessage:   r.out_of_hours_message,
    escalationEnabled:   r.escalation_enabled,
    escalationKeywords:  r.escalation_keywords,
    alertPhone:          r.alert_phone || null,
    updatedAt:           r.updated_at,
  };
}

// ── Knowledge base CRUD ──────────────────────────────────────────────────────

// GET /api/clinics/:id/knowledge
router.get('/knowledge', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM clinic_knowledge WHERE tenant_id = $1 ORDER BY category, created_at`,
      [id],
    );
    return res.json({ entries: rows.map(mapEntry) });
  } catch (err) {
    console.error('[Knowledge] GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch knowledge base.' });
  }
});

// POST /api/clinics/:id/knowledge
router.post('/knowledge', async (req, res) => {
  const { id } = req.params;
  const { category, title, content, is_active = true } = req.body;

  if (!category || !VALID_CATEGORIES.includes(category))
    return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
  if (!title?.trim())   return res.status(400).json({ error: 'Title is required.' });
  if (!content?.trim()) return res.status(400).json({ error: 'Content is required.' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO clinic_knowledge (tenant_id, category, title, content, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, category, title.trim(), content.trim(), is_active],
    );
    return res.status(201).json({ entry: mapEntry(rows[0]) });
  } catch (err) {
    console.error('[Knowledge] POST error:', err.message);
    return res.status(500).json({ error: 'Failed to create knowledge entry.' });
  }
});

// PUT /api/clinics/:id/knowledge/:kid
router.put('/knowledge/:kid', async (req, res) => {
  const { id, kid } = req.params;
  const { category, title, content, is_active } = req.body;

  const fields = [];
  const values = [];
  let i = 1;

  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category))
      return res.status(400).json({ error: 'Invalid category.' });
    fields.push(`category = $${i++}`); values.push(category);
  }
  if (title   !== undefined) { fields.push(`title    = $${i++}`); values.push(title.trim()); }
  if (content !== undefined) { fields.push(`content  = $${i++}`); values.push(content.trim()); }
  if (is_active !== undefined) { fields.push(`is_active = $${i++}`); values.push(is_active); }

  if (!fields.length) return res.status(400).json({ error: 'Nothing to update.' });

  fields.push(`updated_at = now()`);
  values.push(id, kid);

  try {
    const { rows } = await pool.query(
      `UPDATE clinic_knowledge SET ${fields.join(', ')}
       WHERE tenant_id = $${i++} AND id = $${i++} RETURNING *`,
      values,
    );
    if (!rows.length) return res.status(404).json({ error: 'Entry not found.' });
    return res.json({ entry: mapEntry(rows[0]) });
  } catch (err) {
    console.error('[Knowledge] PUT error:', err.message);
    return res.status(500).json({ error: 'Failed to update entry.' });
  }
});

// DELETE /api/clinics/:id/knowledge/:kid
router.delete('/knowledge/:kid', async (req, res) => {
  const { id, kid } = req.params;
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM clinic_knowledge WHERE tenant_id = $1 AND id = $2`,
      [id, kid],
    );
    if (!rowCount) return res.status(404).json({ error: 'Entry not found.' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[Knowledge] DELETE error:', err.message);
    return res.status(500).json({ error: 'Failed to delete entry.' });
  }
});

// ── AI Settings ──────────────────────────────────────────────────────────────

// GET /api/clinics/:id/ai-settings
router.get('/ai-settings', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM clinic_ai_settings WHERE tenant_id = $1`, [id],
    );
    if (!rows.length) {
      // Return safe defaults if row doesn't exist yet
      return res.json({
        settings: {
          tenantId:           id,
          tone:               'professional',
          languageMode:       'auto',
          welcomeMessage:     null,
          outOfHoursMessage:  null,
          escalationEnabled:  true,
          escalationKeywords: ['urgent','pain','emergency','bleeding','swelling','broken'],
          alertPhone:         null,
          updatedAt:          null,
        },
      });
    }
    return res.json({ settings: mapSettings(rows[0]) });
  } catch (err) {
    console.error('[AiSettings] GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch AI settings.' });
  }
});

// PUT /api/clinics/:id/ai-settings
router.put('/ai-settings', async (req, res) => {
  const { id } = req.params;
  const {
    tone, language_mode, welcome_message, out_of_hours_message,
    escalation_enabled, escalation_keywords, alert_phone,
  } = req.body;

  if (tone && !VALID_TONES.includes(tone))
    return res.status(400).json({ error: `Invalid tone. Must be: ${VALID_TONES.join(', ')}` });

  try {
    const { rows } = await pool.query(
      `INSERT INTO clinic_ai_settings
         (tenant_id, tone, language_mode, welcome_message, out_of_hours_message,
          escalation_enabled, escalation_keywords, alert_phone, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (tenant_id) DO UPDATE SET
         tone                 = COALESCE($2,               clinic_ai_settings.tone),
         language_mode        = COALESCE($3,               clinic_ai_settings.language_mode),
         welcome_message      = COALESCE($4,               clinic_ai_settings.welcome_message),
         out_of_hours_message = COALESCE($5,               clinic_ai_settings.out_of_hours_message),
         escalation_enabled   = COALESCE($6,               clinic_ai_settings.escalation_enabled),
         escalation_keywords  = COALESCE($7,               clinic_ai_settings.escalation_keywords),
         alert_phone          = $8,
         updated_at           = now()
       RETURNING *`,
      [
        id,
        tone               || null,
        language_mode      || null,
        welcome_message    ?? null,
        out_of_hours_message ?? null,
        escalation_enabled ?? null,
        escalation_keywords ? escalation_keywords : null,
        alert_phone        ?? null,
      ],
    );
    return res.json({ settings: mapSettings(rows[0]) });
  } catch (err) {
    console.error('[AiSettings] PUT error:', err.message);
    return res.status(500).json({ error: 'Failed to save AI settings.' });
  }
});

module.exports = router;

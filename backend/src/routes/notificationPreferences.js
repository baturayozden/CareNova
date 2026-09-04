'use strict';

/**
 * Notification Preferences routes
 *
 * GET /api/notification-preferences   — full list (6 events), missing rows → default enabled:true
 * PUT /api/notification-preferences   — upsert all preferences
 *
 * Design: opt-out model — a missing row means the event/channel is ENABLED.
 * Only when a user explicitly disables something is a row written (enabled=false).
 */

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/index');

// ── Canonical event types ─────────────────────────────────────────────────────
const EVENT_TYPES = [
  'new_lead',
  'lead_booked',
  'appointment_reminder',
  'urgent_escalation',
  'no_show',
  'ai_quota_warning',
];

const ALLOWED_CHANNELS = ['email'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a full 6-item list merging DB rows with defaults. */
function mergeWithDefaults(dbRows, channel = 'email') {
  const map = new Map(dbRows.map(r => [r.event_type, r.enabled]));
  return EVENT_TYPES.map(event_type => ({
    eventType: event_type,
    channel,
    enabled:   map.has(event_type) ? map.get(event_type) : true,
  }));
}

// ── GET /api/notification-preferences ────────────────────────────────────────
router.get('/', async (req, res) => {
  const userId = req.user.sub;
  try {
    const { rows } = await pool.query(
      `SELECT event_type, channel, enabled
         FROM notification_preferences
        WHERE user_id = $1 AND channel = 'email'`,
      [userId],
    );
    return res.json({ preferences: mergeWithDefaults(rows) });
  } catch (err) {
    console.error('[NotifPrefs] GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch notification preferences.' });
  }
});

// ── PUT /api/notification-preferences ────────────────────────────────────────
router.put('/', async (req, res) => {
  const userId = req.user.sub;
  const { preferences } = req.body ?? {};

  if (!Array.isArray(preferences) || preferences.length === 0) {
    return res.status(400).json({ error: 'preferences array is required.' });
  }

  // Filter to known event types + allowed channels only
  const valid = preferences.filter(
    p => EVENT_TYPES.includes(p.eventType) && ALLOWED_CHANNELS.includes(p.channel ?? 'email'),
  );

  if (valid.length === 0) {
    return res.status(400).json({ error: 'No valid preferences provided.' });
  }

  try {
    await Promise.all(valid.map(p =>
      pool.query(
        `INSERT INTO notification_preferences (user_id, event_type, channel, enabled)
              VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, event_type, channel)
         DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
        [userId, p.eventType, p.channel ?? 'email', p.enabled !== false],
      ),
    ));

    // Return fresh full list
    const { rows } = await pool.query(
      `SELECT event_type, channel, enabled
         FROM notification_preferences
        WHERE user_id = $1 AND channel = 'email'`,
      [userId],
    );
    return res.json({ preferences: mergeWithDefaults(rows) });
  } catch (err) {
    console.error('[NotifPrefs] PUT error:', err.message);
    return res.status(500).json({ error: 'Failed to update notification preferences.' });
  }
});

module.exports = router;
module.exports.EVENT_TYPES = EVENT_TYPES;

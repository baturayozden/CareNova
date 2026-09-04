'use strict';

/**
 * shouldNotify(userId, eventType, channel='email') → boolean
 *
 * Opt-out model: if no row exists for (user, event, channel), return true (default enabled).
 * On any DB error, return true (fail-open — better to send than to silently drop).
 */

const { pool } = require('../db/index');

async function shouldNotify(userId, eventType, channel = 'email') {
  try {
    const { rows } = await pool.query(
      `SELECT enabled FROM notification_preferences
        WHERE user_id = $1 AND event_type = $2 AND channel = $3
        LIMIT 1`,
      [userId, eventType, channel],
    );
    if (rows.length === 0) return true;   // no row = default enabled
    return rows[0].enabled;
  } catch (err) {
    console.error('[shouldNotify] DB error — defaulting to true:', err.message);
    return true;  // fail-open
  }
}

module.exports = { shouldNotify };

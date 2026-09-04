/**
 * Notifications routes
 *
 * GET   /api/notifications          — list unread (or recent) notifications for current tenant
 * POST  /api/notifications          — create a notification (internal use + webhook)
 * PATCH /api/notifications/:id/read — mark one as read
 * PATCH /api/notifications/read-all — mark all as read
 */

const express  = require('express');
const router   = express.Router();
const { pool } = require('../db/index');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

function mapNote(r) {
  return {
    id:        r.id,
    tenantId:  r.tenant_id,
    type:      r.type,
    title:     r.title,
    message:   r.message,
    link:      r.link,
    read:      r.read,
    createdAt: r.created_at,
  };
}

// GET /api/notifications?unread_only=true&limit=20
router.get('/', async (req, res) => {
  const { unread_only = 'false', limit = '20' } = req.query;
  const tenantId = req.user.tenantId;   // null for super_admin → fetch all

  let query = `SELECT * FROM notifications`;
  const params = [];
  let i = 1;

  if (tenantId) {
    query += ` WHERE tenant_id = $${i++}`;
    params.push(tenantId);
    if (unread_only === 'true') {
      query += ` AND read = FALSE`;
    }
  } else {
    // super_admin / admin — see all
    if (unread_only === 'true') {
      query += ` WHERE read = FALSE`;
    }
  }

  query += ` ORDER BY created_at DESC LIMIT $${i++}`;
  params.push(Math.min(parseInt(limit, 10) || 20, 100));

  try {
    const { rows } = await pool.query(query, params);
    // Also return unread count
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM notifications WHERE ${tenantId ? 'tenant_id = $1 AND ' : ''}read = FALSE`,
      tenantId ? [tenantId] : [],
    );
    return res.json({
      notifications: rows.map(mapNote),
      unreadCount:   parseInt(countRows[0]?.cnt || 0, 10),
    });
  } catch (err) {
    console.error('[Notifications] GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

// POST /api/notifications  — create
router.post('/', async (req, res) => {
  const { tenant_id, type, title, message, link } = req.body;
  if (!type || !title || !message) return res.status(400).json({ error: 'type, title, message required.' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications (tenant_id, type, title, message, link)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenant_id || null, type, title, message, link || null],
    );
    return res.status(201).json({ notification: mapNote(rows[0]) });
  } catch (err) {
    console.error('[Notifications] POST error:', err.message);
    return res.status(500).json({ error: 'Failed to create notification.' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    await pool.query(
      `UPDATE notifications SET read = TRUE WHERE ${tenantId ? 'tenant_id = $1 AND ' : ''}read = FALSE`,
      tenantId ? [tenantId] : [],
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] PATCH read-all error:', err.message);
    return res.status(500).json({ error: 'Failed.' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE notifications SET read = TRUE WHERE id = $1 RETURNING *`, [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found.' });
    return res.json({ notification: mapNote(rows[0]) });
  } catch (err) {
    console.error('[Notifications] PATCH read error:', err.message);
    return res.status(500).json({ error: 'Failed.' });
  }
});

module.exports = router;

// ── Helper: create notification from other routes ─────────────────────────────

/**
 * createNotification({ tenantId, type, title, message, link })
 * Fire-and-forget helper for other routes to call.
 */
async function createNotification({ tenantId, type, title, message, link }) {
  try {
    await pool.query(
      `INSERT INTO notifications (tenant_id, type, title, message, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId || null, type, title, message, link || null],
    );
  } catch (err) {
    console.error('[Notifications] createNotification error:', err.message);
  }
}

module.exports.createNotification = createNotification;

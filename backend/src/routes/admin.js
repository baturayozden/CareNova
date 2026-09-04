'use strict';

/**
 * Platform admin management (super_admin only)
 *
 * GET    /api/admin/platform-users              — list super_admin + admin users
 * POST   /api/admin/platform-users              — create super_admin or admin user
 * PATCH  /api/admin/platform-users/:id/deactivate
 * DELETE /api/admin/platform-users/:id
 *
 * Legacy aliases kept for backwards-compat:
 * GET  /api/admin/super-admins  → same as platform-users
 * POST /api/admin/super-admins  → creates super_admin role specifically
 *
 * Platform users = users rows where tenant_id IS NULL.
 * Role IDs are resolved dynamically from the roles table — never hardcoded.
 */

const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const { pool } = require('../db/index');
const { requireRole } = require('../middleware/auth');

// All routes: super_admin only
router.use(...requireRole('super_admin'));

const PLATFORM_ROLES = ['super_admin', 'admin'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map a DB row (snake_case + role from JOIN) to the safe API shape. */
function safeUser(row) {
  return {
    id:        row.id,
    email:     row.email,
    firstName: row.first_name,
    lastName:  row.last_name,
    role:      row.role,       // roles.name from JOIN
    isActive:  row.is_active,
    tenantId:  row.tenant_id ?? null,
    createdAt: row.created_at,
  };
}

/** Resolve a role name → id from the DB. Throws if name not found. */
async function getRoleId(name) {
  const { rows } = await pool.query('SELECT id FROM roles WHERE name = $1', [name]);
  if (!rows.length) throw new Error(`Role '${name}' not found in roles table`);
  return rows[0].id;
}

// ── Shared create logic ───────────────────────────────────────────────────────

async function createPlatformUser(req, res, roleOverride) {
  const { email, firstName, lastName, password, role } = req.body;
  const targetRole = roleOverride || role || 'admin';

  if (!PLATFORM_ROLES.includes(targetRole)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${PLATFORM_ROLES.join(', ')}` });
  }
  if (!email?.trim())    return res.status(400).json({ error: 'Email required.' });
  if (!firstName?.trim()) return res.status(400).json({ error: 'First name required.' });
  if (!lastName?.trim())  return res.status(400).json({ error: 'Last name required.' });
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    // Platform-user uniqueness: same email + tenant_id IS NULL must not exist
    const { rows: existing } = await pool.query(
      `SELECT id FROM users
        WHERE email = $1 AND tenant_id IS NULL AND deleted_at IS NULL`,
      [email.toLowerCase().trim()],
    );
    if (existing.length) {
      return res.status(409).json({ error: 'Email already registered as a platform user.' });
    }

    const roleId = await getRoleId(targetRole);
    const hash   = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users
         (tenant_id, role_id, email, password_hash, first_name, last_name, is_active)
       VALUES (NULL, $1, $2, $3, $4, $5, TRUE)
       RETURNING *`,
      [roleId, email.toLowerCase().trim(), hash, firstName.trim(), lastName.trim()],
    );

    const newUser = { ...rows[0], role: targetRole };
    return res.status(201).json({ user: safeUser(newUser) });
  } catch (err) {
    console.error('[Admin] create platform user error:', err.message);
    return res.status(500).json({ error: 'Failed to create user.' });
  }
}

// ── GET /api/admin/platform-users ─────────────────────────────────────────────
router.get('/platform-users', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.*, r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE u.tenant_id IS NULL
          AND u.deleted_at IS NULL
        ORDER BY u.created_at`,
    );
    return res.json({ users: rows.map(safeUser) });
  } catch (err) {
    console.error('[Admin] list platform users error:', err.message);
    return res.status(500).json({ error: 'Failed to list platform users.' });
  }
});

// ── POST /api/admin/platform-users ────────────────────────────────────────────
router.post('/platform-users', (req, res) => createPlatformUser(req, res, null));

// ── PATCH /api/admin/platform-users/:id/deactivate ───────────────────────────
router.patch('/platform-users/:id/deactivate', async (req, res) => {
  const { id } = req.params;

  if (id === req.user.sub) {
    return res.status(400).json({ error: 'Cannot deactivate your own account.' });
  }

  try {
    const { rows } = await pool.query(
      `WITH updated AS (
         UPDATE users SET is_active = FALSE, updated_at = NOW()
          WHERE id = $1 AND tenant_id IS NULL AND deleted_at IS NULL
         RETURNING *
       )
       SELECT u.*, r.name AS role FROM updated u JOIN roles r ON r.id = u.role_id`,
      [id],
    );

    if (!rows.length) return res.status(404).json({ error: 'Platform user not found.' });
    return res.json({ user: safeUser(rows[0]) });
  } catch (err) {
    console.error('[Admin] deactivate error:', err.message);
    return res.status(500).json({ error: 'Failed to deactivate user.' });
  }
});

// ── DELETE /api/admin/platform-users/:id ─────────────────────────────────────
router.delete('/platform-users/:id', async (req, res) => {
  const { id } = req.params;

  if (id === req.user.sub) {
    return res.status(400).json({ error: 'Cannot remove your own account.' });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE users
          SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
        WHERE id = $1 AND tenant_id IS NULL AND deleted_at IS NULL`,
      [id],
    );

    if (!rowCount) return res.status(404).json({ error: 'Platform user not found.' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[Admin] delete error:', err.message);
    return res.status(500).json({ error: 'Failed to remove user.' });
  }
});

// ── Legacy aliases ─────────────────────────────────────────────────────────────
router.get('/super-admins',  (req, res) => res.redirect(307, '/api/admin/platform-users'));
router.post('/super-admins', (req, res) => createPlatformUser(req, res, 'super_admin'));

module.exports = router;

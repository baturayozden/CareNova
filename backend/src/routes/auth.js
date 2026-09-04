'use strict';

const crypto  = require('crypto');
const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();

const { pool }   = require('../db/index');
const {
  generateAccessToken,
  generateRefreshToken,
  isValidRefreshToken,
  revokeRefreshToken,
  generateSelectionToken,
  verifySelectionToken,
} = require('../utils/tokens');
const { authenticate }           = require('../middleware/auth');
const { sendForgotPasswordEmail } = require('../utils/email');

// ── Cookie options ────────────────────────────────────────────────────────────
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  secure:   process.env.NODE_ENV === 'production',
  ...(process.env.NODE_ENV === 'production' ? { domain: '.carenova.ai' } : {}),
};

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken',  accessToken,  { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

// ── DB helpers ────────────────────────────────────────────────────────────────

/** Fetch a full user row (with role name) by email. Returns null if not found. */
async function findUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT u.*, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.email = $1
        AND u.deleted_at IS NULL`,
    [email.toLowerCase().trim()],
  );
  return rows[0] ?? null;
}

/** Fetch a full user row (with role name) by UUID. Returns null if not found. */
async function findUserById(id) {
  const { rows } = await pool.query(
    `SELECT u.*, r.name AS role,
            COALESCE(tbp.finance_enabled, TRUE) AS finance_enabled
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN tenant_billing_profiles tbp ON tbp.tenant_id = u.tenant_id
      WHERE u.id = $1
        AND u.deleted_at IS NULL`,
    [id],
  );
  return rows[0] ?? null;
}

/** Issue a new access + refresh token pair with explicit tenant context.
 *  tenantId and role come from the caller (user_tenants lookup), NOT from
 *  users.tenant_id, so multi-tenant users always get the correct active tenant. */
function buildTokenPair(userId, email, tenantId, role) {
  const accessToken  = generateAccessToken({ id: userId, email, role, tenantId });
  const refreshToken = generateRefreshToken();
  return { accessToken, refreshToken };
}

/** Strip sensitive fields; return camelCase shape expected by frontend. */
function safeUser(row) {
  return {
    id:             row.id,
    email:          row.email,
    firstName:      row.first_name,
    lastName:       row.last_name,
    role:           row.role,
    tenantId:       row.tenant_id ?? null,
    isActive:       row.is_active,
    phone:          row.phone          ?? null,
    avatarUrl:      row.avatar_url     ?? null,
    financeEnabled: row.finance_enabled !== false,
  };
}

// ── POST /auth/register — DISABLED ────────────────────────────────────────────
// Self-registration is closed. Staff are added by clinic admins via the
// clinic staff management UI (POST /api/clinics/:id/staff). Platform users
// are created by super_admins via POST /api/admin/platform-users.
router.post('/register', (_req, res) => {
  return res.status(410).json({
    error: 'Self-registration is disabled. Contact your clinic administrator to be added as a staff member.',
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing required fields: email, password' });
  }

  try {
    const user = await findUserByEmail(email);

    // Return the same error for "not found" and "wrong password" to avoid
    // leaking account existence information.
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled. Contact your administrator.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // ── Resolve active tenant via user_tenants (Faz 1a) ─────────────────────
    const { rows: utRows } = await pool.query(
      `SELECT ut.tenant_id, r.name AS role, t.name AS tenant_name
         FROM user_tenants ut
         JOIN tenants t ON t.id = ut.tenant_id AND t.deleted_at IS NULL AND t.status = 'active'
         JOIN roles   r ON r.id = ut.role_id
        WHERE ut.user_id = $1`,
      [user.id],
    );

    let finalTenantId, finalRole;

    if (utRows.length > 1) {
      // Multi-tenant user: can't pick a tenant automatically — ask the client to select.
      // Issue a short-lived selection token (5 min) carrying only the user identity.
      // No cookies/tokens are set at this point.
      const selectionToken = generateSelectionToken(user.id);
      return res.json({
        needsTenantSelection: true,
        selectionToken,
        tenants: utRows.map(r => ({
          tenantId:   r.tenant_id,
          tenantName: r.tenant_name,
          role:       r.role,
        })),
      });
    } else if (utRows.length === 1) {
      finalTenantId = utRows[0].tenant_id;
      finalRole     = utRows[0].role;
    } else {
      // Fallback: user not yet in user_tenants (pre-migration / platform admin).
      // Use users.tenant_id + role from the users JOIN roles query.
      finalTenantId = user.tenant_id ?? null;
      finalRole     = user.role;
    }

    // Update last login timestamp — fire-and-forget, never blocks response
    pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id])
      .catch(err => console.error('[Auth] last_login_at update failed:', err.message));

    const { accessToken, refreshToken } = buildTokenPair(user.id, user.email, finalTenantId, finalRole);
    setAuthCookies(res, accessToken, refreshToken);

    return res.json({ user: safeUser(user), accessToken, refreshToken });
  } catch (err) {
    console.error('[Auth] login error:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── POST /auth/select-tenant (PUBLIC — guarded by selection token) ───────────
// Called by the frontend when /auth/login returns needsTenantSelection: true.
// Body: { selectionToken, tenantId }
// Returns the same shape as a normal login (user + tokens + cookies).

router.post('/select-tenant', async (req, res) => {
  const { selectionToken, tenantId } = req.body ?? {};

  if (!selectionToken || !tenantId) {
    return res.status(400).json({ error: 'selectionToken and tenantId are required.' });
  }

  let userId;
  try {
    const payload = verifySelectionToken(selectionToken);
    userId = payload.sub;
  } catch {
    return res.status(401).json({ error: 'Invalid or expired selection token.' });
  }

  try {
    // CRITICAL: verify the user actually belongs to the requested tenant.
    const { rows: utRows } = await pool.query(
      `SELECT r.name AS role
         FROM user_tenants ut
         JOIN roles r ON r.id = ut.role_id
        WHERE ut.user_id = $1 AND ut.tenant_id = $2`,
      [userId, tenantId],
    );

    if (!utRows.length) {
      return res.status(403).json({ error: 'Access denied to that tenant.' });
    }

    const user = await findUserById(userId);
    if (!user || !user.is_active) {
      return res.status(403).json({ error: 'Account is disabled. Contact your administrator.' });
    }

    pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id])
      .catch(err => console.error('[Auth] last_login_at update failed:', err.message));

    const { accessToken, refreshToken } = buildTokenPair(user.id, user.email, tenantId, utRows[0].role);
    setAuthCookies(res, accessToken, refreshToken);

    return res.json({ user: safeUser(user), accessToken, refreshToken });
  } catch (err) {
    console.error('[Auth] select-tenant error:', err.message);
    return res.status(500).json({ error: 'Tenant selection failed. Please try again.' });
  }
});

// ── GET /auth/my-tenants (AUTHENTICATED) ─────────────────────────────────────
// Returns all tenants the current user belongs to (for the clinic switcher).

router.get('/my-tenants', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ut.tenant_id, t.name AS tenant_name, r.name AS role
         FROM user_tenants ut
         JOIN tenants t ON t.id = ut.tenant_id AND t.deleted_at IS NULL AND t.status = 'active'
         JOIN roles   r ON r.id = ut.role_id
        WHERE ut.user_id = $1
        ORDER BY t.name`,
      [req.user.sub],
    );
    return res.json({
      tenants: rows.map(r => ({ tenantId: r.tenant_id, tenantName: r.tenant_name, role: r.role })),
    });
  } catch (err) {
    console.error('[Auth] my-tenants error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch tenant list.' });
  }
});

// ── POST /auth/switch-tenant (AUTHENTICATED) ──────────────────────────────────
// Switch the active tenant for an already-logged-in user.
// Membership is verified against user_tenants before issuing new tokens.

router.post('/switch-tenant', authenticate, async (req, res) => {
  const { tenantId } = req.body ?? {};
  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId is required.' });
  }

  const userId = req.user.sub;

  try {
    // CRITICAL: verify the user actually belongs to the requested tenant.
    const { rows: utRows } = await pool.query(
      `SELECT r.name AS role
         FROM user_tenants ut
         JOIN roles r ON r.id = ut.role_id
        WHERE ut.user_id = $1 AND ut.tenant_id = $2`,
      [userId, tenantId],
    );

    if (!utRows.length) {
      return res.status(403).json({ error: 'Access denied to that tenant.' });
    }

    const user = await findUserById(userId);
    if (!user || !user.is_active) {
      return res.status(403).json({ error: 'Account is disabled.' });
    }

    const { accessToken, refreshToken } = buildTokenPair(user.id, user.email, tenantId, utRows[0].role);
    setAuthCookies(res, accessToken, refreshToken);

    console.log(`[Auth] switch-tenant user=${userId} → tenant=${tenantId} role=${utRows[0].role}`);
    return res.json({ user: safeUser(user), accessToken, refreshToken });
  } catch (err) {
    console.error('[Auth] switch-tenant error:', err.message);
    return res.status(500).json({ error: 'Failed to switch tenant.' });
  }
});

// ── POST /auth/forgot-password (PUBLIC) ──────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body ?? {};
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const APP_URL       = process.env.APP_URL || 'https://app.carenova.ai';
  const SAFE_RESPONSE = { message: 'If an account exists for that email, a reset link has been sent.' };

  try {
    const { rows } = await pool.query(
      `SELECT id, email, first_name FROM users
       WHERE LOWER(email) = LOWER($1) AND is_active = TRUE AND deleted_at IS NULL`,
      [String(email).trim()],
    );
    const user = rows[0];

    if (user) {
      const rawToken  = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await pool.query(
        `UPDATE users
            SET reset_token_hash       = $1,
                reset_token_expires_at = NOW() + INTERVAL '1 hour'
          WHERE id = $2`,
        [tokenHash, user.id],
      );

      const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;
      sendForgotPasswordEmail({ to: user.email, resetUrl, firstName: user.first_name })
        .catch(err => console.error('[ForgotPassword] email failed:', err.message));
    }

    return res.json(SAFE_RESPONSE);
  } catch (err) {
    console.error('[Auth] forgot-password error:', err.message);
    return res.json(SAFE_RESPONSE); // never leak user existence on error
  }
});

// ── POST /auth/reset-password (PUBLIC) ───────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body ?? {};

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { rows } = await pool.query(
      `SELECT id FROM users
       WHERE reset_token_hash       = $1
         AND reset_token_expires_at > NOW()
         AND is_active = TRUE
         AND deleted_at IS NULL`,
      [tokenHash],
    );

    if (!rows[0]) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE users
          SET password_hash          = $1,
              reset_token_hash       = NULL,
              reset_token_expires_at = NULL,
              updated_at             = NOW()
        WHERE id = $2`,
      [newHash, rows[0].id],
    );

    return res.json({ message: 'Your password has been updated. You can now log in.' });
  } catch (err) {
    console.error('[Auth] reset-password error:', err.message);
    return res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', authenticate, (req, res) => {
  const refreshToken = req.body?.refreshToken ?? req.cookies?.refreshToken;
  if (refreshToken) revokeRefreshToken(refreshToken);

  res.clearCookie('accessToken',  COOKIE_OPTIONS);
  res.clearCookie('refreshToken', COOKIE_OPTIONS);

  return res.json({ message: 'Logged out' });
});

// ── POST /auth/refresh ────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const refreshToken    = req.body?.refreshToken ?? req.cookies?.refreshToken;
  const expiredAccToken = req.body?.accessToken  ?? req.cookies?.accessToken;

  if (!refreshToken || !isValidRefreshToken(refreshToken)) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  if (!expiredAccToken) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  let userId, activeTenantId, activeRole;
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(expiredAccToken); // decode without verify (may be expired)
    userId        = decoded?.sub;
    activeTenantId = decoded?.tenantId ?? null;  // preserve active tenant from the expired token
    activeRole     = decoded?.role     ?? null;
  } catch {
    return res.status(401).json({ error: 'Invalid access token' });
  }

  if (!userId) return res.status(401).json({ error: 'Could not identify user' });

  try {
    const user = await findUserById(userId);

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Rotate refresh token; re-issue with the same active tenant context.
    revokeRefreshToken(refreshToken);
    const { accessToken: newAccess, refreshToken: newRefresh } = buildTokenPair(
      user.id,
      user.email,
      activeTenantId ?? user.tenant_id,  // fallback to users.tenant_id if legacy token
      activeRole     ?? user.role,
    );
    setAuthCookies(res, newAccess, newRefresh);

    return res.json({ user: safeUser(user), accessToken: newAccess, refreshToken: newRefresh });
  } catch (err) {
    console.error('[Auth] refresh error:', err.message);
    return res.status(500).json({ error: 'Token refresh failed.' });
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await findUserById(req.user.sub);

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found' });
    }

    // JWT tenantId = the active tenant chosen at login / switch-tenant.
    // users.tenant_id (from safeUser) may be null for multi-tenant users —
    // override with the JWT value so the frontend always sees the correct tenant.
    const safe = safeUser(user);
    safe.tenantId = req.user.tenantId ?? safe.tenantId;
    return res.json({ user: safe });
  } catch (err) {
    console.error('[Auth] /me error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// ── PATCH /auth/profile — update own profile ──────────────────────────────────
// Allowed fields: first_name, last_name, phone, avatar_url only.
// email / role_id / tenant_id / is_active are silently ignored.
router.patch('/profile', authenticate, async (req, res) => {
  const ALLOWED = ['first_name', 'last_name', 'phone', 'avatar_url'];
  const body = req.body ?? {};

  // Map camelCase input → snake_case DB columns
  const camelToSnake = { firstName: 'first_name', lastName: 'last_name', phone: 'phone', avatarUrl: 'avatar_url' };
  const updates = {};
  for (const [camel, snake] of Object.entries(camelToSnake)) {
    if (body[camel] !== undefined) updates[snake] = body[camel];
    if (body[snake] !== undefined) updates[snake] = body[snake]; // accept snake_case too
  }

  // Only keep allowed columns (double-guard)
  for (const key of Object.keys(updates)) {
    if (!ALLOWED.includes(key)) delete updates[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided. Allowed: firstName, lastName, phone, avatarUrl.' });
  }

  try {
    const setClauses = Object.keys(updates).map((col, i) => `${col} = $${i + 1}`);
    const values     = Object.values(updates);
    values.push(req.user.sub); // last param = WHERE id = $N

    const { rows } = await pool.query(
      `UPDATE users
          SET ${setClauses.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length}
          AND deleted_at IS NULL
      RETURNING id, email, first_name, last_name, phone, avatar_url, is_active, tenant_id,
                (SELECT r.name FROM roles r WHERE r.id = users.role_id) AS role`,
      values,
    );

    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: safeUser(rows[0]) });
  } catch (err) {
    console.error('[Auth] PATCH /profile error:', err.message);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ── POST /auth/profile/change-password ────────────────────────────────────────
router.post('/profile/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.user.sub],
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.sub],
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[Auth] change-password error:', err.message);
    return res.status(500).json({ error: 'Failed to change password.' });
  }
});

module.exports = router;

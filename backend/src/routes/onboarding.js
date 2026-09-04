/**
 * Onboarding routes
 *
 * GET    /api/onboarding   — fetch tenant onboarding state
 * PATCH  /api/onboarding   — update onboarding_status and/or notification_email
 *
 * Platform admins (tenantId = null) must pass ?tenantId= or body.tenantId.
 * All other roles are scoped to req.user.tenantId automatically.
 */

const express        = require('express');
const router         = express.Router();
const { pool }       = require('../db/index');
const { requireRole } = require('../middleware/auth');

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapTenant(r) {
  return {
    onboardingStatus:  r.onboarding_status,
    notificationEmail: r.notification_email,
    activated:         r.activated,
    activatedAt:       r.activated_at,
    firstBookingAt:    r.first_booking_at,
  };
}

/**
 * Resolve the effective tenantId for the request.
 * Platform admins supply it via query or body; everyone else uses their own.
 */
function resolveTenant(req) {
  const isPlatformAdmin = !req.user.tenantId;
  if (isPlatformAdmin) {
    const tid = req.query.tenantId || (req.body && req.body.tenantId);
    if (!tid) return null;
    return tid;
  }
  return req.user.tenantId;
}

// ── GET /api/onboarding ───────────────────────────────────────────────────────

router.get(
  '/',
  ...requireRole('director', 'clinic_admin', 'clinic_owner', 'super_admin', 'admin'),
  async (req, res) => {
    const tenantId = resolveTenant(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for platform admin requests.' });
    }

    try {
      const { rows } = await pool.query(
        `SELECT onboarding_status, notification_email, activated, activated_at, first_booking_at
         FROM tenants WHERE id = $1`,
        [tenantId],
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Tenant not found.' });
      }

      return res.json(mapTenant(rows[0]));
    } catch (err) {
      console.error('[Onboarding] GET error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch onboarding status.' });
    }
  },
);

// ── PATCH /api/onboarding ─────────────────────────────────────────────────────

router.patch(
  '/',
  ...requireRole('director', 'clinic_admin', 'clinic_owner', 'super_admin', 'admin'),
  async (req, res) => {
    const tenantId = resolveTenant(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required for platform admin requests.' });
    }

    const { onboardingStatus, notificationEmail } = req.body;

    // Must have at least one field to update
    if (onboardingStatus === undefined && notificationEmail === undefined) {
      return res.status(400).json({ error: 'Provide at least one of: onboardingStatus, notificationEmail.' });
    }

    // Validate email format if provided
    if (notificationEmail !== undefined && notificationEmail !== null) {
      if (typeof notificationEmail !== 'string' || !notificationEmail.includes('@')) {
        return res.status(400).json({ error: 'notificationEmail must be a valid email address.' });
      }
    }

    // Build dynamic SET clause
    const setClauses = ['updated_at = now()'];
    const params     = [tenantId];

    if (onboardingStatus !== undefined) {
      params.push(JSON.stringify(onboardingStatus));
      setClauses.push(`onboarding_status = $${params.length}::jsonb`);
    }

    if (notificationEmail !== undefined) {
      params.push(notificationEmail);
      setClauses.push(`notification_email = $${params.length}`);
    }

    try {
      const { rows } = await pool.query(
        `UPDATE tenants
         SET ${setClauses.join(', ')}
         WHERE id = $1
         RETURNING onboarding_status, notification_email, activated, activated_at, first_booking_at`,
        params,
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Tenant not found.' });
      }

      return res.json(mapTenant(rows[0]));
    } catch (err) {
      console.error('[Onboarding] PATCH error:', err.message);
      return res.status(500).json({ error: 'Failed to update onboarding status.' });
    }
  },
);

module.exports = router;

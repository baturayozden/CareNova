const { pool } = require('../db');
const { HASTA_DANISMANI } = require('./roles');

// GECE-3-BRIEFI.md Bölüm E: this used to distinguish 'treatment_coordinator'
// from 'sales' (isTC/isSales, two separate helpers) — CareNova's role
// model (M8) has no such split, both collapse into `hasta_danismani`
// ("kendi vakaları" — own cases only). Callers that used to write
// `isTC(user) || isSales(user)` now just call this once. The one call site
// that checked `isTC(user)` ALONE (commissions.js's "TC can only edit
// their own deals", NOT applied to 'sales') is now applied to every
// hasta_danismani — see GECE-LOG.md Bölüm E for why: 'sales' was never
// actually seeded as a real role anywhere in this codebase's migration
// history, so that asymmetry was very likely unexercised dead-path
// behavior, not a deliberate product decision to preserve.
function isHastaDanismani(user) {
  return user.role === HASTA_DANISMANI;
}

/**
 * Returns true if staffId is an active hasta_danismani user in the given
 * tenant. Used by both commissions.js and cases.js to validate
 * assignedStaffId.
 */
async function validateAssignableStaff(staffId, tenantId) {
  const { rows } = await pool.query(
    `SELECT ut.user_id
       FROM user_tenants ut
       JOIN roles r ON r.id = ut.role_id
       JOIN users u ON u.id = ut.user_id
      WHERE ut.user_id = $1 AND ut.tenant_id = $2
        AND r.name = $3
        AND u.is_active = TRUE AND u.deleted_at IS NULL`,
    [staffId, tenantId, HASTA_DANISMANI],
  );
  return rows.length > 0;
}

module.exports = { isHastaDanismani, validateAssignableStaff };

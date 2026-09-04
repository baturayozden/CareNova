const { pool } = require('../db');

function isTC(user) {
  return user.role === 'treatment_coordinator';
}

function isSales(user) {
  return user.role === 'sales';
}

/**
 * Returns true if staffId is an active TC or sales user in the given tenant.
 * Used by both commissions.js and cases.js to validate assignedStaffId.
 */
async function validateAssignableStaff(staffId, tenantId) {
  const { rows } = await pool.query(
    `SELECT ut.user_id
       FROM user_tenants ut
       JOIN roles r ON r.id = ut.role_id
       JOIN users u ON u.id = ut.user_id
      WHERE ut.user_id = $1 AND ut.tenant_id = $2
        AND r.name = ANY($3)
        AND u.is_active = TRUE AND u.deleted_at IS NULL`,
    [staffId, tenantId, ['treatment_coordinator', 'sales']],
  );
  return rows.length > 0;
}

module.exports = { isTC, isSales, validateAssignableStaff };

'use strict';

const express    = require('express');
const router     = express.Router();
const { pool }   = require('../db/index');

const PLATFORM_ROLES = ['super_admin', 'admin'];

function resolveTenant(user, source = {}) {
  if (PLATFORM_ROLES.includes(user.role)) {
    const t = source.tenantId;
    if (!t) {
      const err = new Error('tenantId is required for platform admins');
      err.status = 400;
      throw err;
    }
    return t;
  }
  return user.tenantId;
}

// GET /api/billing-entities
router.get('/', async (req, res) => {
  try {
    const tenantId = resolveTenant(req.user, req.query);
    const { rows } = await pool.query(
      `SELECT id, entity_key, legal_entity_name, trading_name, is_default
         FROM billing_entities
        WHERE tenant_id = $1
        ORDER BY is_default DESC, entity_key ASC`,
      [tenantId],
    );
    res.json({ entities: rows });
  } catch (err) {
    console.error('[BillingEntities] GET error:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Failed to fetch billing entities.' });
  }
});

module.exports = router;

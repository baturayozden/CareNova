'use strict';

// Read-only platform-overview endpoints for the Super Admin Console
// (GECE-2-BRIEFI.md Bölüm C), scaffolded in Bölüm E. The admin console
// itself runs entirely on frontend/src/data/adminDemoData.ts tonight (no
// wiring yet — that's a separate future task); these endpoints exist so
// that wiring has a real backend contract to target instead of starting
// from zero. Every route here is platform-only: tenant scoping doesn't
// apply because these are cross-tenant aggregates by definition.

const express = require('express');
const router = express.Router();
const { pool } = require('../db/index');
const { requireRole } = require('../middleware/auth');

router.use(...requireRole('super_admin', 'admin'));

router.get('/overview', async (req, res, next) => {
  try {
    const [{ rows: tenantCounts }, { rows: caseCounts }] = await Promise.all([
      pool.query(`SELECT count(*)::int AS total FROM tenants`),
      pool.query(`SELECT status, count(*)::int AS n FROM cases WHERE deleted_at IS NULL GROUP BY status`),
    ]);
    res.json({
      totalClinics: tenantCounts[0]?.total ?? 0,
      casesByStatus: caseCounts,
    });
  } catch (err) { next(err); }
});

router.get('/clinics', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.created_at,
              (SELECT count(*)::int FROM cases c WHERE c.tenant_id = t.id AND c.deleted_at IS NULL) AS active_cases
       FROM tenants t ORDER BY t.created_at DESC`,
    );
    res.json({ clinics: rows });
  } catch (err) { next(err); }
});

module.exports = router;

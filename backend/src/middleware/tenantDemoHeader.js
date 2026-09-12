'use strict';

// Tells the client whether the data in this response belongs to a demo tenant
// (ASAMA-3A Görev 0.2).
//
// Tenant-scoped routes (/api/case-files, /api/leads, /api/patients, …) return
// rows of the caller's own tenant, in many different shapes — some wrap them in
// an object, some return a bare array. Adding an `isDemo` field to every one of
// those shapes would mean touching every route and risking every consumer.
// A response HEADER carries the same fact for every shape at once, without
// changing a single body: `X-Tenant-Demo: true|false`.
//
// Platform (cross-tenant) routes cannot use a single header — their rows come
// from many tenants — so routes/adminPlatform.js puts `isDemo` on each row.
//
// Non-blocking by design: no token, a bad token, or a DB hiccup simply means no
// header. Authentication itself is still done by `authenticate` on each route.

const { verifyAccessToken } = require('../utils/tokens');
const { pool } = require('../db/index');

const TTL_MS = 60_000;
const cache = new Map(); // tenantId -> { isDemo, at }

async function isDemoTenant(tenantId) {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.isDemo;
  const { rows } = await pool.query('SELECT is_demo FROM tenants WHERE id = $1', [tenantId]);
  const isDemo = rows[0]?.is_demo === true;
  cache.set(tenantId, { isDemo, at: Date.now() });
  return isDemo;
}

function tenantFromRequest(req) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.accessToken;
  if (!token) return null;
  try {
    return verifyAccessToken(token).tenantId || null;
  } catch {
    return null;
  }
}

async function tenantDemoHeader(req, res, next) {
  const tenantId = tenantFromRequest(req);
  if (!tenantId) return next();
  try {
    res.setHeader('X-Tenant-Demo', (await isDemoTenant(tenantId)) ? 'true' : 'false');
  } catch {
    // Never fail a request over a label.
  }
  return next();
}

module.exports = { tenantDemoHeader };

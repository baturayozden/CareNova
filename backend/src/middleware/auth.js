const { verifyAccessToken } = require('../utils/tokens');

/**
 * Extract access token from:
 *   1. Authorization: Bearer <token>  header  (preferred — works cross-origin)
 *   2. accessToken httpOnly cookie             (legacy / same-origin fallback)
 */
function extractToken(req) {
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return req.cookies?.accessToken ?? null;
}

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

function requireRole(...roles) {
  return [authenticate, (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  }];
}

// GECE-3-BRIEFI.md Bölüm F (BLOKAJLAR B5): impersonation is a support
// tool, not an intervention tool (Bölüm C.10) — a super_admin viewing a
// clinic "as" that clinic must never be able to WRITE anything while doing
// so, only look. The frontend's ImpersonationContext (Bölüm C) is
// currently 100% client-side/in-memory with zero real API calls (demo
// mode never hits this backend at all — see BLOKAJLAR B5's original
// note), so there is nothing upstream to send a marker yet; this
// middleware is the enforcement half, ready for whenever the admin
// console is wired to real endpoints. Convention: a request made during
// an active impersonation session carries `X-Impersonation-Session: 1`
// (any truthy value) — a plain header rather than a JWT claim, so it
// doesn't require re-issuing/rotating tokens just to start or stop
// impersonating.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function blockWritesDuringImpersonation(req, res, next) {
  const impersonating = Boolean(req.headers['x-impersonation-session']);
  if (impersonating && !SAFE_METHODS.has(req.method)) {
    return res.status(403).json({
      error: 'Write operations are disabled during impersonation. Impersonation is a support tool, not an intervention tool.',
    });
  }
  next();
}

module.exports = { authenticate, requireRole, blockWritesDuringImpersonation };

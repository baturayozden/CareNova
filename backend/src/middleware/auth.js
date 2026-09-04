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

module.exports = { authenticate, requireRole };

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const DEV_ACCESS_FALLBACK  = 'carenova-access-secret-change-in-prod';
const DEV_REFRESH_FALLBACK = 'carenova-refresh-secret-change-in-prod';

const ACCESS_SECRET     = process.env.JWT_SECRET           || DEV_ACCESS_FALLBACK;
const REFRESH_SECRET    = process.env.JWT_REFRESH_SECRET   || DEV_REFRESH_FALLBACK;
const SELECTION_SECRET  = process.env.JWT_SELECTION_SECRET || (ACCESS_SECRET + '-sel');

// These fallbacks exist so a fresh clone runs without setup. In production
// they are a critical vulnerability, not a convenience: the constants above
// are committed in this repository, so a deploy that forgets JWT_SECRET would
// sign every token with a value the whole world can read — anyone could forge
// a super_admin token, and the service would look perfectly healthy while
// doing it (/health would still return 200). Refuse to boot instead.
if (process.env.NODE_ENV === 'production'
    && (ACCESS_SECRET === DEV_ACCESS_FALLBACK || REFRESH_SECRET === DEV_REFRESH_FALLBACK)) {
  throw new Error(
    'JWT_SECRET ve JWT_REFRESH_SECRET production ortamında set edilmek ZORUNDA — '
    + 'repoda gömülü varsayılan imzalama sırrı kullanılamaz.',
  );
}
const ACCESS_TTL        = '15m';
const REFRESH_TTL       = '7d';
const SELECTION_TTL     = '5m';

// In-memory refresh token store
const refreshTokens = new Set();

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function generateRefreshToken() {
  const token = crypto.randomBytes(40).toString('hex');
  refreshTokens.add(token);
  return token;
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function isValidRefreshToken(token) {
  return refreshTokens.has(token);
}

function revokeRefreshToken(token) {
  refreshTokens.delete(token);
}

// ── Tenant-selection token (5 min, no auth — only carries user identity) ─────
// Issued by /auth/login when the user belongs to >1 tenant.
// Consumed by /auth/select-tenant to establish the active tenant securely.

function generateSelectionToken(userId) {
  return jwt.sign(
    { sub: userId, sel: true },
    SELECTION_SECRET,
    { expiresIn: SELECTION_TTL },
  );
}

function verifySelectionToken(token) {
  const payload = jwt.verify(token, SELECTION_SECRET);
  if (!payload.sel) throw new Error('Not a selection token');
  return payload;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  isValidRefreshToken,
  revokeRefreshToken,
  generateSelectionToken,
  verifySelectionToken,
  REFRESH_TTL,
};

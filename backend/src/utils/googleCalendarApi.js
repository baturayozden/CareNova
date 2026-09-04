/**
 * Google Calendar API helper
 *
 * Responsibilities:
 *  - AES-256-GCM encrypt/decrypt for stored tokens
 *  - OAuth2 client factory
 *  - getValidAccessToken  — refresh if expired, persist new token to DB
 *  - createEvent / updateEvent / deleteEvent  — push CareNova → Google
 *  - listEventsIncremental — syncToken-based polling (handles 410 GONE resync)
 *  - getFreeBusy  — slot conflict detection
 *
 * Env vars required:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI
 *   TOKEN_ENCRYPTION_KEY  — 64 hex chars (32 bytes) for AES-256-GCM
 *                           If shorter, a SHA-256 hash is used as fallback.
 */

'use strict';

const crypto   = require('crypto');
const { google } = require('googleapis');
const { pool }   = require('../db/index');

// ── Encryption helpers ────────────────────────────────────────────────────────

const ALGO = 'aes-256-gcm';

function getEncKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    // Dev-only fallback — loud warning so it's never silently used in prod
    console.warn('[GoogleCalendar] TOKEN_ENCRYPTION_KEY not set — using insecure dev key');
    return crypto.createHash('sha256').update('dev-insecure-key').digest();
  }
  const buf = Buffer.from(raw, 'hex');
  // If the hex string decodes to exactly 32 bytes, use it directly;
  // otherwise derive 32 bytes via SHA-256 so any string works.
  return buf.length === 32 ? buf : crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypt plaintext string → "<ivHex>:<ciphertextHex>:<authTagHex>"
 */
function encrypt(plaintext) {
  const key = getEncKey();
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypt a string produced by encrypt().
 */
function decrypt(ciphertext) {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const [ivHex, encHex, tagHex] = parts;
  const key = getEncKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

// ── OAuth state signing ───────────────────────────────────────────────────────
//
// Format: base64(payloadJson) + "." + base64url(hmac-sha256)
// Key:    JWT_SECRET env var (same key used for access tokens — already a secret)
// TTL:    10 minutes (enforced in verifyState)

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getHmacKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var not set — cannot sign OAuth state');
  return secret;
}

/**
 * Sign an OAuth state payload.
 * payload must include { tenantId, userId }.
 * nonce and iat are added here automatically.
 *
 * @param {{ tenantId: string, userId: string }} payload
 * @returns {string}  "<base64(json)>.<base64url(hmac)>"
 */
function signState(payload) {
  const full = {
    tenantId: payload.tenantId,
    userId:   payload.userId,
    nonce:    crypto.randomBytes(16).toString('hex'),
    iat:      Date.now(),
  };

  const payloadB64 = Buffer.from(JSON.stringify(full)).toString('base64');
  const sig = crypto
    .createHmac('sha256', getHmacKey())
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${sig}`;
}

/**
 * Verify a signed OAuth state string and return the decoded payload.
 * Throws a descriptive Error if the state is invalid, tampered, or expired.
 *
 * @param {string} state   Value received from Google's callback ?state= param
 * @returns {{ tenantId: string, userId: string, nonce: string, iat: number }}
 */
function verifyState(state) {
  // 1. Split
  const dotIdx = state.indexOf('.');
  if (dotIdx === -1) throw new Error('state_malformed');

  const payloadPart   = state.slice(0, dotIdx);
  const signaturePart = state.slice(dotIdx + 1);

  // 2. Recompute HMAC and compare with timing-safe equal
  const expected = crypto
    .createHmac('sha256', getHmacKey())
    .update(payloadPart)
    .digest('base64url');

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signaturePart);

  // Lengths must match before timingSafeEqual (it throws on length mismatch)
  if (
    expectedBuf.length !== receivedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, receivedBuf)
  ) {
    throw new Error('state_invalid_signature');
  }

  // 3. Decode payload
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payloadPart, 'base64').toString('utf8'));
  } catch {
    throw new Error('state_malformed');
  }

  // 4. TTL check
  if (!parsed.iat || Date.now() - parsed.iat > STATE_TTL_MS) {
    throw new Error('state_expired');
  }

  // 5. Require mandatory fields
  if (!parsed.tenantId || !parsed.userId) {
    throw new Error('state_malformed');
  }

  return parsed;
}

// ── OAuth2 client factory ─────────────────────────────────────────────────────

function makeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

// ── Token management ──────────────────────────────────────────────────────────

/**
 * Return a valid (non-expired) access token for the given integration row.
 * If the stored token is within 60 s of expiry, refresh it first and persist
 * the new token + expiry back to calendar_integrations.
 *
 * @param {object} integration  Row from calendar_integrations (snake_case cols)
 * @returns {Promise<string>}   Plain-text access token
 */
async function getValidAccessToken(integration) {
  const now    = Date.now();
  const expiry = integration.token_expiry
    ? new Date(integration.token_expiry).getTime()
    : 0;

  // Still valid with 60-second buffer
  if (integration.access_token && expiry > now + 60_000) {
    return decrypt(integration.access_token);
  }

  // Needs refresh
  const oauth2 = makeOAuthClient();
  const refreshToken = decrypt(integration.refresh_token);
  oauth2.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2.refreshAccessToken();
  const { access_token: newRaw, expiry_date } = credentials;

  const newEncrypted = encrypt(newRaw);
  const newExpiry    = expiry_date ? new Date(expiry_date) : null;

  await pool.query(
    `UPDATE calendar_integrations
        SET access_token = $1, token_expiry = $2, updated_at = NOW()
      WHERE id = $3`,
    [newEncrypted, newExpiry, integration.id],
  );

  console.log(`[GoogleCalendar] Access token refreshed for integration ${integration.id}`);
  return newRaw;
}

/**
 * Build an authenticated googleapis calendar client from an integration row.
 */
async function getCalendarClient(integration) {
  const accessToken = await getValidAccessToken(integration);
  const oauth2 = makeOAuthClient();
  oauth2.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2 });
}

// ── Push helpers (CareNova → Google) ───────────────────────────────────────

/**
 * Create a Google Calendar event.
 *
 * @param {object} integration  calendar_integrations row
 * @param {string} calendarId   e.g. 'primary' or the stored calendar_id
 * @param {object} eventBody    Google Calendar event resource
 * @returns {Promise<object>}   Created event resource (includes .id)
 */
async function createEvent(integration, calendarId, eventBody) {
  const cal = await getCalendarClient(integration);
  const res = await cal.events.insert({
    calendarId,
    requestBody: eventBody,
  });
  return res.data;
}

/**
 * Update an existing Google Calendar event.
 *
 * @param {object} integration
 * @param {string} calendarId
 * @param {string} eventId       Google event id (stored in appointments.google_event_id)
 * @param {object} eventBody     Full or partial event resource
 * @returns {Promise<object>}    Updated event resource
 */
async function updateEvent(integration, calendarId, eventId, eventBody) {
  const cal = await getCalendarClient(integration);
  const res = await cal.events.update({
    calendarId,
    eventId,
    requestBody: eventBody,
  });
  return res.data;
}

/**
 * Delete a Google Calendar event.
 *
 * @param {object} integration
 * @param {string} calendarId
 * @param {string} eventId
 */
async function deleteEvent(integration, calendarId, eventId) {
  const cal = await getCalendarClient(integration);
  await cal.events.delete({ calendarId, eventId });
}

// ── Pull helper (Google → CareNova, incremental polling) ───────────────────

/**
 * Fetch changed events since the last sync using syncToken.
 *
 * - If integration.sync_token is set, uses it for incremental delta.
 * - If not set (first sync), fetches from now onwards.
 * - On 410 GONE (token expired), returns { events:[], nextSyncToken:null, fullResync:true }
 *   so the caller can clear the token and schedule a full resync.
 *
 * @param {object} integration  calendar_integrations row (needs .calendar_id, .sync_token)
 * @returns {Promise<{ events: object[], nextSyncToken: string|null, fullResync: boolean }>}
 */
async function listEventsIncremental(integration) {
  const cal = await getCalendarClient(integration);

  const params = {
    calendarId:    integration.calendar_id || 'primary',
    singleEvents:  true,
  };

  if (integration.sync_token) {
    params.syncToken = integration.sync_token;
  } else {
    // No prior sync — fetch from current time onward
    params.timeMin  = new Date().toISOString();
    params.orderBy  = 'startTime';
  }

  try {
    const res = await cal.events.list(params);
    return {
      events:        res.data.items || [],
      nextSyncToken: res.data.nextSyncToken || null,
      fullResync:    false,
    };
  } catch (err) {
    // 410 GONE means the syncToken has expired; caller must reset and do full sync
    if (err.code === 410 || err.status === 410) {
      console.warn(`[GoogleCalendar] syncToken expired for integration ${integration.id} — full resync needed`);
      return { events: [], nextSyncToken: null, fullResync: true };
    }
    throw err;
  }
}

// ── FreeBusy query ────────────────────────────────────────────────────────────

/**
 * Return busy intervals for the integration's calendar within a time window.
 * Used for slot conflict detection.
 *
 * @param {object} integration
 * @param {string} timeMin  ISO 8601 string
 * @param {string} timeMax  ISO 8601 string
 * @returns {Promise<Array<{ start: string, end: string }>>}
 */
async function getFreeBusy(integration, timeMin, timeMax) {
  const cal = await getCalendarClient(integration);
  const calendarId = integration.calendar_id || 'primary';

  const res = await cal.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: calendarId }],
    },
  });

  return res.data.calendars[calendarId]?.busy || [];
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  encrypt,
  decrypt,
  signState,
  verifyState,
  makeOAuthClient,
  getValidAccessToken,
  createEvent,
  updateEvent,
  deleteEvent,
  listEventsIncremental,
  getFreeBusy,
};

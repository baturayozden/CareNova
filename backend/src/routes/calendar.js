/**
 * Google Calendar integration routes
 *
 * Mount in index.js:
 *   app.use('/api/calendar', require('./routes/calendar'));
 *
 * Endpoints:
 *   GET  /api/calendar/google/connect   → redirect to Google OAuth consent screen
 *   GET  /api/calendar/google/callback  → handle OAuth code, store tokens, redirect to frontend
 *   POST /api/calendar/disconnect       → mark integration as disconnected
 *   GET  /api/calendar/status           → return current connection status for tenant
 *
 * The callback endpoint is intentionally PUBLIC (Google redirects to it with no
 * auth header). All other endpoints require the standard JWT authenticate middleware.
 */

'use strict';

const express = require('express');

const router         = express.Router();
const { pool }       = require('../db/index');
const { authenticate } = require('../middleware/auth');
const { encrypt, signState, verifyState, makeOAuthClient } = require('../utils/googleCalendarApi');
const { google }     = require('googleapis');

// OAuth scopes requested from Google
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

// ─── GET /api/calendar/google/connect ────────────────────────────────────────
// Redirect the authenticated user to Google's OAuth consent screen.
// Requires auth — only clinic users can connect their own calendar.

router.get('/google/connect', authenticate, (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Platform-level accounts cannot connect a calendar' });
  }

  const oauth2 = makeOAuthClient();

  // Sign state with HMAC-SHA256 (nonce + iat included inside signState)
  const state = signState({ tenantId, userId: req.user.sub });

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',   // request refresh token
    prompt:      'consent',   // always show consent screen to get refresh token
    scope:       SCOPES,
    state,
  });

  res.redirect(authUrl);
});

// ─── GET /api/calendar/google/callback ───────────────────────────────────────
// Public — Google redirects here after user grants (or denies) access.
// Exchanges the auth code for tokens, stores them encrypted, then redirects
// back to the frontend settings page.

router.get('/google/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const { code, state, error } = req.query;

  // ── 1. Deny if Google reported an error or params missing ─────────────────
  if (error || !code || !state) {
    console.warn('[Calendar] OAuth denied or missing params:', error);
    return res.redirect(`${frontendUrl}/settings?tab=integrations&error=google_oauth_denied`);
  }

  // ── 2. Verify HMAC signature + TTL (no DB touch on failure) ───────────────
  let statePayload;
  try {
    statePayload = verifyState(state);
  } catch (err) {
    const reason = err.message || 'state_invalid';
    console.warn(`[Calendar] State verification failed: ${reason}`);
    // Map internal error codes to safe redirect params
    const errorParam = reason === 'state_expired' ? 'state_expired' : 'invalid_state';
    return res.redirect(`${frontendUrl}/settings?tab=integrations&error=${errorParam}`);
  }

  const { tenantId } = statePayload;

  try {
    // ── 3. Confirm tenant actually exists in DB ────────────────────────────
    const { rows: tenantRows } = await pool.query(
      'SELECT 1 FROM tenants WHERE id = $1 AND deleted_at IS NULL',
      [tenantId],
    );
    if (!tenantRows.length) {
      console.error(`[Calendar] Callback for unknown tenant: ${tenantId}`);
      return res.redirect(`${frontendUrl}/settings?tab=integrations&error=tenant_not_found`);
    }

    // ── 4. Exchange auth code for tokens ──────────────────────────────────
    const oauth2 = makeOAuthClient();
    const { tokens } = await oauth2.getToken(code);
    const { access_token, refresh_token, expiry_date } = tokens;

    if (!refresh_token) {
      // Shouldn't happen with prompt=consent, but guard anyway
      console.error('[Calendar] Google did not return a refresh token');
      return res.redirect(`${frontendUrl}/settings?tab=integrations&error=no_refresh_token`);
    }

    // ── 5. Fetch primary calendar details (id == user's email) ────────────
    oauth2.setCredentials(tokens);
    const calClient = google.calendar({ version: 'v3', auth: oauth2 });
    const calInfo   = await calClient.calendarList.get({ calendarId: 'primary' });
    const calendarId         = calInfo.data.id;   // e.g. user@gmail.com
    const googleAccountEmail = calInfo.data.id;

    // ── 6. Encrypt and upsert ─────────────────────────────────────────────
    const encAccessToken  = encrypt(access_token);
    const encRefreshToken = encrypt(refresh_token);
    const tokenExpiry     = expiry_date ? new Date(expiry_date) : null;

    await pool.query(`
      INSERT INTO calendar_integrations
        (tenant_id, provider, google_account_email,
         access_token, refresh_token, token_expiry,
         calendar_id, sync_token, status)
      VALUES ($1, 'google', $2, $3, $4, $5, $6, NULL, 'connected')
      ON CONFLICT (tenant_id, provider) DO UPDATE SET
        google_account_email = EXCLUDED.google_account_email,
        access_token         = EXCLUDED.access_token,
        refresh_token        = EXCLUDED.refresh_token,
        token_expiry         = EXCLUDED.token_expiry,
        calendar_id          = EXCLUDED.calendar_id,
        sync_token           = NULL,
        status               = 'connected',
        updated_at           = NOW()
    `, [tenantId, googleAccountEmail, encAccessToken, encRefreshToken, tokenExpiry, calendarId]);

    console.log(`[Calendar] Google Calendar connected for tenant ${tenantId} (${googleAccountEmail})`);
    res.redirect(`${frontendUrl}/settings?tab=integrations&google=connected`);
  } catch (err) {
    console.error('[Calendar] OAuth callback error:', err.message);
    res.redirect(`${frontendUrl}/settings?tab=integrations&error=google_oauth_failed`);
  }
});

// ─── POST /api/calendar/disconnect ───────────────────────────────────────────
// Mark the tenant's Google integration as disconnected (soft delete).

router.post('/disconnect', authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ error: 'No tenant associated' });

  try {
    const { rowCount } = await pool.query(`
      UPDATE calendar_integrations
         SET status     = 'disconnected',
             updated_at = NOW()
       WHERE tenant_id = $1
         AND provider  = 'google'
    `, [tenantId]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'No Google Calendar integration found' });
    }

    console.log(`[Calendar] Disconnected Google Calendar for tenant ${tenantId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Calendar] disconnect error:', err.message);
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

// ─── GET /api/calendar/status ─────────────────────────────────────────────────
// Return the current Google Calendar connection status for the authenticated tenant.

router.get('/status', authenticate, async (req, res) => {
  const tenantId = req.user.tenantId;
  if (!tenantId) {
    // Super-admins have no tenant — return not connected
    return res.json({ connected: false });
  }

  try {
    const { rows } = await pool.query(`
      SELECT id, provider, google_account_email, calendar_id,
             status, last_synced_at, created_at
        FROM calendar_integrations
       WHERE tenant_id = $1
         AND provider  = 'google'
       LIMIT 1
    `, [tenantId]);

    if (!rows.length) {
      return res.json({ connected: false });
    }

    const row = rows[0];
    res.json({
      connected:      row.status === 'connected',
      status:         row.status,
      email:          row.google_account_email,
      calendarId:     row.calendar_id,
      lastSyncedAt:   row.last_synced_at,
      connectedSince: row.created_at,
    });
  } catch (err) {
    console.error('[Calendar] status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch calendar status' });
  }
});

module.exports = router;

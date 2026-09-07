const axios = require('axios');

const BASE_URL = 'https://graph.facebook.com';

function client(config = {}) {
  const version     = process.env.WHATSAPP_API_VERSION    || 'v21.0';
  const phoneId     = config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = config.accessToken   || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneId || !accessToken) {
    throw new Error('Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in environment');
  }

  return {
    baseURL: `${BASE_URL}/${version}/${phoneId}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Send a plain text message.
 * @param {string} to   - E.164 phone number, e.g. "+447827690137"
 * @param {string} text - Message body
 */
async function sendText(to, text, config = {}) {
  const { baseURL, headers } = client(config);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  };

  const response = await axios.post(`${baseURL}/messages`, payload, { headers });
  return response.data;
}

/**
 * Send an approved template message.
 * @param {string} to           - E.164 phone number
 * @param {string} templateName - Approved template name
 * @param {string} languageCode - e.g. "en_US", "tr", "ar"
 * @param {Array}  components   - Template parameter components (optional)
 */
async function sendTemplate(to, templateName, languageCode = 'en_US', components = [], config = {}) {
  const { baseURL, headers } = client(config);

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length > 0 && { components }),
    },
  };

  const response = await axios.post(`${baseURL}/messages`, payload, { headers });
  return response.data;
}

/**
 * Mark an incoming message as read.
 * @param {string} messageId - WhatsApp message ID from the webhook
 */
async function markAsRead(messageId, config = {}) {
  const { baseURL, headers } = client(config);

  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  };

  const response = await axios.post(`${baseURL}/messages`, payload, { headers });
  return response.data;
}

/**
 * Get the phone number's profile and display name from the API.
 */
async function getPhoneNumberInfo() {
  const version     = process.env.WHATSAPP_API_VERSION    || 'v21.0';
  const phoneId     = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  const response = await axios.get(
    `${BASE_URL}/${version}/${phoneId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { fields: 'display_phone_number,verified_name,quality_rating' },
    }
  );
  return response.data;
}

/**
 * GECE-4-BRIEFI.md Bölüm C.1/C.2 — Meta Media API is a two-step fetch:
 * (1) GET /{media-id} (NOT under the phone-number path) returns metadata
 *     including a short-lived, authenticated `url`.
 * (2) GET that url (still with the same Bearer token) returns the raw bytes.
 * Real network calls — never invoked in tests tonight (MUTLAK YASAK #5);
 * see __tests__/whatsapp.test.js for how the mock-provider pipeline is
 * tested instead.
 */
async function getMediaUrl(mediaId, config = {}) {
  const version     = process.env.WHATSAPP_API_VERSION || 'v21.0';
  const accessToken = config.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const response = await axios.get(`${BASE_URL}/${version}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data; // { url, mime_type, sha256, file_size, id }
}

async function downloadMedia(mediaId, config = {}) {
  const accessToken = config.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const meta = await getMediaUrl(mediaId, config);
  const response = await axios.get(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'arraybuffer',
  });
  return { buffer: Buffer.from(response.data), mimeType: meta.mime_type, fileSize: meta.file_size };
}

/**
 * Parse a raw webhook body into a normalised message object.
 * Returns null if the payload doesn't contain a message.
 *
 * @param {object} body - req.body from the webhook POST
 * @returns {{ from, messageId, timestamp, type, text, mediaId, mimeType, raw } | null}
 */
function parseIncomingMessage(body) {
  try {
    const entry   = body?.entry?.[0];
    const change  = entry?.changes?.[0];
    const value   = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null;

    const contact = value?.contacts?.[0];

    // GECE-4-BRIEFI.md Bölüm C.1: audio/voice, image, and document all
    // carry their media reference the same way in Meta's payload —
    // message[type].id — just under a different type key. 'audio' covers
    // both voice notes and shared audio files; WhatsApp doesn't
    // distinguish them in the webhook payload itself (voice notes set
    // `message.audio.voice: true`, exposed below for callers that care).
    const mediaTypes = ['audio', 'image', 'document'];
    const mediaBlock = mediaTypes.includes(message.type) ? message[message.type] : null;

    return {
      from:        message.from,                          // E.164 without +
      senderName:  contact?.profile?.name || 'Unknown',
      messageId:   message.id,
      timestamp:   new Date(parseInt(message.timestamp, 10) * 1000).toISOString(),
      type:        message.type,                          // text, image, audio, document, etc.
      text:        message.type === 'text' ? message.text?.body : null,
      mediaId:     mediaBlock?.id || null,
      mimeType:    mediaBlock?.mime_type || null,
      isVoiceNote: message.type === 'audio' ? Boolean(message.audio?.voice) : false,
      caption:     mediaBlock?.caption || null,           // image/document may carry a text caption
      filename:    message.type === 'document' ? message.document?.filename || null : null,
      phoneNumberId: value?.metadata?.phone_number_id,
      raw:         message,
    };
  } catch {
    return null;
  }
}

/**
 * Parse a webhook status update (delivered, read, failed, etc.)
 * Returns null if the payload doesn't contain a status update.
 *
 * @param {object} body - req.body from the webhook POST
 * @returns {{ messageId, status, timestamp, recipientId } | null}
 */
function parseStatusUpdate(body) {
  try {
    const entry   = body?.entry?.[0];
    const change  = entry?.changes?.[0];
    const status  = change?.value?.statuses?.[0];

    if (!status) return null;

    return {
      messageId:   status.id,
      status:      status.status,    // sent, delivered, read, failed
      timestamp:   new Date(parseInt(status.timestamp, 10) * 1000).toISOString(),
      recipientId: status.recipient_id,
      errors:      status.errors || [],
    };
  } catch {
    return null;
  }
}

module.exports = {
  sendText,
  sendTemplate,
  markAsRead,
  getPhoneNumberInfo,
  getMediaUrl,
  downloadMedia,
  parseIncomingMessage,
  parseStatusUpdate,
};

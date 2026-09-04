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
 * Parse a raw webhook body into a normalised message object.
 * Returns null if the payload doesn't contain a message.
 *
 * @param {object} body - req.body from the webhook POST
 * @returns {{ from, messageId, timestamp, type, text, raw } | null}
 */
function parseIncomingMessage(body) {
  try {
    const entry   = body?.entry?.[0];
    const change  = entry?.changes?.[0];
    const value   = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null;

    const contact = value?.contacts?.[0];

    return {
      from:        message.from,                          // E.164 without +
      senderName:  contact?.profile?.name || 'Unknown',
      messageId:   message.id,
      timestamp:   new Date(parseInt(message.timestamp, 10) * 1000).toISOString(),
      type:        message.type,                          // text, image, audio, etc.
      text:        message.type === 'text' ? message.text?.body : null,
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
  parseIncomingMessage,
  parseStatusUpdate,
};

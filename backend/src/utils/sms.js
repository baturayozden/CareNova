'use strict';

const { pool }    = require('../db/index');
const { decrypt } = require('./googleCalendarApi');

async function sendSms(tenantId, toPhone, body) {
  const { rows } = await pool.query(
    `SELECT twilio_account_sid, twilio_auth_token_encrypted,
            twilio_messaging_service_sid, twilio_from_number
     FROM tenant_billing_profiles WHERE tenant_id = $1`,
    [tenantId],
  );

  const profile = rows[0];
  if (!profile || !profile.twilio_account_sid || !profile.twilio_auth_token_encrypted) {
    throw new Error('SMS not configured for tenant');
  }

  const authToken = decrypt(profile.twilio_auth_token_encrypted);
  const twilio    = require('twilio');
  const client    = twilio(profile.twilio_account_sid, authToken);

  const msgParams = { body, to: toPhone };

  if (profile.twilio_messaging_service_sid) {
    msgParams.messagingServiceSid = profile.twilio_messaging_service_sid;
  } else if (profile.twilio_from_number) {
    msgParams.from = profile.twilio_from_number;
  } else {
    throw new Error('SMS not configured for tenant');
  }

  await client.messages.create(msgParams);
}

module.exports = { sendSms };

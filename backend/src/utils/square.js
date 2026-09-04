'use strict';

const { pool }    = require('../db/index');
const { decrypt } = require('./googleCalendarApi');

async function getSquareClient(tenantId) {
  const { rows } = await pool.query(
    `SELECT square_access_token_encrypted, square_location_id, square_environment
     FROM tenant_billing_profiles WHERE tenant_id = $1`,
    [tenantId],
  );
  const p = rows[0];
  if (!p?.square_access_token_encrypted || !p?.square_location_id) {
    throw new Error('Square not configured for tenant');
  }
  const { SquareClient, SquareEnvironment } = require('square');
  const accessToken = decrypt(p.square_access_token_encrypted);
  const environment = p.square_environment === 'sandbox'
    ? SquareEnvironment.Sandbox
    : SquareEnvironment.Production;
  return {
    client:     new SquareClient({ token: accessToken, environment }),
    locationId: p.square_location_id,
  };
}

async function createPaymentLink(tenantId, { amount, currency = 'GBP', caseId, patientName, description }) {
  const { client, locationId } = await getSquareClient(tenantId);
  const amountPence = Math.round(Number(amount) * 100);
  if (!amountPence || amountPence <= 0) throw new Error('Invalid payment amount');

  const name = description || `Dental treatment${patientName ? ` — ${patientName}` : ''}`;

  const response = await client.checkout.paymentLinks.create({
    idempotencyKey: `${caseId}-${Date.now()}`,
    quickPay: {
      name,
      priceMoney: { amount: BigInt(amountPence), currency },
      locationId,
    },
    paymentNote: caseId,
  });

  const link = response.paymentLink;
  return {
    url:           link.url,
    paymentLinkId: link.id,
    orderId:       link.orderId,
  };
}

module.exports = { getSquareClient, createPaymentLink };

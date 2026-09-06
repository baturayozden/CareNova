const express    = require('express');
const router     = express.Router();
const { pool }   = require('../db/index');
const caseStore  = require('../services/caseStore');
const linkStore  = require('../store/linkStore');
const { requireRole } = require('../middleware/auth');
const { isHastaDanismani, validateAssignableStaff } = require('../utils/staff');
const { sendBankDetailsEmail, sendPaymentLinkEmail } = require('../utils/email');
const { sendSms }              = require('../utils/sms');
const { createPaymentLink }        = require('../utils/square');
const { createCheckoutSession }    = require('../utils/stripe');
const { fillTemplate, createSignatureDocument, getDocumentDownloadUrl, toUKDate } = require('../utils/signwell');

const CASE_ROLES = [
  'operasyon_muduru', 'klinik_sahibi', 'hasta_danismani',
  'koordinator', 'super_admin', 'admin',
];

const VALID_METHODS = ['finance', 'bank_transfer', 'card', 'pay_by_bank', 'cash'];
const VALID_PAYER   = ['self', 'third_party'];
const VALID_STATUS  = [
  'draft', 'awaiting_signature', 'signed', 'payment_sent',
  'paid', 'finance_referred', 'reversed', 'cancelled', 'declined', 'expired', 'bounced',
];

function resolveTenant(req) {
  const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user.role);
  if (isPlatformAdmin) {
    return req.body?.tenantId || req.query?.tenantId || null;
  }
  return req.user.tenantId || null;
}

async function assertFinanceAllowed(tenantId, res) {
  const { rows } = await pool.query(
    'SELECT finance_enabled FROM tenant_billing_profiles WHERE tenant_id = $1',
    [tenantId],
  );
  if (rows[0]?.finance_enabled === false) {
    res.status(400).json({ error: 'Finance payment method is not available for this clinic.' });
    return false;
  }
  return true;
}

function validateFields(body, res) {
  const { paymentMethod, payerType, status, cardholderName, cardholderPhone, cardholderEmail } = body;
  if (paymentMethod && !VALID_METHODS.includes(paymentMethod)) {
    res.status(400).json({ error: `payment_method must be one of: ${VALID_METHODS.join(', ')}` });
    return false;
  }
  if (payerType && !VALID_PAYER.includes(payerType)) {
    res.status(400).json({ error: `payer_type must be one of: ${VALID_PAYER.join(', ')}` });
    return false;
  }
  if (status && !VALID_STATUS.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUS.join(', ')}` });
    return false;
  }
  if (paymentMethod === 'card' && payerType === 'third_party') {
    if (!cardholderName) {
      res.status(400).json({ error: 'cardholder_name is required for third-party card payments.' });
      return false;
    }
    if (!cardholderPhone && !cardholderEmail) {
      res.status(400).json({ error: 'cardholder phone or email is required for third-party card payments.' });
      return false;
    }
  }
  return true;
}

// GET /api/cases
router.get('/', ...requireRole(...CASE_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });
    const { status } = req.query;
    const assignedTo = req.user.role === 'hasta_danismani' ? req.user.sub : null;
    const cases = await caseStore.listCases(tenantId, { status, assignedTo });
    res.json({ cases });
  } catch (err) {
    console.error('[Cases] list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch cases.' });
  }
});

// POST /api/cases
router.post('/', ...requireRole(...CASE_ROLES), async (req, res) => {
  const tenantId = resolveTenant(req);
  if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });
  if (!validateFields(req.body, res)) return;
  if (req.body.paymentMethod === 'finance' && !(await assertFinanceAllowed(tenantId, res))) return;

  // Resolve assignedStaffId: hasta_danismani → self; management roles → body field (required + validated)
  let assignedStaffId;
  if (isHastaDanismani(req.user)) {
    assignedStaffId = req.user.sub;
  } else {
    if (!req.body.assignedStaffId)
      return res.status(400).json({ error: 'Assigned staff is required — select which hasta_danismani this case belongs to.' });
    const valid = await validateAssignableStaff(req.body.assignedStaffId, tenantId);
    if (!valid)
      return res.status(400).json({ error: 'assignedStaffId must be an active hasta_danismani in this clinic.' });
    assignedStaffId = req.body.assignedStaffId;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const newCase = await caseStore.createCase(
      tenantId,
      { ...req.body, createdBy: req.user.sub, assignedTo: assignedStaffId },
      client,
    );

    // Derive treatment_category — NOT NULL on treatment_deals; fall back to description or 'Other'
    const treatmentCategory = (
      req.body.treatmentCategory ||
      req.body.treatmentDescription ||
      'Other'
    ).slice(0, 50);

    const { rows: dealRows } = await client.query(
      `INSERT INTO treatment_deals
         (tenant_id, lead_id, assigned_staff_id,
          patient_name, patient_email, patient_phone,
          treatment_category, treatment_name,
          agreed_amount, deposit_amount, currency,
          deal_date, status, billing_entity_id, case_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'GBP',CURRENT_DATE,'quoted',$11,$12)
       RETURNING *`,
      [
        tenantId,
        newCase.lead_id   || null,
        assignedStaffId,
        newCase.patient_name  || null,
        newCase.patient_email || null,
        newCase.patient_phone || null,
        treatmentCategory,
        req.body.treatmentDescription || null,
        newCase.total_cost   || null,
        req.body.depositAmount ?? 0,
        req.body.billingEntityId || null,
        newCase.id,
      ],
    );
    const deal = dealRows[0];

    await client.query('COMMIT');
    res.status(201).json({ case: newCase, deal });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Cases] create error:', err.message);
    res.status(500).json({ error: 'Failed to create case.' });
  } finally {
    client.release();
  }
});

// GET /api/cases/:id
router.get('/:id', ...requireRole(...CASE_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });
    const c = await caseStore.getCaseById(req.params.id, tenantId);
    if (!c) return res.status(404).json({ error: 'Case not found.' });
    if (req.user.role === 'hasta_danismani' && c.assigned_to !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    res.json({ case: c });
  } catch (err) {
    console.error('[Cases] get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch case.' });
  }
});

// PATCH /api/cases/:id
router.patch('/:id', ...requireRole(...CASE_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });
    if (!validateFields(req.body, res)) return;
    if (req.body.paymentMethod === 'finance' && !(await assertFinanceAllowed(tenantId, res))) return;

    // Guard: manual paid is only valid for methods without a payment webhook.
    // card and pay_by_bank are marked paid automatically by Atoa/Stripe/Square webhooks.
    if (req.body.status === 'paid') {
      const tc = await caseStore.getCaseById(req.params.id, tenantId);
      if (!tc) return res.status(404).json({ error: 'Case not found.' });
      if (req.user.role === 'hasta_danismani' && tc.assigned_to !== req.user.sub) {
        return res.status(403).json({ error: 'Forbidden.' });
      }
      if (['card', 'pay_by_bank'].includes(tc.payment_method)) {
        return res.status(400).json({
          error: 'Card and Pay by Bank cases are marked paid automatically via payment confirmation, not manually.',
        });
      }
      const c = await caseStore.updateCase(req.params.id, tenantId, req.body);
      if (!c) return res.status(404).json({ error: 'Case not found.' });
      await caseStore.syncDealStatusFromCase(req.params.id, 'paid', { actorId: req.user.sub, actorRole: req.user.role, tenantId });
      return res.json({ case: c });
    }

    if (req.user.role === 'hasta_danismani') {
      const existing = await caseStore.getCaseById(req.params.id, tenantId);
      if (!existing) return res.status(404).json({ error: 'Case not found.' });
      if (existing.assigned_to !== req.user.sub) return res.status(403).json({ error: 'Forbidden.' });
    }
    const c = await caseStore.updateCase(req.params.id, tenantId, req.body);
    if (!c) return res.status(404).json({ error: 'Case not found.' });
    if (req.body.status) await caseStore.syncDealStatusFromCase(req.params.id, req.body.status, { actorId: req.user.sub, actorRole: req.user.role, tenantId });
    res.json({ case: c });
  } catch (err) {
    console.error('[Cases] update error:', err.message);
    res.status(500).json({ error: 'Failed to update case.' });
  }
});

// POST /api/cases/:id/send-bank-details
router.post('/:id/send-bank-details', ...requireRole(...CASE_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const { channels } = req.body;
    if (!Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ error: 'channels must be a non-empty array.' });
    }

    const tc = await caseStore.getCaseById(req.params.id, tenantId);
    if (!tc) return res.status(404).json({ error: 'Case not found.' });
    if (req.user.role === 'hasta_danismani' && tc.assigned_to !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    if (tc.payment_method === 'cash') {
      return res.status(400).json({ error: 'Bank details cannot be sent for cash cases.' });
    }

    const { rows: profileRows } = await pool.query(
      `SELECT trading_name, legal_entity_name,
              bank_name, bank_account_name, sort_code, account_number
       FROM tenant_billing_profiles WHERE tenant_id = $1`,
      [tenantId],
    );
    const profile = profileRows[0];
    if (!profile?.bank_name || !profile?.bank_account_name || !profile?.sort_code || !profile?.account_number) {
      return res.status(400).json({ error: 'Bank details not configured for clinic.' });
    }

    const clinicDisplayName = profile.trading_name || profile.legal_entity_name || 'The Clinic';
    const createdBy         = req.user.email || req.user.id;

    // A model: bank details sent inline in email/SMS body — no /r/:token link used.
    // /r/:token reserved for payment/signature links (Step 4-5).
    const bankPayload = {
      clinicDisplayName,
      patientName:   tc.patient_name   || '',
      amount:        tc.amount_due     || tc.total_cost,
      bankName:      profile.bank_name,
      accountName:   profile.bank_account_name,
      sortCode:      profile.sort_code,
      accountNumber: profile.account_number,
      reference:     tc.patient_name   || tc.id.slice(0, 8).toUpperCase(),
    };

    const results = [];

    for (const channel of channels) {
      const result = { channel };

      if (channel === 'email') {
        if (!tc.patient_email) {
          results.push({ channel, status: 'skipped', error: 'No email on file' });
          continue;
        }
        try {
          const link = await linkStore.createLinkRequest({
            tenantId, caseId: tc.id, leadId: tc.lead_id,
            kind: 'bank_details', recipient: 'patient', channel: 'email',
            provider: 'resend', createdBy,
          });
          await sendBankDetailsEmail({ to: tc.patient_email, tenantId, ...bankPayload });
          await linkStore.markSent(link.id);
          result.status = 'sent';
        } catch (err) {
          console.error('[Cases] send-bank-details email error:', err.message);
          result.status = 'failed';
          result.error  = err.message;
        }

      } else if (channel === 'sms') {
        if (!tc.patient_phone) {
          results.push({ channel, status: 'skipped', error: 'No phone on file' });
          continue;
        }
        try {
          const link = await linkStore.createLinkRequest({
            tenantId, caseId: tc.id, leadId: tc.lead_id,
            kind: 'bank_details', recipient: 'patient', channel: 'sms',
            provider: 'twilio', createdBy,
          });
          const amountStr = bankPayload.amount ? `€${Number(bankPayload.amount).toFixed(2)}` : '';
          const smsBody = [
            `${clinicDisplayName}: bank transfer${amountStr ? ` for your ${amountStr} payment` : ''}.`,
            `Bank: ${profile.bank_name}`,
            `Account name: ${profile.bank_account_name}`,
            `Sort code: ${profile.sort_code}`,
            `Account no: ${profile.account_number}`,
            `Reference: ${bankPayload.reference}`,
            `Use the exact reference. Didn't expect this? Contact us.`,
          ].join('\n');
          await sendSms(tenantId, tc.patient_phone, smsBody);
          await linkStore.markSent(link.id);
          result.status = 'sent';
        } catch (err) {
          console.error('[Cases] send-bank-details sms error:', err.message);
          result.status = 'failed';
          result.error  = err.message;
        }

      } else {
        result.status = 'skipped';
        result.error  = `Unknown channel: ${channel}`;
      }

      results.push(result);
    }

    res.json({ results });
  } catch (err) {
    console.error('[Cases] send-bank-details error:', err.message);
    res.status(500).json({ error: 'Failed to send bank details.' });
  }
});

// POST /api/cases/:id/send-payment-link
router.post('/:id/send-payment-link', ...requireRole(...CASE_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const { channels } = req.body;
    if (!Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ error: 'channels must be a non-empty array.' });
    }

    const tc = await caseStore.getCaseById(req.params.id, tenantId);
    if (!tc) return res.status(404).json({ error: 'Case not found.' });
    if (req.user.role === 'hasta_danismani' && tc.assigned_to !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    if (!['card', 'pay_by_bank'].includes(tc.payment_method)) {
      return res.status(400).json({ error: 'Payment link is only available for card and Pay by Bank payments.' });
    }

    // Third-party gate: agreement must be signed before payment link
    const SIGNED_OR_LATER = new Set(['signed', 'payment_sent', 'paid']);
    if (tc.payer_type === 'third_party' && !SIGNED_OR_LATER.has(tc.status)) {
      return res.status(409).json({ error: 'Agreement must be signed before sending the payment link for third-party cases.' });
    }

    const amount = tc.amount_due || tc.total_cost;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Amount due must be greater than 0.' });
    }

    const { rows: profileRows } = await pool.query(
      `SELECT trading_name, legal_entity_name, payment_provider FROM tenant_billing_profiles WHERE tenant_id = $1`,
      [tenantId],
    );
    const profile           = profileRows[0];
    const clinicDisplayName = profile?.trading_name || profile?.legal_entity_name || 'The Clinic';
    const paymentProvider   = profile?.payment_provider || 'square';
    const createdBy         = req.user.email || req.user.id;

    if (tc.payment_method === 'pay_by_bank' && paymentProvider !== 'atoa') {
      return res.status(400).json({ error: 'Pay by Bank requires Atoa to be configured as the payment provider.' });
    }
    const BACKEND_URL       = process.env.BACKEND_URL || 'http://localhost:3001';
    const FRONTEND_URL      = process.env.FRONTEND_URL || 'https://carenova.ai';

    const isThirdParty   = tc.payer_type === 'third_party';
    const recipientType  = isThirdParty ? 'cardholder' : 'patient';
    const recipientEmail = isThirdParty ? tc.cardholder_email : tc.patient_email;
    const recipientPhone = isThirdParty ? tc.cardholder_phone : tc.patient_phone;
    const recipientName  = isThirdParty ? tc.cardholder_name  : tc.patient_name;

    // Create payment link — provider selected from tenant profile (square | stripe)
    let linkUrl, paymentLinkId, linkProvider;
    try {
      const linkName = `${clinicDisplayName} — ${tc.treatment_description || 'Dental treatment'}`;
      if (paymentProvider === 'stripe') {
        const stripeResult = await createCheckoutSession({
          tenantId,
          caseId:      tc.id,
          amountPence: Math.round(Number(amount) * 100),
          name:        linkName,
          successUrl:  `${FRONTEND_URL}/payment-success`,
          cancelUrl:   `${FRONTEND_URL}/payment-cancelled`,
        });
        linkUrl       = stripeResult.url;
        paymentLinkId = stripeResult.sessionId;
        linkProvider  = 'stripe';
      } else if (paymentProvider === 'atoa') {
        const { createAtoaPaymentLink } = require('../utils/atoa');
        const atoaMethods = tc.payment_method === 'pay_by_bank' ? ['PAY_BY_BANK'] : ['CARD'];
        const atoaResult = await createAtoaPaymentLink({
          tenantId,
          caseId:         tc.id,
          amount:         Number(amount),   // POUND decimal — Atoa does NOT use pence
          currency:       'GBP',
          name:           recipientName,
          phone:          recipientPhone,
          email:          recipientEmail,
          notes:          `Case ${String(tc.id).slice(0, 8)}`,   // <=30 char Atoa limit
          redirectUrl:    process.env.APP_URL || undefined,
          paymentMethods: atoaMethods,
        });
        linkUrl       = atoaResult.url;
        paymentLinkId = atoaResult.paymentRequestId;
        linkProvider  = 'atoa';
      } else {
        const squareResult = await createPaymentLink(tenantId, {
          amount,
          caseId:      tc.id,
          patientName: tc.patient_name,
          description: linkName,
        });
        linkUrl       = squareResult.url;
        paymentLinkId = squareResult.paymentLinkId;
        linkProvider  = 'square';
      }
    } catch (providerErr) {
      console.error(`[Cases] ${paymentProvider} createPaymentLink error:`, providerErr.message, providerErr.stack);
      return res.status(502).json({ error: 'Could not generate payment link. Please try again.' });
    }

    const results = [];

    for (const channel of channels) {
      const result = { channel };

      if (channel === 'email') {
        if (!recipientEmail) {
          results.push({ channel, status: 'skipped', error: 'No email on file' });
          continue;
        }
        try {
          const link = await linkStore.createLinkRequest({
            tenantId, caseId: tc.id, leadId: tc.lead_id,
            kind: 'payment', recipient: recipientType, channel: 'email',
            targetUrl: linkUrl, provider: linkProvider, createdBy,
          });
          const trackingUrl = `${BACKEND_URL}/r/${link.short_token}`;
          await sendPaymentLinkEmail({
            to:                recipientEmail,
            tenantId,
            clinicDisplayName,
            patientName:       recipientName || tc.patient_name,
            amount,
            paymentUrl:        trackingUrl,
          });
          await linkStore.markSent(link.id);
          result.status = 'sent';
        } catch (err) {
          console.error('[Cases] send-payment-link email error:', err.message);
          result.status = 'failed';
          result.error  = err.message;
        }

      } else if (channel === 'sms') {
        if (!recipientPhone) {
          results.push({ channel, status: 'skipped', error: 'No phone on file' });
          continue;
        }
        try {
          const link = await linkStore.createLinkRequest({
            tenantId, caseId: tc.id, leadId: tc.lead_id,
            kind: 'payment', recipient: recipientType, channel: 'sms',
            targetUrl: linkUrl, provider: linkProvider, createdBy,
          });
          const trackingUrl = `${BACKEND_URL}/r/${link.short_token}`;
          const amountStr   = `€${Number(amount).toFixed(2)}`;
          const smsBody     = `${clinicDisplayName}: Pay ${amountStr} securely → ${trackingUrl}`;
          await sendSms(tenantId, recipientPhone, smsBody);
          await linkStore.markSent(link.id);
          result.status = 'sent';
        } catch (err) {
          console.error('[Cases] send-payment-link sms error:', err.message);
          result.status = 'failed';
          result.error  = err.message;
        }

      } else {
        result.status = 'skipped';
        result.error  = `Unknown channel: ${channel}`;
      }

      results.push(result);
    }

    res.json({ results, paymentLinkId });
  } catch (err) {
    console.error('[Cases] send-payment-link error:', err.message);
    res.status(500).json({ error: 'Failed to send payment link.' });
  }
});

// POST /api/cases/:id/send-agreement
// Creates a SignWell signature document from the appropriate docx template,
// sends signing links via SMS, and sets case status to 'awaiting_signature'.
router.post('/:id/send-agreement', ...requireRole(...CASE_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const apiKey = process.env.SIGNWELL_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'SIGNWELL_API_KEY not configured on this server.' });

    const tc = await caseStore.getCaseById(req.params.id, tenantId);
    if (!tc) return res.status(404).json({ error: 'Case not found.' });
    if (req.user.role === 'hasta_danismani' && tc.assigned_to !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    // Guard: if an existing SignWell document is already completed, refuse to create a new one
    if (tc.signwell_document_id) {
      try {
        const guardResp = await fetch(
          `https://www.signwell.com/api/v1/documents/${tc.signwell_document_id}`,
          { headers: { 'X-Api-Key': apiKey } },
        );
        if (guardResp.ok) {
          const guardMeta = await guardResp.json();
          if ((guardMeta.status || '').toLowerCase() === 'completed') {
            return res.status(409).json({
              error: 'This agreement has already been signed. Download it via "View Signed Agreement".',
            });
          }
        }
      } catch (guardErr) {
        console.warn('[Cases] send-agreement guard check failed (non-fatal):', guardErr.message);
      }
    }

    if (tc.payment_method === 'pay_by_bank') {
      return res.status(400).json({ error: 'Agreements are not yet available for Pay by Bank cases.' });
    }
    if (!['card', 'bank_transfer', 'finance'].includes(tc.payment_method)) {
      return res.status(400).json({ error: 'Agreements are only available for card, bank transfer, and finance cases.' });
    }

    // Prefer company info from the linked deal's billing entity; fall back to tenant profile.
    const { rows: entityRows } = await pool.query(
      `SELECT be.trading_name, be.legal_entity_name, be.contact_email
       FROM treatment_deals td
       JOIN billing_entities be ON be.id = td.billing_entity_id
       WHERE td.case_id = $1
       LIMIT 1`,
      [tc.id],
    );
    let requesterName, requesterEmail;
    if (entityRows[0]) {
      const be = entityRows[0];
      requesterName  = be.trading_name || be.legal_entity_name || 'Dentafly Clinic';
      requesterEmail = be.contact_email || req.user.email || 'noreply@carenova.ai';
    } else {
      const { rows: profileRows } = await pool.query(
        `SELECT trading_name, legal_entity_name, contact_email FROM tenant_billing_profiles WHERE tenant_id = $1`,
        [tenantId],
      );
      const profile  = profileRows[0];
      requesterName  = profile?.trading_name || profile?.legal_entity_name || 'Dentafly Clinic';
      requesterEmail = profile?.contact_email || req.user.email || 'noreply@carenova.ai';
    }
    const createdBy      = req.user.email || req.user.id;
    const BACKEND_URL    = process.env.BACKEND_URL || 'http://localhost:3001';

    // ── Template & recipients ────────────────────────────────────────────────
    let templateFileName, signwellRecipients, linkRecipients;

    if (tc.payment_method === 'bank_transfer' && tc.payer_type === 'third_party') {
      if (!tc.cardholder_name || !tc.cardholder_email) {
        return res.status(400).json({ error: 'Payer name and email are required for third-party bank transfer agreements.' });
      }
      if (!tc.patient_name || !tc.patient_email) {
        return res.status(400).json({ error: 'Patient name and email are required for third-party bank transfer agreements.' });
      }
      templateFileName   = 'Dentafly_BankTransferThirdParty_SignWell.docx';
      signwellRecipients = [
        { id: '1', name: tc.cardholder_name, email: tc.cardholder_email },
        { id: '2', name: tc.patient_name,    email: tc.patient_email    },
      ];
      linkRecipients = [
        { signerId: '1', recipientType: 'cardholder', name: tc.cardholder_name, phone: tc.cardholder_phone },
        { signerId: '2', recipientType: 'patient',    name: tc.patient_name,    phone: tc.patient_phone    },
      ];
    } else if (tc.payment_method === 'bank_transfer') {
      if (!tc.patient_name || !tc.patient_email) {
        return res.status(400).json({ error: 'Patient name and email are required for bank transfer agreements.' });
      }
      templateFileName   = 'Dentafly_BankTransfer_SignWell.docx';
      signwellRecipients = [
        { id: '1', name: tc.patient_name, email: tc.patient_email },
      ];
      linkRecipients = [
        { signerId: '1', recipientType: 'patient', name: tc.patient_name, phone: tc.patient_phone },
      ];
    } else if (tc.payment_method === 'finance' && tc.payer_type === 'third_party') {
      if (!tc.cardholder_name || !tc.cardholder_email) {
        return res.status(400).json({ error: 'Payer name and email are required for third-party finance agreements.' });
      }
      if (!tc.patient_name || !tc.patient_email) {
        return res.status(400).json({ error: 'Patient name and email are required for finance agreements.' });
      }
      templateFileName   = 'Dentafly_FinanceThirdParty_SignWell.docx';
      signwellRecipients = [
        { id: '1', name: tc.cardholder_name, email: tc.cardholder_email },
        { id: '2', name: tc.patient_name,    email: tc.patient_email    },
      ];
      linkRecipients = [
        { signerId: '1', recipientType: 'cardholder', name: tc.cardholder_name, phone: tc.cardholder_phone },
        { signerId: '2', recipientType: 'patient',    name: tc.patient_name,    phone: tc.patient_phone    },
      ];
    } else if (tc.payment_method === 'finance') {
      if (!tc.patient_name || !tc.patient_email) {
        return res.status(400).json({ error: 'Patient name and email are required for finance agreements.' });
      }
      templateFileName   = 'Dentafly_Finance_SignWell.docx';
      signwellRecipients = [
        { id: '1', name: tc.patient_name, email: tc.patient_email },
      ];
      linkRecipients = [
        { signerId: '1', recipientType: 'patient', name: tc.patient_name, phone: tc.patient_phone },
      ];
    } else if (tc.payer_type === 'third_party') {
      if (!tc.cardholder_name || !tc.cardholder_email) {
        return res.status(400).json({ error: 'Cardholder name and email are required for third-party agreements.' });
      }
      if (!tc.patient_name || !tc.patient_email) {
        return res.status(400).json({ error: 'Patient name and email are required for third-party agreements.' });
      }
      templateFileName    = 'Dentafly_ThirdParty_SignWell.docx';
      signwellRecipients  = [
        { id: '1', name: tc.cardholder_name, email: tc.cardholder_email },
        { id: '2', name: tc.patient_name,    email: tc.patient_email    },
      ];
      linkRecipients = [
        { signerId: '1', recipientType: 'cardholder', name: tc.cardholder_name, phone: tc.cardholder_phone },
        { signerId: '2', recipientType: 'patient',    name: tc.patient_name,    phone: tc.patient_phone    },
      ];
    } else {
      if (!tc.patient_name || !tc.patient_email) {
        return res.status(400).json({ error: 'Patient name and email are required for self-pay agreements.' });
      }
      templateFileName   = 'Dentafly_SelfPay_SignWell.docx';
      signwellRecipients = [
        { id: '1', name: tc.patient_name, email: tc.patient_email },
      ];
      linkRecipients = [
        { signerId: '1', recipientType: 'patient', name: tc.patient_name, phone: tc.patient_phone },
      ];
    }

    // ── Today's date (DD/MM/YYYY, no timezone shift) ─────────────────────────
    const [ty, tm, td] = new Date().toISOString().slice(0, 10).split('-');
    const agreementDate = `${td}/${tm}/${ty}`;

    const fmtGBP = v => v
      ? `€${Number(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '';

    // ── Placeholder data ─────────────────────────────────────────────────────
    const data = {
      case_reference:        'CASE-' + String(tc.id).slice(0, 8).toUpperCase(),
      agreement_date:        agreementDate,
      patient_name:          tc.patient_name          || '',
      patient_dob:           toUKDate(tc.patient_dob),
      patient_address:       tc.patient_address        || '',
      patient_phone:         tc.patient_phone          || '',
      patient_email:         tc.patient_email          || '',
      treatment_description: tc.treatment_description  || '',
      total_cost:            fmtGBP(tc.total_cost),
      amount_due:            fmtGBP(tc.amount_due),
      // payment_date / transaction_reference in both card+third_party and bank_transfer+third_party templates
      ...(tc.payer_type === 'third_party' ? { payment_date: '', transaction_reference: '' } : {}),
      cardholder_name:        tc.cardholder_name         || '',
      cardholder_relationship: tc.cardholder_relationship || '',
      cardholder_address:     tc.cardholder_address      || '',
      cardholder_phone:       tc.cardholder_phone        || '',
      cardholder_email:       tc.cardholder_email        || '',
      card_scheme:            tc.card_scheme             || '',
      card_first4:            tc.card_first4             || '',
      card_last4:             tc.card_last4              || '',
      photo_id:               [tc.photo_id_type, tc.photo_id_ref].filter(Boolean).join(' '),
    };

    // ── Fill template + create SignWell document ──────────────────────────────
    const fileBase64 = await fillTemplate(templateFileName, data);
    const isFinance     = tc.payment_method === 'finance';
    const isBankTransfer = tc.payment_method === 'bank_transfer';
    const swResult   = await createSignatureDocument({
      apiKey,
      fileBase64,
      fileName:      templateFileName,
      recipients:    signwellRecipients,
      metadata:      { case_id: tc.id, tenant_id: tc.tenant_id },
      requesterName,
      requesterEmail,
      subject:       (isBankTransfer || isFinance)
        ? 'Please sign: Treatment & Payment Confirmation'
        : 'Please sign: Card Payment Agreement',
      message:       (isBankTransfer || isFinance)
        ? `Please review and sign your treatment and payment confirmation for ${requesterName}.`
        : `Please review and sign the card payment agreement for your treatment at ${requesterName}.`,
    });

    // ── Persist link_requests + fire SMS per recipient ────────────────────────
    const responseLinks = [];
    for (const lr of linkRecipients) {
      const swRecip = swResult.recipients.find(r => r.id === lr.signerId);
      if (!swRecip?.signing_url) continue;

      const link = await linkStore.createLinkRequest({
        tenantId,
        caseId:              tc.id,
        leadId:              tc.lead_id,
        kind:                'signature',
        recipient:           lr.recipientType,
        channel:             'sms',
        targetUrl:           swRecip.signing_url,
        provider:            'signwell',
        createdBy,
        signwellDocumentId:  swResult.documentId,
      });
      await linkStore.markSent(link.id);

      const trackingUrl = `${BACKEND_URL}/r/${link.short_token}`;

      // SMS — fire-and-forget; failure doesn't block the response
      if (lr.phone) {
        const smsText = isBankTransfer
          ? `${requesterName}: Please sign your treatment & payment confirmation → ${trackingUrl}`
          : `${requesterName}: Please sign your card payment agreement → ${trackingUrl}`;
        sendSms(tenantId, lr.phone, smsText)
          .catch(e => console.error('[Cases] send-agreement SMS error:', e.message));
      }

      responseLinks.push({ recipient: lr.recipientType, signing_url: swRecip.signing_url });
    }

    // ── Persist SignWell document ID + update case status ────────────────────
    await pool.query(
      `UPDATE treatment_cases SET signwell_document_id = $1, updated_at = NOW() WHERE id = $2`,
      [swResult.documentId, tc.id],
    );
    await caseStore.updateCase(tc.id, tenantId, { status: 'awaiting_signature' });

    res.json({ ok: true, documentId: swResult.documentId, links: responseLinks });
  } catch (err) {
    console.error('[Cases] send-agreement error:', err.message);
    res.status(500).json({ error: 'Could not create the signature document. Please try again.' });
  }
});

// GET /api/cases/:id/signed-doc — fetch fresh signed PDF URL from SignWell
router.get('/:id/signed-doc', ...requireRole(...CASE_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const { rows } = await pool.query(
      `SELECT signwell_document_id, assigned_to FROM treatment_cases WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, tenantId],
    );
    if (!rows.length) return res.status(404).json({ error: 'Case not found.' });
    if (req.user.role === 'hasta_danismani' && rows[0].assigned_to !== req.user.sub) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    let documentId = rows[0].signwell_document_id;
    if (!documentId) return res.status(404).json({ error: 'No signed document available for this case.' });

    const apiKey = process.env.SIGNWELL_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'SIGNWELL_API_KEY not configured.' });

    // Check SignWell document status before attempting completed_pdf download.
    // If the current document is not completed, fall back to the most recent
    // completed signature link_request (handles re-send overwrite scenario).
    try {
      const metaResp = await fetch(`https://www.signwell.com/api/v1/documents/${documentId}`, {
        headers: { 'X-Api-Key': apiKey },
      });
      if (!metaResp.ok) {
        const text = await metaResp.text();
        console.warn(`[SignWell] metadata ${metaResp.status} for doc ${documentId}:`, text.slice(0, 200));
        return res.status(502).json({ error: 'Could not retrieve document status from SignWell.' });
      }
      const meta = await metaResp.json();
      const swStatus = (meta.status || '').toLowerCase();
      if (swStatus && swStatus !== 'completed') {
        // Try to find a completed document from a previous send-agreement via link_requests
        const { rows: linkRows } = await pool.query(
          `SELECT signwell_document_id FROM link_requests
           WHERE case_id = $1 AND kind = 'signature' AND status = 'completed'
             AND signwell_document_id IS NOT NULL
           ORDER BY created_at DESC LIMIT 1`,
          [req.params.id],
        );
        if (linkRows[0]?.signwell_document_id) {
          documentId = linkRows[0].signwell_document_id;
          console.log('[SignWell] using completed document from link_requests:', documentId);
        } else {
          return res.status(422).json({
            error: 'Document has not been signed by all parties yet.',
            signwellStatus: meta.status,
          });
        }
      }
    } catch (probeErr) {
      console.warn('[SignWell] metadata probe error:', probeErr.message);
    }

    const url = await getDocumentDownloadUrl(apiKey, documentId);
    res.json({ url });
  } catch (err) {
    console.error('[Cases] signed-doc error:', err.message);
    res.status(502).json({ error: 'Could not retrieve signed document from SignWell.' });
  }
});

module.exports = router;

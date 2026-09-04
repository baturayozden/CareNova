const { Router } = require('express');
const { pool }   = require('../db/index');
const { requireRole }         = require('../middleware/auth');
const { nextInvoiceNumber }   = require('../services/invoiceNumber');
const { generateInvoicePdf }  = require('../services/invoicePdf');
const { sendInvoiceEmail, getTenantBrand } = require('../utils/email');
const { createLead, normalizePhone } = require('../services/leadStore');

const router = Router();

// Validate and normalise an invoice date string.
// Returns a YYYY-MM-DD string, or null if raw is falsy.
// Throws with .statusCode = 400 if the date is in the future or malformed.
function parseIssuedAt(raw) {
  if (!raw) return null;
  const d = String(raw).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const err = new Error('Invalid date format — use YYYY-MM-DD');
    err.statusCode = 400;
    throw err;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (d > today) {
    const err = new Error('Invoice date cannot be in the future');
    err.statusCode = 400;
    throw err;
  }
  return d;
}

// All routes require at least one of these roles (plus authenticate on mount)
const CAN_INVOICE = requireRole(
  'super_admin', 'admin', 'director', 'clinic_admin', 'treatment_coordinator', 'sales',
);

// ── Resolve or create lead for manual invoices ───────────────────────────────
// Returns a lead id (string) or null. Never throws — errors are logged.
// Phone → try createLead; on DUPLICATE_PHONE → find existing by phone.
// No phone but email → find existing by email only (no creation without phone).
// Neither → null (some invoices have no contact info).

async function resolveLeadId(tenantId, { patientPhone, patientEmail, patientName }) {
  const normPhone = patientPhone ? normalizePhone(patientPhone) : null;
  const email     = patientEmail || null;

  if (normPhone) {
    try {
      const [firstName, ...rest] = (patientName || 'Unknown').split(' ');
      const lead = await createLead({
        tenantId,
        firstName: firstName || 'Unknown',
        lastName:  rest.join(' '),
        phone:     normPhone,
        email,
        source:               'invoice',
        aiFollowUpEnabled:    false,
        gdprConsentGiven:     false,
      });
      return lead.id;
    } catch (err) {
      if (err.code === 'DUPLICATE_PHONE') {
        const { rows } = await pool.query(
          'SELECT id FROM leads WHERE tenant_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1',
          [tenantId, normPhone],
        );
        return rows[0]?.id || null;
      }
      throw err;
    }
  }

  if (email) {
    const { rows } = await pool.query(
      'SELECT id FROM leads WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL LIMIT 1',
      [tenantId, email],
    );
    return rows[0]?.id || null;
  }

  return null;
}

// ── VAT helper (inclusive 20%) ────────────────────────────────────────────────
// Total = Net + VAT.  Net = Total / 1.20.  VAT = Total − Net.
// Pence-level rounding so Net + VAT always equals Total exactly.

function computeVat(amount) {
  const totalPence = Math.round(parseFloat(amount) * 100);
  const netPence   = Math.round(totalPence / 1.20);
  const vatPence   = totalPence - netPence;
  return {
    netAmount: (netPence / 100).toFixed(2),
    vatAmount: (vatPence / 100).toFixed(2),
  };
}

// ── Shared: fetch billing profile + tenant ────────────────────────────────────

async function fetchBillingContext(tenantId) {
  const [bpRows, tenantRows, vatRows] = await Promise.all([
    pool.query('SELECT * FROM tenant_billing_profiles WHERE tenant_id = $1', [tenantId]),
    pool.query('SELECT id, name, logo_url FROM tenants WHERE id = $1', [tenantId]),
    // Pick the first billing entity with a VAT number (used by PDF when vat_applied=true)
    pool.query(
      'SELECT vat_number FROM billing_entities WHERE tenant_id = $1 AND vat_number IS NOT NULL LIMIT 1',
      [tenantId],
    ),
  ]);
  const billingProfile = bpRows.rows[0] || {};
  if (vatRows.rows[0]?.vat_number) billingProfile.vat_number = vatRows.rows[0].vat_number;
  return { billingProfile, tenant: tenantRows.rows[0] || {} };
}

// ── Shared: send invoice email + stamp sent_at ────────────────────────────────

async function emailInvoice(invoice, billingProfile, tenant, tenantId, pdfBuffer) {
  const brand = await getTenantBrand(tenantId);
  await sendInvoiceEmail({
    to:            invoice.patient_email,
    invoiceNumber: invoice.invoice_number,
    amount:        invoice.amount,
    clinicName:    billingProfile.trading_name || tenant.name,
    pdfBuffer,
    brand,
  });
  await pool.query('UPDATE invoices SET sent_at = now() WHERE id = $1', [invoice.id]);
  invoice.sent_at = new Date();
}

// ── POST / — create invoice (finalized OR draft) ──────────────────────────────
//
// Mode a (from treatment case): { caseId, paymentStatus, paymentMethod, sendEmail, saveAsDraft }
// Mode b (manual):              { patientName, patientEmail, patientAddress,
//                                 treatmentDescription, amount, paymentStatus,
//                                 paymentMethod, leadId?, sendEmail, saveAsDraft }
//
// saveAsDraft:true  → status='draft', no invoice_number, no email (return invoice only)
// saveAsDraft:false → status='finalized', assign number in transaction, send email if requested

router.post('/', CAN_INVOICE, async (req, res) => {
  const tenantId = req.user.tenantId;
  const {
    caseId,
    patientName, patientEmail, patientAddress, patientPhone, treatmentDescription, amount,
    paymentStatus = 'unpaid',
    paymentMethod,
    leadId,
    sendEmail: wantEmail,
    saveAsDraft = false,
    issuedAt,
    vatApplied = false,
  } = req.body;

  let parsedIssuedAt;
  try { parsedIssuedAt = parseIssuedAt(issuedAt); }
  catch (err) { return res.status(err.statusCode || 400).json({ error: err.message }); }

  let data = {};

  if (caseId) {
    const { rows } = await pool.query(
      `SELECT patient_name, patient_email, patient_address, patient_phone,
              treatment_description, amount_due, payment_method, lead_id
       FROM treatment_cases
       WHERE id = $1 AND tenant_id = $2`,
      [caseId, tenantId],
    );
    if (!rows.length) return res.status(404).json({ error: 'Case not found' });
    const c = rows[0];
    data = {
      patientName:          c.patient_name,
      patientEmail:         c.patient_email,
      patientAddress:       c.patient_address,
      treatmentDescription: c.treatment_description,
      amount:               c.amount_due,
      paymentMethod:        paymentMethod || c.payment_method,
      leadId:               c.lead_id,
      patientPhone:         c.patient_phone,
    };
  } else {
    if (!saveAsDraft && (!patientName || !amount)) {
      return res.status(400).json({ error: 'patientName and amount are required' });
    }
    data = { patientName, patientEmail, patientAddress, patientPhone, treatmentDescription, amount, paymentMethod, leadId };

    // Resolve / create lead for manual invoices (non-blocking — fatura başarısını etkilemez)
    try {
      data.leadId = await resolveLeadId(tenantId, data);
    } catch (err) {
      console.error('[invoices] lead resolve error (non-fatal):', err.message);
    }
  }

  // ── Draft path (no transaction needed — no counter) ──────────────────────────
  if (saveAsDraft) {
    try {
      const draftAmt = data.amount ? parseFloat(data.amount) : null;
      const { netAmount: draftNet, vatAmount: draftVat } = draftAmt && vatApplied
        ? computeVat(draftAmt)
        : { netAmount: null, vatAmount: null };

      const { rows: invRows } = await pool.query(
        `INSERT INTO invoices
           (tenant_id, case_id, lead_id,
            patient_name, patient_email, patient_address, patient_phone,
            treatment_description, amount, payment_method, payment_status, status, issued_at,
            vat_applied, vat_rate, vat_amount, net_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12,$13,$14,$15,$16)
         RETURNING *`,
        [
          tenantId,
          caseId || null, data.leadId || null,
          data.patientName || null, data.patientEmail || null, data.patientAddress || null, data.patientPhone || null,
          data.treatmentDescription || null,
          draftAmt,
          data.paymentMethod || null, paymentStatus,
          parsedIssuedAt,
          !!vatApplied, vatApplied ? 20 : null, draftVat, draftNet,
        ],
      );
      return res.status(201).json({ invoice: invRows[0] });
    } catch (err) {
      console.error('[invoices] draft create error:', err);
      return res.status(500).json({ error: 'Failed to save draft' });
    }
  }

  // ── Finalized path (transaction: number + insert) ─────────────────────────────
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceNumber = await nextInvoiceNumber(client, tenantId);

    const finalAmt = parseFloat(data.amount);
    const { netAmount: finalNet, vatAmount: finalVat } = vatApplied
      ? computeVat(finalAmt)
      : { netAmount: null, vatAmount: null };

    const { rows: invRows } = await client.query(
      `INSERT INTO invoices
         (tenant_id, invoice_number, case_id, lead_id,
          patient_name, patient_email, patient_address, patient_phone,
          treatment_description, amount, payment_method, payment_status, status, issued_at,
          vat_applied, vat_rate, vat_amount, net_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'finalized',COALESCE($13::date,now()),$14,$15,$16,$17)
       RETURNING *`,
      [
        tenantId, invoiceNumber,
        caseId || null, data.leadId || null,
        data.patientName, data.patientEmail || null, data.patientAddress || null, data.patientPhone || null,
        data.treatmentDescription || null, finalAmt,
        data.paymentMethod || null, paymentStatus,
        parsedIssuedAt,
        !!vatApplied, vatApplied ? 20 : null, finalVat, finalNet,
      ],
    );

    await client.query('COMMIT');

    const invoice = invRows[0];
    const { billingProfile, tenant } = await fetchBillingContext(tenantId);
    const pdfBuffer = await generateInvoicePdf(invoice, billingProfile, tenant);

    if (wantEmail && invoice.patient_email) {
      await emailInvoice(invoice, billingProfile, tenant, tenantId, pdfBuffer);
    }

    res.status(201).json({ invoice, pdfBase64: pdfBuffer.toString('base64') });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[invoices] create error:', err);
    res.status(500).json({ error: 'Failed to create invoice' });
  } finally {
    client.release();
  }
});

// ── PATCH /:id — edit invoice fields ─────────────────────────────────────────
// Draft: all fields editable.
// Finalized: only issuedAt, paymentStatus, paymentMethod may change.
//            invoice_number, amount, patient_*, treatment_description are immutable.

const FINALIZED_ALLOWED = new Set(['issuedAt', 'paymentStatus', 'paymentMethod']);
const VALID_PAY_STATUS  = new Set(['paid', 'unpaid']);
const VALID_PAY_METHOD  = new Set(['card', 'bank_transfer', 'finance']);

router.patch('/:id', CAN_INVOICE, async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id }   = req.params;

  const { rows } = await pool.query(
    'SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2',
    [id, tenantId],
  );
  if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });

  const existing = rows[0];

  // ── Finalized: only date + payment details may change ─────────────────────
  if (existing.status === 'finalized') {
    const forbidden = Object.keys(req.body).filter(k => !FINALIZED_ALLOWED.has(k));
    if (forbidden.length > 0) {
      return res.status(403).json({ error: 'Only the invoice date and payment details can be changed on a finalized invoice. Amount and patient details are locked.' });
    }

    const { issuedAt, paymentStatus, paymentMethod } = req.body;

    if (paymentStatus !== undefined && !VALID_PAY_STATUS.has(paymentStatus)) {
      return res.status(400).json({ error: 'paymentStatus must be paid or unpaid.' });
    }
    if (paymentMethod !== undefined && !VALID_PAY_METHOD.has(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be card, bank_transfer, or finance.' });
    }

    let parsedDate;
    if (issuedAt !== undefined) {
      try { parsedDate = parseIssuedAt(issuedAt); }
      catch (err) { return res.status(err.statusCode || 400).json({ error: err.message }); }
    }

    const { rows: updated } = await pool.query(
      `UPDATE invoices
          SET issued_at      = COALESCE($1::date, issued_at),
              payment_status = COALESCE($2, payment_status),
              payment_method = COALESCE($3, payment_method)
        WHERE id = $4 AND tenant_id = $5
        RETURNING *`,
      [
        parsedDate !== undefined ? parsedDate : null,
        paymentStatus ?? null,
        paymentMethod ?? null,
        id, tenantId,
      ],
    );
    return res.json({ invoice: updated[0] });
  }

  // ── Draft: all fields editable ─────────────────────────────────────────────
  const {
    patientName, patientEmail, patientAddress, patientPhone, treatmentDescription,
    amount, paymentMethod, paymentStatus, issuedAt, vatApplied,
  } = req.body;

  let parsedDate;
  if (issuedAt !== undefined) {
    try { parsedDate = parseIssuedAt(issuedAt); }
    catch (err) { return res.status(err.statusCode || 400).json({ error: err.message }); }
  }

  const newAmount     = amount !== undefined ? parseFloat(amount) : parseFloat(existing.amount);
  const newVatApplied = vatApplied !== undefined ? !!vatApplied : !!existing.vat_applied;
  const { netAmount: patchNet, vatAmount: patchVat } = newVatApplied
    ? computeVat(newAmount)
    : { netAmount: null, vatAmount: null };

  const { rows: updated } = await pool.query(
    `UPDATE invoices SET
       patient_name          = $1,
       patient_email         = $2,
       patient_address       = $3,
       patient_phone         = $4,
       treatment_description = $5,
       amount                = $6,
       payment_method        = $7,
       payment_status        = $8,
       issued_at             = COALESCE($9::date, issued_at),
       vat_applied           = $10,
       vat_rate              = $11,
       vat_amount            = $12,
       net_amount            = $13
     WHERE id = $14 AND tenant_id = $15
     RETURNING *`,
    [
      patientName          ?? existing.patient_name,
      patientEmail         ?? existing.patient_email,
      patientAddress       ?? existing.patient_address,
      patientPhone !== undefined ? patientPhone : existing.patient_phone,
      treatmentDescription ?? existing.treatment_description,
      newAmount,
      paymentMethod        ?? existing.payment_method,
      paymentStatus        ?? existing.payment_status,
      parsedDate !== undefined ? parsedDate : null,
      newVatApplied, newVatApplied ? 20 : null, patchVat, patchNet,
      id, tenantId,
    ],
  );

  res.json({ invoice: updated[0] });
});

// ── POST /:id/finalize — promote draft to finalized ───────────────────────────
// Assigns invoice number atomically (transaction), optionally emails patient.

router.post('/:id/finalize', CAN_INVOICE, async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id }   = req.params;
  const { sendEmail: wantEmail, issuedAt: finalizeIssuedAt } = req.body;

  let parsedFinalizeDate;
  try { parsedFinalizeDate = parseIssuedAt(finalizeIssuedAt); }
  catch (err) { return res.status(err.statusCode || 400).json({ error: err.message }); }

  const { rows } = await pool.query(
    'SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2',
    [id, tenantId],
  );
  if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
  if (rows[0].status !== 'draft') {
    return res.status(400).json({ error: 'Invoice is already finalized' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoiceNumber = await nextInvoiceNumber(client, tenantId);

    const { rows: updated } = await client.query(
      `UPDATE invoices
       SET invoice_number = $1, status = 'finalized', issued_at = COALESCE($4::date, now())
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [invoiceNumber, id, tenantId, parsedFinalizeDate],
    );

    await client.query('COMMIT');

    const invoice = updated[0];
    const { billingProfile, tenant } = await fetchBillingContext(tenantId);
    const pdfBuffer = await generateInvoicePdf(invoice, billingProfile, tenant);

    if (wantEmail && invoice.patient_email) {
      await emailInvoice(invoice, billingProfile, tenant, tenantId, pdfBuffer);
    }

    res.json({ invoice, pdfBase64: pdfBuffer.toString('base64') });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[invoices] finalize error:', err);
    res.status(500).json({ error: 'Failed to finalize invoice' });
  } finally {
    client.release();
  }
});

// ── GET / — list invoices for tenant ─────────────────────────────────────────
//
// Query params: ?leadId= ?status=draft|paid|unpaid ?paymentMethod=card|bank_transfer|finance ?from=YYYY-MM-DD ?to= ?search=

router.get('/', CAN_INVOICE, async (req, res) => {
  const EMPTY_SUMMARY = { paidLast30: 0, unpaidCount: 0, unpaidTotal: 0, draftCount: 0 };
  const tenantId = req.user.tenantId;
  const { leadId, status, paymentMethod, from, to, search } = req.query;

  const conditions = ['i.tenant_id = $1', 'i.deleted_at IS NULL'];
  const params     = [tenantId];

  if (leadId) conditions.push(`i.lead_id = $${params.push(leadId)}`);

  // status filter: 'draft' uses status column; 'paid'/'unpaid' use payment_status on finalized rows
  if (status === 'draft') {
    conditions.push(`i.status = 'draft'`);
  } else if (status) {
    conditions.push(`i.payment_status = $${params.push(status)} AND i.status = 'finalized'`);
  }

  if (paymentMethod) conditions.push(`i.payment_method = $${params.push(paymentMethod)}`);
  if (from) conditions.push(`i.issued_at >= $${params.push(from)}`);
  if (to)   conditions.push(`i.issued_at <  $${params.push(to + 'T23:59:59Z')}`);
  if (search) {
    const q = `%${search.toLowerCase()}%`;
    // COALESCE handles NULL invoice_number on drafts
    conditions.push(
      `(lower(i.patient_name) LIKE $${params.push(q)} OR lower(COALESCE(i.invoice_number,'')) LIKE $${params.push(q)})`,
    );
  }

  try {
    const [invoicesRes, summaryRes] = await Promise.all([
      pool.query(
        `SELECT i.id, i.invoice_number, i.patient_name, i.patient_email,
                i.patient_address, i.patient_phone,
                i.treatment_description, i.amount, i.payment_status, i.payment_method,
                i.status, i.issued_at, i.sent_at, i.case_id, i.lead_id,
                i.vat_applied, i.vat_rate, i.vat_amount, i.net_amount
         FROM invoices i
         WHERE ${conditions.join(' AND ')}
         ORDER BY i.created_at DESC`,
        params,
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (
             WHERE payment_status = 'paid' AND status = 'finalized'
               AND issued_at >= now() - interval '30 days'), 0)   AS "paidLast30",
           COUNT(*)  FILTER (WHERE payment_status = 'unpaid' AND status = 'finalized') AS "unpaidCount",
           COALESCE(SUM(amount) FILTER (
             WHERE payment_status = 'unpaid' AND status = 'finalized'), 0)  AS "unpaidTotal",
           COUNT(*)  FILTER (WHERE status = 'draft')              AS "draftCount"
         FROM invoices
         WHERE tenant_id = $1 AND deleted_at IS NULL`,
        [tenantId],
      ),
    ]);

    const s = summaryRes.rows[0] || {};
    res.json({
      invoices: invoicesRes.rows,
      summary: {
        paidLast30:  parseFloat(s.paidLast30)  || 0,
        unpaidCount: parseInt(s.unpaidCount, 10) || 0,
        unpaidTotal: parseFloat(s.unpaidTotal) || 0,
        draftCount:  parseInt(s.draftCount,  10) || 0,
      },
    });
  } catch (err) {
    console.error('[invoices] list error:', err.message);
    res.json({ invoices: [], summary: EMPTY_SUMMARY });
  }
});

// ── DELETE /:id — delete a draft invoice ────────────────────────────────────
// Finalized invoices are protected from deletion (accounting integrity).

router.delete('/:id', CAN_INVOICE, async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id }   = req.params;

  const { rows } = await pool.query(
    'SELECT status FROM invoices WHERE id = $1 AND tenant_id = $2',
    [id, tenantId],
  );
  if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
  if (rows[0].status !== 'draft') {
    return res.status(403).json({ error: 'Only draft invoices can be deleted' });
  }

  await pool.query('DELETE FROM invoices WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  res.json({ ok: true });
});

// ── GET /:id/pdf — re-generate and stream PDF ─────────────────────────────────

router.get('/:id/pdf', CAN_INVOICE, async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id }   = req.params;

  const { rows } = await pool.query(
    'SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2',
    [id, tenantId],
  );
  if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });

  const invoice = rows[0];
  const { billingProfile, tenant } = await fetchBillingContext(tenantId);
  const pdfBuffer = await generateInvoicePdf(invoice, billingProfile, tenant);

  const filename = invoice.invoice_number
    ? `${invoice.invoice_number}.pdf`
    : `draft-${invoice.id.slice(0, 8)}.pdf`;

  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `inline; filename="${filename}"`,
    'Content-Length':      pdfBuffer.length,
  });
  res.send(pdfBuffer);
});

module.exports = router;

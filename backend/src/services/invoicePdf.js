const PDFDocument = require('pdfkit');
const https = require('https');
const http  = require('http');

// ── Brand colours — change here to retheme all invoices ──────────────────────
const COLORS = {
  accent: '#1a2540',   // deep navy — "INVOICE" heading, divider, Total row
  dark:   '#0f1b32',   // darkest text (patient name, amounts)
  body:   '#374151',   // normal body text
  muted:  '#6b7280',   // secondary / meta text
  label:  '#9ca3af',   // tiny ALL-CAPS labels ("FROM", "BILL TO", table header)
  line:   '#e5e7eb',   // hairlines, table borders, footer rule
  paid:   '#15803d',   // PAID badge outline + text
  unpaid: '#b45309',   // UNPAID badge outline + text
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts) {
  const d = ts ? new Date(ts) : new Date();
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatGBP(amount) {
  const n = parseFloat(amount) || 0;
  const [int, dec] = n.toFixed(2).split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `€${intFmt}.${dec}`;   // € with thousands separator
}

function fetchImageBuffer(url) {
  return new Promise(resolve => {
    if (!url) return resolve(null);
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 5000 }, res => {
      if (res.statusCode !== 200) return resolve(null);
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error',   () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Generate a clean, professional UK-standard VAT-exempt dental invoice.
 * White background, brand-forward, Square-style layout.
 *
 * @param {object} invoice         - row from invoices table
 * @param {object} billingProfile  - row from tenant_billing_profiles
 * @param {object} tenant          - { name, logo_url } from tenants
 * @returns {Promise<Buffer>}
 */
async function generateInvoicePdf(invoice, billingProfile, tenant) {
  const logoBuffer = await fetchImageBuffer(tenant?.logo_url || null);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });

    const chunks = [];
    doc.on('data',  c => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L  = 50;          // left margin
    const R  = 545;         // right edge
    const W  = R - L;       // content width = 495

    // ── HEADER ────────────────────────────────────────────────────────────────
    let y = 48;

    // Logo — left side, up to 150 × 60 px
    let logoPrintedH = 0;
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, L - 8, y, { width: 150 });
        logoPrintedH = 58;
      } catch {
        logoPrintedH = 0;
      }
    }

    // Legal entity name below logo (muted, small)
    const legalLine = billingProfile?.legal_entity_name || tenant?.name || '';
    if (legalLine) {
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
        .text(legalLine, L, y + logoPrintedH + (logoPrintedH > 0 ? 5 : 0),
          { width: 200, lineBreak: false });
    }

    // "INVOICE" — right-aligned, prominent
    doc.font('Helvetica-Bold').fontSize(30).fillColor(COLORS.accent)
      .text('INVOICE', L, y, { width: W, align: 'right', lineBreak: false });

    // Invoice meta — right-aligned, below heading
    let metaY = y + 42;
    const metaRight = { width: W, align: 'right', lineBreak: false };
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted);
    doc.text(`Invoice No:  ${invoice.invoice_number || '—'}`, L, metaY, metaRight);
    metaY += 13;
    doc.text(`Date:  ${formatDate(invoice.issued_at)}`, L, metaY, metaRight);

    // Thin accent divider
    const divY = Math.max(y + logoPrintedH + 22, metaY + 20);
    doc.moveTo(L, divY).lineTo(R, divY)
      .strokeColor(COLORS.accent).lineWidth(1.5).stroke();

    // ── FROM / BILL TO ────────────────────────────────────────────────────────
    y = divY + 22;

    const COL2  = L + 260;      // right column start
    const COL1W = COL2 - L - 20;
    const COL2W = R - COL2;

    // — FROM (left) —
    let fromY = y;
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.label)
      .text('FROM', L, fromY, { lineBreak: false });
    fromY += 13;

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.dark)
      .text(billingProfile?.legal_entity_name || tenant?.name || '—', L, fromY,
        { width: COL1W, lineBreak: false });
    fromY += 13;

    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.body);
    (billingProfile?.registered_address || '')
      .split(',').map(s => s.trim()).filter(Boolean)
      .forEach(line => {
        doc.text(line, L, fromY, { width: COL1W, lineBreak: false });
        fromY += 12;
      });
    if (billingProfile?.contact_phone) {
      doc.text(`T: ${billingProfile.contact_phone}`, L, fromY, { width: COL1W, lineBreak: false });
      fromY += 12;
    }
    if (billingProfile?.contact_email) {
      doc.text(billingProfile.contact_email, L, fromY, { width: COL1W, lineBreak: false });
      fromY += 12;
    }

    // — BILL TO (right) —
    let billY = y;
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.label)
      .text('BILL TO', COL2, billY, { lineBreak: false });
    billY += 13;

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.dark)
      .text(invoice.patient_name || '—', COL2, billY,
        { width: COL2W, lineBreak: false });
    billY += 13;

    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.body);
    if (invoice.patient_address) {
      invoice.patient_address.split(',').map(s => s.trim()).filter(Boolean)
        .forEach(line => {
          doc.text(line, COL2, billY, { width: COL2W, lineBreak: false });
          billY += 12;
        });
    }
    if (invoice.patient_phone) {
      doc.text(invoice.patient_phone, COL2, billY, { width: COL2W, lineBreak: false });
      billY += 12;
    }
    if (invoice.patient_email) {
      doc.text(invoice.patient_email, COL2, billY, { width: COL2W, lineBreak: false });
      billY += 12;
    }

    // ── LINE ITEMS TABLE ──────────────────────────────────────────────────────
    y = Math.max(fromY, billY) + 28;

    // Column geometry
    const AMOUNT_COL_W = 90;
    const AMOUNT_X     = R - AMOUNT_COL_W;
    const DESC_W       = AMOUNT_X - L - 10;

    // Table header row — labels only, bottom rule
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.label)
      .text('DESCRIPTION', L, y, { width: DESC_W, lineBreak: false });
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.label)
      .text('AMOUNT', AMOUNT_X, y, { width: AMOUNT_COL_W, align: 'right', lineBreak: false });
    y += 13;
    doc.moveTo(L, y).lineTo(R, y).strokeColor(COLORS.line).lineWidth(0.5).stroke();
    y += 10;

    // Single line item (pdfkit cursor-safe approach)
    const descText = invoice.treatment_description || 'Dental treatment';
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.body)
      .text(descText, L, y, { width: DESC_W, lineBreak: true });
    const descEndY = doc.y;    // capture AFTER drawing description (may have wrapped)

    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.dark)
      .text(formatGBP(invoice.amount), AMOUNT_X, y,
        { width: AMOUNT_COL_W, align: 'right', lineBreak: false });

    y = Math.max(descEndY, y + 14) + 10;
    doc.moveTo(L, y).lineTo(R, y).strokeColor(COLORS.line).lineWidth(0.5).stroke();
    y += 18;

    // ── TOTALS (right-aligned two-column block) ───────────────────────────────
    const TOT_LABEL_X = 375;
    const TOT_LABEL_W = AMOUNT_X - TOT_LABEL_X - 8;

    const vatApplied = !!invoice.vat_applied;

    if (vatApplied) {
      // Net (ex. VAT)
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
        .text('Net (ex. VAT)', TOT_LABEL_X, y, { width: TOT_LABEL_W, lineBreak: false });
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
        .text(formatGBP(invoice.net_amount), AMOUNT_X, y,
          { width: AMOUNT_COL_W, align: 'right', lineBreak: false });
      y += 14;

      // VAT (20%)
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
        .text('VAT (20%)', TOT_LABEL_X, y, { width: TOT_LABEL_W, lineBreak: false });
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
        .text(formatGBP(invoice.vat_amount), AMOUNT_X, y,
          { width: AMOUNT_COL_W, align: 'right', lineBreak: false });
      y += 14;
    } else {
      // VAT-exempt line
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
        .text('VAT (0%)', TOT_LABEL_X, y, { width: TOT_LABEL_W, lineBreak: false });
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
        .text('€0.00', AMOUNT_X, y, { width: AMOUNT_COL_W, align: 'right', lineBreak: false });
      y += 14;
    }

    // Thin divider above Total
    doc.moveTo(TOT_LABEL_X, y - 2).lineTo(R, y - 2)
      .strokeColor(COLORS.line).lineWidth(0.5).stroke();

    // Total
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.dark)
      .text('Total', TOT_LABEL_X, y, { width: TOT_LABEL_W, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.dark)
      .text(formatGBP(invoice.amount), AMOUNT_X, y,
        { width: AMOUNT_COL_W, align: 'right', lineBreak: false });
    y += 24;

    // VAT note
    if (vatApplied) {
      const vatNum = billingProfile?.vat_number ? `VAT No. ${billingProfile.vat_number}` : '';
      if (vatNum) {
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
          .text(vatNum, L, y, { width: W * 0.75, lineBreak: false });
        y += 24;
      }
    } else {
      doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(COLORS.label)
        .text(
          'Dental services are exempt from VAT (VATA 1994, Group 7, Schedule 9).',
          L, y, { width: W * 0.75, lineBreak: false },
        );
      y += 24;
    }

    // ── PAYMENT STATUS BADGE ──────────────────────────────────────────────────
    const isPaid      = (invoice.payment_status || '').toLowerCase() === 'paid';
    const badgeColor  = isPaid ? COLORS.paid : COLORS.unpaid;
    const badgeLabel  = isPaid ? 'PAID' : 'UNPAID';
    const badgeW      = 54;
    const badgeH      = 18;

    // Outlined rectangle badge (no fill — clean minimal look)
    doc.rect(L, y, badgeW, badgeH).strokeColor(badgeColor).lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(badgeColor)
      .text(badgeLabel, L, y + 5, { width: badgeW, align: 'center', lineBreak: false });

    const methodMap = { card: 'Card', bank_transfer: 'Bank Transfer', finance: 'Finance' };
    const methodLabel = methodMap[invoice.payment_method] || invoice.payment_method || '';
    if (methodLabel) {
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
        .text(`Payment method: ${methodLabel}`, L + badgeW + 14, y + 4, { lineBreak: false });
    }
    y += badgeH + 20;

    // ── BANK DETAILS (unpaid invoices only) ───────────────────────────────────
    if (!isPaid && billingProfile?.bank_name) {
      doc.moveTo(L, y).lineTo(R, y).strokeColor(COLORS.line).lineWidth(0.5).stroke();
      y += 14;

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.body)
        .text('Payment details', L, y, { lineBreak: false });
      y += 13;

      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted);
      [
        billingProfile.bank_name         && `Bank: ${billingProfile.bank_name}`,
        billingProfile.bank_account_name && `Account name: ${billingProfile.bank_account_name}`,
        billingProfile.sort_code         && `Sort code: ${billingProfile.sort_code}`,
        billingProfile.account_number    && `Account number: ${billingProfile.account_number}`,
        billingProfile.iban              && `IBAN: ${billingProfile.iban}`,
        invoice.invoice_number           && `Reference: ${invoice.invoice_number}`,
      ].filter(Boolean).forEach(line => {
        doc.text(line, L, y, { width: W / 2, lineBreak: false }); y += 12;
      });
    }

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const footerY = 800;
    doc.moveTo(L, footerY).lineTo(R, footerY)
      .strokeColor(COLORS.line).lineWidth(0.5).stroke();

    const coNum = billingProfile?.company_number
      ? ` · Company No. ${billingProfile.company_number}` : '';
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.label)
      .text(
        `${legalLine}${coNum} · Registered in England and Wales`,
        L, footerY + 9, { width: W * 0.7, lineBreak: false },
      );
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.label)
      .text('Powered by CareNova', L, footerY + 9,
        { width: W, align: 'right', lineBreak: false });

    doc.end();
  });
}

module.exports = { generateInvoicePdf };

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// One-off Square CSV → invoices import for Vestadent.
// Only imports Status='Paid' rows; skips Draft and blank-status rows.
// Idempotent: aborts if any invoices already exist for this tenant.
//
// Usage:
//   DATABASE_URL=postgres://... node backend/scripts/importSquareInvoices.js

const fs   = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { pool }            = require('../src/db/index');
const { nextInvoiceNumber } = require('../src/services/invoiceNumber');

const TENANT_ID = '682ba358-434a-4126-a558-90d2ead67979';
const CSV_PATH  = path.join(__dirname, 'square-invoices.csv');

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanName(raw) {
  if (!raw) return null;
  // Strip leading/trailing commas and whitespace (Square bug: ",LAUREN..." or ", GILLIAN...")
  return raw.replace(/^[,\s]+|[,\s]+$/g, '').trim() || null;
}

function parseAmount(raw) {
  if (!raw) return null;
  // "£3,500.00" → 3500.00   |   "£2,350.08" → 2350.08
  const cleaned = raw.replace(/[£,]/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseInvoiceId(raw) {
  // "#000001" → 1 (for sorting ascending = oldest first)
  const m = raw && raw.match(/#(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseDate(raw) {
  // "2026-06-17" → Date object (validate it's a real date)
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  const d = new Date(raw.trim() + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Parse CSV
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parse(raw, {
    columns:          true,
    skip_empty_lines: true,
    trim:             true,
    relax_quotes:     true,
    relax_column_count: true,
  });

  // 2. Filter: Paid only; sort ascending by Invoice Date then Invoice ID number (oldest → newest)
  const paidRows = records
    .filter(r => (r['Status'] || '').trim() === 'Paid')
    .sort((a, b) => {
      const dateDiff = (a['Invoice Date'] || '').localeCompare(b['Invoice Date'] || '');
      if (dateDiff !== 0) return dateDiff;
      return parseInvoiceId(a['Invoice ID']) - parseInvoiceId(b['Invoice ID']);
    });

  const skipped = records.length - paidRows.length;

  console.log(`CSV rows: ${records.length} total | ${paidRows.length} Paid (to import) | ${skipped} skipped (Draft/blank)`);

  if (paidRows.length === 0) {
    console.log('Nothing to import. Exiting.');
    await pool.end();
    return;
  }

  // 3. Idempotency guard — abort if any invoices already exist for this tenant
  const { rows: existingCheck } = await pool.query(
    'SELECT COUNT(*) AS n FROM invoices WHERE tenant_id = $1',
    [TENANT_ID],
  );
  const existingCount = parseInt(existingCheck[0].n, 10);
  if (existingCount > 0) {
    console.error(`\n⛔  ABORT: ${existingCount} invoice(s) already exist for tenant ${TENANT_ID}.`);
    console.error('   Run on an empty invoices table to prevent duplicates. Exiting without changes.\n');
    await pool.end();
    process.exit(1);
  }

  // 4. Import each paid row in its own transaction
  let imported = 0;
  let firstNum = null;
  let lastNum  = null;

  for (const row of paidRows) {
    const invoiceDate = parseDate(row['Invoice Date']);
    const patientName = cleanName(row['Customer Name']);
    const email       = (row['Customer Email'] || '').trim() || null;
    const title       = (row['Invoice Title'] || '').trim() || null;
    const amount      = parseAmount(row['Requested Amount']);

    if (!patientName || amount === null || !invoiceDate) {
      console.warn(`  SKIP [${row['Invoice ID']}]: missing required field (name="${row['Customer Name']}", amount="${row['Requested Amount']}", date="${row['Invoice Date']}")`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const invoiceNumber = await nextInvoiceNumber(client, TENANT_ID);

      await client.query(
        `INSERT INTO invoices
           (tenant_id, invoice_number,
            patient_name, patient_email,
            treatment_description, amount,
            payment_method, payment_status, status,
            issued_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid', 'finalized', $8, $8)`,
        [
          TENANT_ID,
          invoiceNumber,
          patientName,
          email,
          title,
          amount,
          'card',       // Square is card-based; no explicit method in CSV
          invoiceDate,
        ],
      );

      await client.query('COMMIT');

      if (!firstNum) firstNum = invoiceNumber;
      lastNum = invoiceNumber;
      imported++;

      console.log(`  ✓ ${invoiceNumber}  ${patientName}  £${amount.toFixed(2)}  (${row['Invoice Date']})`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`  ✗ [${row['Invoice ID']}] ${patientName}: ${err.message}`);
    } finally {
      client.release();
    }
  }

  // 5. Summary
  console.log('\n────────────────────────────────────────');
  console.log(`Imported : ${imported} invoices`);
  console.log(`Skipped  : ${skipped} rows (Draft / blank status)`);
  if (firstNum && lastNum) {
    console.log(`Range    : ${firstNum} → ${lastNum}`);
  }
  console.log('────────────────────────────────────────\n');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

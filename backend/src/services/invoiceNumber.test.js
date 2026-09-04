/**
 * Smoke-test: two sequential calls for the same tenant must yield
 * INV-<year>-0001 and INV-<year>-0002.
 *
 * Requires a live DATABASE_URL (Supabase or local Postgres).
 * Run manually:  node src/services/invoiceNumber.test.js
 */

const { Pool } = require('pg');
const { nextInvoiceNumber } = require('./invoiceNumber');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  // Use a deterministic fake tenant UUID so re-runs are idempotent
  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const year = new Date().getFullYear();

  try {
    // Clean up any leftover counter from a previous run
    await client.query(
      'DELETE FROM invoice_counters WHERE tenant_id = $1 AND year = $2',
      [TENANT_ID, year],
    );

    await client.query('BEGIN');
    const n1 = await nextInvoiceNumber(client, TENANT_ID);
    await client.query('COMMIT');

    await client.query('BEGIN');
    const n2 = await nextInvoiceNumber(client, TENANT_ID);
    await client.query('COMMIT');

    const expected1 = `INV-${year}-0001`;
    const expected2 = `INV-${year}-0002`;

    if (n1 !== expected1) throw new Error(`Expected ${expected1}, got ${n1}`);
    if (n2 !== expected2) throw new Error(`Expected ${expected2}, got ${n2}`);

    console.log(`✓ ${n1}`);
    console.log(`✓ ${n2}`);
    console.log('All assertions passed.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('FAIL:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();

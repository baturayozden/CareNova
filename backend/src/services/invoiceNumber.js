/**
 * Atomically increment the per-tenant-per-year invoice counter and return a
 * formatted invoice number ("INV-2026-0001").
 *
 * Must be called inside an open transaction (the same `client` that will INSERT
 * the invoice row) so the counter and the invoice row land together or roll back
 * together.
 *
 * The ON CONFLICT … DO UPDATE pattern is atomic at the row level in PostgreSQL —
 * two concurrent calls for the same (tenant_id, year) will serialize and receive
 * distinct numbers. Never use MAX()+1 which has a TOCTOU race.
 *
 * @param {import('pg').PoolClient} client - transactional pg client
 * @param {string} tenantId - UUID of the current tenant
 * @returns {Promise<string>} e.g. "INV-2026-0001"
 */
async function nextInvoiceNumber(client, tenantId) {
  const year = new Date().getFullYear();

  const result = await client.query(
    `INSERT INTO invoice_counters (tenant_id, year, last_number)
     VALUES ($1, $2, 1)
     ON CONFLICT (tenant_id, year)
     DO UPDATE SET last_number = invoice_counters.last_number + 1
     RETURNING last_number`,
    [tenantId, year],
  );

  const num = result.rows[0].last_number;
  return `INV-${year}-${String(num).padStart(4, '0')}`;
}

module.exports = { nextInvoiceNumber };

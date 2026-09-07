/**
 * Schema migration runner — applies src/migrations/*.sql in numeric order.
 *
 * Idempotent: every applied file is recorded in the schema_migrations table,
 * so re-running only applies what is missing. Stops at the first failure and
 * prints the offending file, so a broken migration is easy to locate.
 *
 * Usage: node migrate-schema.js
 * Run this BEFORE migrate.js (which only applies ALTER TABLE tweaks and
 * assumes the tables already exist).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./src/db/index');

const DIR = path.join(__dirname, 'src', 'migrations');

(async () => {
  const client = await pool.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (' +
      '  filename TEXT PRIMARY KEY,' +
      '  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()' +
      ')'
    );

    const res = await client.query('SELECT filename FROM schema_migrations');
    const done = new Set(res.rows.map(function (r) { return r.filename; }));

    const files = fs.readdirSync(DIR)
      .filter(function (f) { return f.endsWith('.sql'); })
      .sort(function (a, b) {
        return a.localeCompare(b, undefined, { numeric: true });
      });

    let applied = 0;
    let skipped = 0;

    for (const f of files) {
      if (done.has(f)) { skipped++; continue; }
      const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
      process.stdout.write('-> ' + f + ' ... ');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [f]
        );
        console.log('OK');
        applied++;
      } catch (e) {
        console.log('HATA');
        console.error('\n=== ' + f + ' BASARISIZ ===');
        console.error(e.message);
        if (e.detail)   console.error('detay  : ' + e.detail);
        if (e.hint)     console.error('ipucu  : ' + e.hint);
        if (e.position) console.error('pozisyon: ' + e.position);
        console.error('\nBu dosya duzeltilene kadar sonrakiler calistirilmadi.');
        console.error('Uygulanan: ' + applied + ' | Atlanan: ' + skipped);
        process.exitCode = 1;
        return;
      }
    }

    console.log('\nBitti. Uygulanan: ' + applied + ' | Zaten vardi: ' + skipped + ' | Toplam: ' + files.length);
  } finally {
    client.release();
    await pool.end();
  }
})();

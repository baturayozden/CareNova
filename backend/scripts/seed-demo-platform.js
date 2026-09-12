#!/usr/bin/env node
'use strict';

// Seeds the admin console's demo platform (11 clinics, is_demo = true).
// See demo-platform-seed.js for what is real, what is synthetic, and why.
//
//   node backend/scripts/seed-demo-platform.js            # seed (idempotent)
//   node backend/scripts/seed-demo-platform.js --dry-run  # run everything, then ROLLBACK
//   node backend/scripts/seed-demo-platform.js --purge    # remove it
//
// Re-run before a demo: "last 24 hours" figures are derived from timestamps,
// which age. Re-seeding re-bases every timestamp onto the current moment.

require('dotenv').config({ override: true });
const { pool } = require('../src/db/index');
const { seedPlatform, purgePlatform } = require('./demo-platform-seed');

(async () => {
  const purge = process.argv.includes('--purge');
  const dryRun = process.argv.includes('--dry-run');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = purge ? { purged: await purgePlatform(client) } : await seedPlatform(client);
    console.log(JSON.stringify(result, null, 2));
    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('\nDRY RUN: hepsi calisti, ROLLBACK yapildi — veritabaninda kalici degisiklik yok.');
    } else {
      await client.query('COMMIT');
      console.log('\nCOMMIT.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nHATA (degisiklik yok, geri alindi):', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();

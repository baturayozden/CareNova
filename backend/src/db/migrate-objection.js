require('dotenv').config({ override: true });
const { pool } = require('./index');

async function run() {
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS objection_type VARCHAR(50)`);
  console.log('✅ objection_type column added to messages');
  await pool.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });

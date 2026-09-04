require('dotenv').config({ override: true });
const { pool } = require('./index');
async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Rename clinic_owner → director, doctor → dentist
    await client.query(`UPDATE roles SET name = 'director' WHERE name = 'clinic_owner'`);
    await client.query(`UPDATE roles SET name = 'dentist' WHERE name = 'doctor'`);
    // Insert treatment_coordinator if not exists
    await client.query(`INSERT INTO roles (name) VALUES ('treatment_coordinator') ON CONFLICT DO NOTHING`);
    await client.query('COMMIT');
    console.log('✅ Roles migrated');
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); await pool.end(); }
}
run().catch(e => { console.error(e); process.exit(1); });

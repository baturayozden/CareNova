#!/usr/bin/env node
'use strict';

// Seeds (or purges) the CareNova demo tenant.
//
// WHY THIS EXISTS
// The app and admin panels currently render fabricated patients and clinics
// that are imported straight into React components. The DB, meanwhile, is
// empty (0 tenants, 0 cases), so nothing can be served through the API and
// nobody can log in to app.carenova.ai at all -- the only user is the
// platform super_admin, and the app host redirects that role to the admin
// host.
//
// This script creates one clearly-labelled demo tenant (tenants.is_demo =
// true, migration 065) with a clinic user who CAN log in, plus the same 18
// cases the frontend invents, as real rows. From then on the API is the
// single source of truth and the DEMO VERI marking travels with the data
// instead of with the import path.
//
// The case content is not retyped here: scripts/demo-seed-data.json is
// generated from frontend/src/data/caseData.ts, so the two cannot drift into
// disagreeing about what the demo shows.
//
// SAFETY
//   * Idempotent. Re-running rebuilds the demo tenant's cases from scratch
//     and leaves every other tenant untouched.
//   * Reversible. `--purge` deletes everything this script created, scoped to
//     the demo tenant's id. It refuses to touch a tenant with is_demo = false.
//   * The login password is never taken from argv (shell history) -- it comes
//     from a no-echo prompt, or SEED_USER_PASSWORD for non-interactive use.
//     Same reasoning as scripts/set-admin-password.js.

require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/index');

const TENANT_SLUG = 'carenova-demo';
const TENANT_NAME = 'CareNova Demo Klinik';
// chk_tenants_plan_tier hala CareDental'in katmanlarini kabul ediyor
// (free/starter/growth/pro/enterprise). CareNova'nin paketleri Solo/Klinik/Grup;
// kisit guncellenene kadar en yakin karsilik olarak 'growth' kullaniliyor.
const TENANT_PLAN_TIER = 'growth';
const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 8;

// Clinic role ids (roles table, migration 059).
const ROLE = {
  klinik_sahibi: 9, operasyon_muduru: 10, hasta_danismani: 11,
  doktor: 12, koordinator: 13, tercuman: 14, muhasebe: 15,
};

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'demo-seed-data.json'), 'utf8'));

function readSecret(prompt) {
  return new Promise((resolve) => {
    const { stdin } = process;
    if (!stdin.isTTY) {
      let buf = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (c) => { buf += c; });
      stdin.on('end', () => resolve(buf.split('\n')[0].trim()));
      return;
    }
    process.stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let buf = '';
    const ETX = '\u0003';       // Ctrl-C
    const BACKSPACE = '\u007f';
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(false); stdin.pause();
        stdin.removeListener('data', onData);
        process.stderr.write('\n');
        resolve(buf.trim());
      } else if (ch === ETX) {
        stdin.setRawMode(false); process.stderr.write('\n'); process.exit(130);
      } else if (ch === BACKSPACE || ch === '\b') {
        buf = buf.slice(0, -1);
      } else {
        buf += ch;
      }
    };
    stdin.on('data', onData);
  });
}

// Staff accounts exist so that case assignments resolve to real user rows and
// the role matrix in routes/caseFiles.js has something to act on. They are
// not meant to be logged into: each gets a random hash no one holds the
// plaintext for, rather than a shared or guessable password.
async function unusableHash() {
  const random = require('crypto').randomBytes(32).toString('hex');
  return bcrypt.hash(random, BCRYPT_ROUNDS);
}

function slugifyEmail(name, i) {
  const base = name
    .toLocaleLowerCase('tr')
    .replace(/dr\.?\s*/g, '')
    .replace(/[çğıöşü]/g, (c) => ({ 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u' }[c]))
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
  return `${base || 'staff' + i}@demo.carenova.ai`;
}

async function findDemoTenant(client) {
  const { rows } = await client.query('SELECT id, is_demo FROM tenants WHERE slug = $1', [TENANT_SLUG]);
  return rows[0];
}

async function purge(client) {
  const t = await findDemoTenant(client);
  if (!t) { console.log('Demo tenant yok, silinecek bir sey de yok.'); return; }
  if (t.is_demo !== true) {
    throw new Error(`GUVENLIK: '${TENANT_SLUG}' tenant'i is_demo = false. Bu script gercek bir tenant'i silmez.`);
  }
  // cases -> ON DELETE CASCADE covers case_companions/media/assessments/
  // timeline/events (migration 057), so deleting the cases is enough.
  const c = await client.query('DELETE FROM cases WHERE tenant_id = $1', [t.id]);
  const l = await client.query('DELETE FROM leads WHERE tenant_id = $1', [t.id]);
  const ut = await client.query('DELETE FROM user_tenants WHERE tenant_id = $1', [t.id]);
  const u = await client.query('DELETE FROM users WHERE tenant_id = $1', [t.id]);
  const tt = await client.query('DELETE FROM tenants WHERE id = $1', [t.id]);
  console.log(`Silindi -> vaka: ${c.rowCount}, lead: ${l.rowCount}, kullanici-tenant: ${ut.rowCount}, kullanici: ${u.rowCount}, tenant: ${tt.rowCount}`);
}

async function seed(client, loginEmail, loginPassword) {
  // ── tenant ────────────────────────────────────────────────────────────────
  const branchKeys = [...new Set(DATA.cases.map((c) => c.branchKey))];
  const { rows: [tenant] } = await client.query(
    `INSERT INTO tenants (name, slug, status, plan_tier, country, timezone, is_demo, active_branch_keys)
     VALUES ($1,$2,'active','growth','TR','Europe/Istanbul',true,$3)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name, is_demo = true,
       active_branch_keys = EXCLUDED.active_branch_keys, updated_at = now()
     RETURNING id`,
    [TENANT_NAME, TENANT_SLUG, branchKeys],
  );
  const tenantId = tenant.id;
  console.log(`Tenant: ${TENANT_NAME} (${tenantId}) | is_demo = true | bransler: ${branchKeys.join(', ')}`);

  // ── staff ─────────────────────────────────────────────────────────────────
  const staffByName = new Map();
  const groups = [
    ['doctors', ROLE.doktor], ['consultants', ROLE.hasta_danismani],
    ['coordinators', ROLE.koordinator], ['interpreters', ROLE.tercuman],
  ];
  let i = 0;
  for (const [group, roleId] of groups) {
    for (const person of DATA.staff[group] || []) {
      const name = typeof person === 'string' ? person : person.name;
      const parts = name.replace(/^Dr\.?\s*/, '').trim().split(/\s+/);
      const first = parts.shift();
      const last = parts.join(' ') || '-';
      const email = slugifyEmail(name, i++);
      const hash = await unusableHash();
      const { rows: [u] } = await client.query(
        `INSERT INTO users (tenant_id, role_id, email, password_hash, first_name, last_name, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,true)
         ON CONFLICT (tenant_id, email) DO UPDATE SET
           role_id = EXCLUDED.role_id,
           first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, updated_at = now()
         RETURNING id`,
        [tenantId, roleId, email, hash, first, last],
      );
      await client.query(
        `INSERT INTO user_tenants (user_id, tenant_id, role_id) VALUES ($1,$2,$3)
         ON CONFLICT (user_id, tenant_id) DO NOTHING`,
        [u.id, tenantId, roleId],
      );
      staffByName.set(name, u.id);
    }
  }
  console.log(`Personel: ${staffByName.size} kullanici (doktor/danisman/koordinator/tercuman)`);

  // ── login user ────────────────────────────────────────────────────────────
  const loginHash = await bcrypt.hash(loginPassword, BCRYPT_ROUNDS);
  const { rows: [loginUser] } = await client.query(
    `INSERT INTO users (tenant_id, role_id, email, password_hash, first_name, last_name, is_active)
     VALUES ($1,$2,$3,$4,'Demo','Kullanici',true)
     ON CONFLICT (tenant_id, email) DO UPDATE SET
       role_id = EXCLUDED.role_id,
       password_hash = EXCLUDED.password_hash, is_active = true, updated_at = now()
     RETURNING id`,
    [tenantId, ROLE.operasyon_muduru, loginEmail, loginHash],
  );
  await client.query(
    `INSERT INTO user_tenants (user_id, tenant_id, role_id) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, tenant_id) DO NOTHING`,
    [loginUser.id, tenantId, ROLE.operasyon_muduru],
  );
  console.log(`Giris kullanicisi: ${loginEmail} | rol: operasyon_muduru`);

  // ── cases (clean rebuild) ─────────────────────────────────────────────────
  await client.query('DELETE FROM cases WHERE tenant_id = $1', [tenantId]);
  await client.query('DELETE FROM leads WHERE tenant_id = $1', [tenantId]);

  let companions = 0, events = 0, assessments = 0, itinerary = 0;
  for (const c of DATA.cases) {
    const { rows: [lead] } = await client.query(
      `INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
       VALUES ($1,$2,$3,$4,'new',$5,true) RETURNING id`,
      [tenantId, c.patientName, `+90000${String(Math.abs(hashCode(c.caseNumber))).slice(0, 7)}`,
        (c.patientLanguage || 'en').slice(0, 5), c.branchKey],
    );

    const { rows: [row] } = await client.query(
      `INSERT INTO cases (
         tenant_id, patient_id, case_number, branch_key, status, medical_eligibility,
         eligibility_note, patient_country, patient_language, currency, estimated_value,
         assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
         created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'EUR',$10,$11,$12,$13,$14,$15,$15)
       RETURNING id`,
      [tenantId, lead.id, c.caseNumber, c.branchKey, c.status,
        c.doctorDecision || 'pending', c.doctorNote || null,
        c.patientCountryCode || null, c.patientLanguage || null, c.estimatedValueEur ?? null,
        staffByName.get(c.assignedConsultant) || null,
        staffByName.get(c.assignedDoctor) || null,
        staffByName.get(c.assignedCoordinator) || null,
        staffByName.get(c.assignedInterpreter) || null,
        c.lastActivityAt || new Date().toISOString()],
    );

    for (const comp of c.companions) {
      await client.query(
        `INSERT INTO case_companions (case_id, name, relationship) VALUES ($1,$2,$3)`,
        [row.id, comp.name, comp.relation || comp.relationship || null],
      );
      companions++;
    }

    // Status history -> case_events. case_timeline is the travel itinerary
    // (day_offset/starts_at/location/type), a different thing entirely.
    for (const h of c.statusHistory) {
      await client.query(
        `INSERT INTO case_events (case_id, event_type, payload, created_at)
         VALUES ($1,'status_change',$2,$3)`,
        [row.id, JSON.stringify({ status: h.status }), h.at],
      );
      events++;
    }

    if (c.preAssessment && c.preAssessment.length) {
      await client.query(
        `INSERT INTO case_assessments (case_id, template_key, answers, completed_at)
         VALUES ($1,$2,$3,now())`,
        [row.id, c.branchKey, JSON.stringify(c.preAssessment)],
      );
      assessments++;
    }

    for (let d = 0; d < (c.itinerary || []).length; d++) {
      const step = c.itinerary[d];
      await client.query(
        `INSERT INTO case_timeline (case_id, day_offset, title, type)
         VALUES ($1,$2,$3,'consultation')`,
        [row.id, d, JSON.stringify({ tr: step.plan, label: step.day })],
      );
      itinerary++;
    }
  }

  console.log(`Vaka: ${DATA.cases.length} | refakatci: ${companions} | durum gecisi: ${events} | on degerlendirme: ${assessments} | program adimi: ${itinerary}`);
  return { tenantId, loginEmail };
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h;
}

(async () => {
  const purgeMode = process.argv.includes('--purge');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (purgeMode) {
      await purge(client);
    } else {
      const loginEmail = process.env.SEED_USER_EMAIL || 'demo@carenova.ai';
      let pw = process.env.SEED_USER_PASSWORD;
      if (!pw) pw = await readSecret(`Demo klinik kullanicisi (${loginEmail}) icin sifre (girdi gorunmez): `);
      if (!pw || pw.length < MIN_LENGTH) {
        throw new Error(`Sifre en az ${MIN_LENGTH} karakter olmali.`);
      }
      await seed(client, loginEmail, pw);
    }
    await client.query('COMMIT');
    console.log('\nBitti.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nHATA (degisiklik yok, geri alindi):', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();

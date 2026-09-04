/**
 * Riverside Dental — Bölüm 4: Appointments.
 *
 * Realistic appointment mix linked to Riverside leads + dentists:
 *   - past 'completed' (attended visits)
 *   - upcoming 'confirmed' and 'pending'
 *   - one 'cancelled' and one 'no_show' for realism
 * status enum: pending / confirmed / cancelled / completed / no_show
 * sync_source: 'carenova' (no real Google push — demo data)
 *
 * Idempotent: clears Riverside appointments first, then re-inserts.
 * Run AFTER seed-demo-riverside.js.
 * Usage: node src/db/seed-demo-riverside-appointments.js
 */

require('dotenv').config({ override: true, path: require('path').join(__dirname, '../../.env') });

const { pool } = require('./index');

const TENANT_SLUG = 'riverside-dental-london';

// dayOffset: negative = past, positive = future (relative to today)
// dentist: email of assigned dentist
const APPTS = [
  // ── Past completed (attended) ──
  { leadPhone:'447700910021', patient:'Isabella Romano',  phone:'447700910021', treatment:'Porcelain Veneers Consultation', dayOffset:-14, time:'10:00', dur:45, status:'completed', dentist:'dr.henry.caldwell@riversidedental.co.uk',  notes:'Veneer prep completed, follow-up in 2 weeks.' },
  { leadPhone:'447700910019', patient:'Aisha Rahman',     phone:'447700910019', treatment:'Teeth Whitening',                dayOffset:-11, time:'14:30', dur:30, status:'completed', dentist:'dr.priya.sharma@riversidedental.co.uk',   notes:'Whitening session done, patient very happy.' },
  { leadPhone:'447700910004', patient:'Thomas Whitfield', phone:'447700910004', treatment:'Dental Implant Consultation',     dayOffset:-3,  time:'14:00', dur:45, status:'completed', dentist:'dr.henry.caldwell@riversidedental.co.uk',  notes:'Treatment plan agreed, implant booked.' },

  // ── Upcoming confirmed ──
  { leadPhone:'447700910004', patient:'Thomas Whitfield', phone:'447700910004', treatment:'Dental Implant Placement',        dayOffset:4,   time:'09:30', dur:90, status:'confirmed', dentist:'dr.henry.caldwell@riversidedental.co.uk',  notes:'Stage 1 implant surgery.' },
  { leadPhone:'447700910020', patient:'Oliver Scott',     phone:'447700910020', treatment:'Dental Implant Consultation',     dayOffset:2,   time:'11:00', dur:45, status:'confirmed', dentist:'dr.marcus.reed@riversidedental.co.uk',    notes:null },
  { leadPhone:'447700910018', patient:'Sophie Turner',    phone:'447700910018', treatment:'Invisalign Fitting',              dayOffset:6,   time:'15:30', dur:60, status:'confirmed', dentist:'dr.priya.sharma@riversidedental.co.uk',   notes:'First aligner set.' },

  // ── Upcoming pending ──
  { leadPhone:'447700910001', patient:'Ahmed Hassan',     phone:'447700910001', treatment:'Implant Consultation (Arabic)',   dayOffset:3,   time:'14:00', dur:45, status:'pending',   dentist:'dr.henry.caldwell@riversidedental.co.uk',  notes:'Arabic-speaking patient, finance plan discussed.' },
  { leadPhone:'447700910005', patient:'Sofia Moreno',     phone:'447700910005', treatment:'Veneers Consultation (Spanish)',  dayOffset:5,   time:'10:30', dur:45, status:'pending',   dentist:'dr.priya.sharma@riversidedental.co.uk',   notes:'Spanish-speaking, wants to see before/after cases.' },

  // ── Realism: one cancelled, one no_show ──
  { leadPhone:'447700910010', patient:'James Mitchell',   phone:'447700910010', treatment:'Teeth Whitening',                dayOffset:-5,  time:'16:00', dur:30, status:'cancelled', dentist:'dr.priya.sharma@riversidedental.co.uk',   notes:'Patient cancelled, rescheduling.' },
  { leadPhone:'447700910013', patient:'George Hughes',    phone:'447700910013', treatment:'Whitening Consultation',          dayOffset:-7,  time:'09:00', dur:30, status:'no_show',   dentist:'dr.marcus.reed@riversidedental.co.uk',    notes:'Did not attend, AI follow-up triggered.' },
];

function dateOffset(days) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function main() {
  console.log('━━━ Riverside randevu seed (Bölüm 4) ━━━\n');

  const { rows: tRows } = await pool.query('SELECT id FROM tenants WHERE slug=$1', [TENANT_SLUG]);
  if (!tRows[0]) { console.error('Riverside tenant yok — önce seed-demo-riverside.js'); process.exit(1); }
  const tenantId = tRows[0].id;

  const { rows: leadRows } = await pool.query('SELECT id, phone FROM leads WHERE tenant_id=$1', [tenantId]);
  const leadIdByPhone = {}; leadRows.forEach(r => leadIdByPhone[r.phone] = r.id);
  const { rows: staffRows } = await pool.query('SELECT id, email FROM users WHERE tenant_id=$1', [tenantId]);
  const staffIdByEmail = {}; staffRows.forEach(r => staffIdByEmail[r.email] = r.id);

  // Idempotent cleanup
  const del = await pool.query('DELETE FROM appointments WHERE tenant_id=$1', [tenantId]);
  console.log(`  🧹 ${del.rowCount} eski randevu temizlendi (idempotent)\n`);

  let total = 0;
  for (const a of APPTS) {
    const leadId = leadIdByPhone[a.leadPhone] || null;
    const dentistId = staffIdByEmail[a.dentist] || null;
    await pool.query(`
      INSERT INTO appointments
        (tenant_id, lead_id, patient_name, patient_phone, treatment_type,
         appointment_date, appointment_time, duration_minutes, status, notes,
         assigned_to, sync_source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'carenova')
    `, [tenantId, leadId, a.patient, '+'+a.phone, a.treatment,
        dateOffset(a.dayOffset), a.time, a.dur, a.status, a.notes, dentistId]);
    total++;
    console.log(`  ✅ ${a.patient.padEnd(18)} ${a.status.padEnd(10)} ${dateOffset(a.dayOffset)} ${a.time}`);
  }

  console.log(`\n  ✅ ${total} randevu eklendi (geçmiş completed + gelecek confirmed/pending + cancelled/no_show)`);
  console.log('\n━━━ Bölüm 4 tamamlandı: randevular ━━━');
  await pool.end();
}

main().catch(e => { console.error('SEED ERROR:', e.message); process.exit(1); });

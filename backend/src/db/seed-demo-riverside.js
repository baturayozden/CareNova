/**
 * Riverside Dental & Implant Clinic — full demo seed.
 *
 * Showcases EVERY feature for sales demos:
 *   - 1 tenant (Riverside Dental & Implant Clinic, London, Pro plan)
 *   - 10 staff across all roles (director, clinic_admin, TC, receptionist, dentist)
 *   - 30 leads: varied statuses, sources, values, AI scores; languages EN/TR/AR/ES/RU
 *   - Realistic WhatsApp conversations (multi-language, AI follow-up scenarios)
 *   - Commission scheme identical to Dentafly 2026 Standard (5 tiers, 2 thresholds, 4 team bonuses)
 *   - treatment_deals + a calculated commission period
 *
 * Safe to re-run — ON CONFLICT upserts + idempotent deletes for child rows.
 * Usage: node src/db/seed-demo-riverside.js
 *
 * NOTE: This writes ONLY to the Riverside tenant. Dentafly and other tenants are untouched.
 */

require('dotenv').config({ override: true, path: require('path').join(__dirname, '../../.env') });

const bcrypt   = require('bcryptjs');
const { pool } = require('./index');

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n, h = 0) {
  return new Date(Date.now() - (n * 86_400_000 + h * 3_600_000)).toISOString();
}

// ── Tenant (clinic = tenant in this schema) ───────────────────────────────────

const TENANT = {
  name: 'Riverside Dental & Implant Clinic',
  slug: 'riverside-dental-london',
  address: '12 Eaton Square, Belgravia, London SW1W 9DA',
  phone: '+44 20 7946 0500',
  email: 'hello@riversidedental.co.uk',
  website: 'https://riversidedental.co.uk',
  planTier: 'pro',
  aiLimit: 500,
  aiPolicy: 'notify',
};

// ── Staff (10, all roles) ─────────────────────────────────────────────────────
// roleId: 2=director, 3=clinic_admin, 4=receptionist, 5=dentist, 6=treatment_coordinator

const STAFF = [
  { email: 'dr.eleanor.whitmore@riversidedental.co.uk', firstName: 'Eleanor',  lastName: 'Whitmore', roleId: 2 }, // director
  { email: 'charlotte.hayes@riversidedental.co.uk',      firstName: 'Charlotte', lastName: 'Hayes',   roleId: 3 }, // clinic_admin
  { email: 'william.hartley@riversidedental.co.uk',      firstName: 'William',  lastName: 'Hartley',  roleId: 3 }, // clinic_admin
  { email: 'sophie.bennett@riversidedental.co.uk',       firstName: 'Sophie',   lastName: 'Bennett',  roleId: 6 }, // treatment_coordinator
  { email: 'olivia.grant@riversidedental.co.uk',         firstName: 'Olivia',   lastName: 'Grant',    roleId: 6 }, // treatment_coordinator
  { email: 'daniel.foster@riversidedental.co.uk',        firstName: 'Daniel',   lastName: 'Foster',   roleId: 4 }, // receptionist
  { email: 'grace.sullivan@riversidedental.co.uk',       firstName: 'Grace',    lastName: 'Sullivan', roleId: 4 }, // receptionist
  { email: 'dr.henry.caldwell@riversidedental.co.uk',    firstName: 'Henry',    lastName: 'Caldwell', roleId: 5 }, // dentist
  { email: 'dr.priya.sharma@riversidedental.co.uk',      firstName: 'Priya',    lastName: 'Sharma',   roleId: 5 }, // dentist
  { email: 'dr.marcus.reed@riversidedental.co.uk',       firstName: 'Marcus',   lastName: 'Reed',     roleId: 5 }, // dentist
];

// ── 30 Leads ──────────────────────────────────────────────────────────────────
// Varied: status, source, language (EN/TR/AR/ES/RU), treatment, value, AI score.
// score_label: Hot / Warm / Cool / Ghost Risk  (matches frontend SCORE_STYLES)

const LEADS = [
  // High-value Hot leads (drive the Hot Leads panel)
  { firstName:'Ahmed',     lastName:'Hassan',     phone:'447700910001', language:'ar', status:'qualified', treatment:'Dental Implants',          value:14500, source:'whatsapp',    daysAgo:1,  score:95, label:'Hot',  tags:['high_value','urgent_care','ready_to_book'] },
  { firstName:'Charlotte', lastName:'Pembroke',   phone:'447700910002', language:'en', status:'responded',  treatment:'Full Mouth Rehabilitation', value:18200, source:'referral',    daysAgo:2,  score:92, label:'Hot',  tags:['high_value','engaged'] },
  { firstName:'Elif',      lastName:'Şahin',      phone:'447700910003', language:'tr', status:'qualified', treatment:'Dental Implants',          value:9800,  source:'whatsapp',    daysAgo:1,  score:88, label:'Hot',  tags:['high_value','multilingual'] },
  { firstName:'Thomas',    lastName:'Whitfield',  phone:'447700910004', language:'en', status:'booked',     treatment:'Dental Implants',          value:7600,  source:'website',     daysAgo:3,  score:85, label:'Hot',  tags:['booked','high_value'] },
  { firstName:'Sofia',     lastName:'Moreno',     phone:'447700910005', language:'es', status:'responded',  treatment:'Porcelain Veneers',        value:6400,  source:'ad_campaign', daysAgo:2,  score:84, label:'Hot',  tags:['engaged','multilingual'] },

  // Warm leads
  { firstName:'Harry',     lastName:'Evans',      phone:'447700910006', language:'en', status:'contacted',  treatment:'Invisalign',               value:3200,  source:'website',     daysAgo:4,  score:72, label:'Warm', tags:['follow_up_needed'] },
  { firstName:'Zeynep',    lastName:'Kaya',       phone:'447700910007', language:'tr', status:'responded',  treatment:'Invisalign',               value:3400,  source:'whatsapp',    daysAgo:3,  score:70, label:'Warm', tags:['engaged','multilingual'] },
  { firstName:'Olivia',    lastName:'Bennett',    phone:'447700910008', language:'en', status:'contacted',  treatment:'Porcelain Veneers',        value:4800,  source:'missed_call', daysAgo:5,  score:68, label:'Warm', tags:['missed_call','follow_up_needed'] },
  { firstName:'Dmitri',    lastName:'Volkov',     phone:'447700910009', language:'ru', status:'responded',  treatment:'Dental Implants',          value:8900,  source:'referral',    daysAgo:4,  score:66, label:'Warm', tags:['high_value','multilingual'] },
  { firstName:'James',     lastName:'Mitchell',   phone:'447700910010', language:'en', status:'contacted',  treatment:'Teeth Whitening',          value:420,   source:'website',     daysAgo:6,  score:58, label:'Warm', tags:['low_value'] },
  { firstName:'Layla',     lastName:'Mansour',    phone:'447700910011', language:'ar', status:'contacted',  treatment:'Smile Makeover',           value:7200,  source:'whatsapp',    daysAgo:5,  score:64, label:'Warm', tags:['high_value','multilingual'] },
  { firstName:'Emily',     lastName:'Carter',     phone:'447700910012', language:'en', status:'responded',  treatment:'Composite Bonding',        value:980,   source:'website',     daysAgo:4,  score:55, label:'Warm', tags:['engaged'] },

  // Cool leads
  { firstName:'George',    lastName:'Hughes',     phone:'447700910013', language:'en', status:'contacted',  treatment:'Teeth Whitening',          value:380,   source:'ad_campaign', daysAgo:8,  score:42, label:'Cool', tags:['low_value','slow_response'] },
  { firstName:'Hannah',    lastName:'Price',      phone:'447700910014', language:'en', status:'new',        treatment:'Invisalign',               value:2900,  source:'website',     daysAgo:7,  score:48, label:'Cool', tags:['new_enquiry'] },
  { firstName:'Mehmet',    lastName:'Demir',      phone:'447700910015', language:'tr', status:'contacted',  treatment:'Dental Implants',          value:5600,  source:'whatsapp',    daysAgo:9,  score:45, label:'Cool', tags:['slow_response','multilingual'] },
  { firstName:'Lucy',      lastName:'Robinson',   phone:'447700910016', language:'en', status:'new',        treatment:'Porcelain Veneers',        value:3800,  source:'referral',    daysAgo:6,  score:50, label:'Cool', tags:['new_enquiry'] },
  { firstName:'Daniel',    lastName:'Walsh',      phone:'447700910017', language:'en', status:'contacted',  treatment:'Composite Bonding',        value:1100,  source:'website',     daysAgo:10, score:38, label:'Cool', tags:['slow_response'] },

  // Booked / Attended (conversion story)
  { firstName:'Sophie',    lastName:'Turner',     phone:'447700910018', language:'en', status:'booked',     treatment:'Invisalign',               value:3600,  source:'whatsapp',    daysAgo:5,  score:80, label:'Hot',  tags:['booked'] },
  { firstName:'Aisha',     lastName:'Rahman',     phone:'447700910019', language:'ar', status:'attended',   treatment:'Teeth Whitening',          value:450,   source:'whatsapp',    daysAgo:12, score:75, label:'Warm', tags:['converted','multilingual'] },
  { firstName:'Oliver',    lastName:'Scott',      phone:'447700910020', language:'en', status:'booked',     treatment:'Dental Implants',          value:6800,  source:'referral',    daysAgo:7,  score:82, label:'Hot',  tags:['booked','high_value'] },
  { firstName:'Isabella',  lastName:'Romano',     phone:'447700910021', language:'en', status:'attended',   treatment:'Porcelain Veneers',        value:5200,  source:'website',     daysAgo:15, score:78, label:'Warm', tags:['converted','high_value'] },

  // Ghost risk (re-engagement story)
  { firstName:'Ryan',      lastName:'Murphy',     phone:'447700910022', language:'en', status:'contacted',  treatment:'Dental Implants',          value:7400,  source:'website',     daysAgo:18, score:15, label:'Ghost Risk', tags:['ghost_risk','no_response','high_value'] },
  { firstName:'Chloe',     lastName:'Anderson',   phone:'447700910023', language:'en', status:'responded',  treatment:'Invisalign',               value:3100,  source:'ad_campaign', daysAgo:21, score:18, label:'Ghost Risk', tags:['ghost_risk','went_quiet'] },
  { firstName:'Yusuf',     lastName:'Aydın',      phone:'447700910024', language:'tr', status:'contacted',  treatment:'Smile Makeover',           value:8100,  source:'whatsapp',    daysAgo:20, score:12, label:'Ghost Risk', tags:['ghost_risk','no_response','multilingual'] },
  { firstName:'Grace',     lastName:'Bell',       phone:'447700910025', language:'en', status:'contacted',  treatment:'Teeth Whitening',          value:400,   source:'website',     daysAgo:25, score:10, label:'Ghost Risk', tags:['ghost_risk','low_value'] },

  // Lost (full funnel)
  { firstName:'Jack',      lastName:'Thompson',   phone:'447700910026', language:'en', status:'lost',       treatment:'Invisalign',               value:2800,  source:'website',     daysAgo:30, score:null, label:null, tags:[] },
  { firstName:'Fatima',    lastName:'Al-Sayed',   phone:'447700910027', language:'ar', status:'lost',       treatment:'Dental Implants',          value:6200,  source:'referral',    daysAgo:28, score:null, label:null, tags:[] },

  // Fresh new leads (top of funnel)
  { firstName:'Amelia',    lastName:'Clarke',     phone:'447700910028', language:'en', status:'new',        treatment:'Composite Bonding',        value:1200,  source:'website',     daysAgo:1,  score:52, label:'Warm', tags:['new_enquiry'] },
  { firstName:'Noah',      lastName:'Wright',     phone:'447700910029', language:'en', status:'new',        treatment:'Teeth Whitening',          value:390,   source:'ad_campaign', daysAgo:1,  score:40, label:'Cool', tags:['new_enquiry','low_value'] },
  { firstName:'Maria',     lastName:'García',     phone:'447700910030', language:'es', status:'new',        treatment:'Porcelain Veneers',        value:4600,  source:'whatsapp',    daysAgo:2,  score:60, label:'Warm', tags:['new_enquiry','multilingual'] },
];

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const hash = await bcrypt.hash('Demo2026!', 10);

  console.log('━━━ Riverside Dental demo seed ━━━\n');

  // 1. Tenant
  console.log('── Tenant ──────────────────────────────────────────────────────');
  const { rows: tRows } = await pool.query(`
    INSERT INTO tenants
      (name, slug, status, plan_tier, country, timezone,
       address, phone, email, website, ai_monthly_limit, ai_overage_policy)
    VALUES ($1,$2,'active',$3,'GB','Europe/London',$4,$5,$6,$7,$8,$9)
    ON CONFLICT (slug) DO UPDATE SET
      name=EXCLUDED.name, plan_tier=EXCLUDED.plan_tier, address=EXCLUDED.address,
      phone=EXCLUDED.phone, email=EXCLUDED.email, website=EXCLUDED.website,
      ai_monthly_limit=EXCLUDED.ai_monthly_limit, ai_overage_policy=EXCLUDED.ai_overage_policy,
      updated_at=NOW()
    RETURNING id, name
  `, [TENANT.name, TENANT.slug, TENANT.planTier, TENANT.address, TENANT.phone,
      TENANT.email, TENANT.website, TENANT.aiLimit, TENANT.aiPolicy]);
  const tenantId = tRows[0].id;
  console.log(`  ✅ ${tRows[0].name}  (${tenantId})`);

  // 2. Staff
  console.log('\n── Staff (10) ──────────────────────────────────────────────────');
  const ROLE_NAMES = { 2:'director', 3:'clinic_admin', 4:'receptionist', 5:'dentist', 6:'treatment_coordinator' };
  const staffIdsByEmail = {};
  for (const s of STAFF) {
    const { rows } = await pool.query(`
      INSERT INTO users
        (tenant_id, role_id, email, password_hash, first_name, last_name, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,TRUE)
      ON CONFLICT (tenant_id, email) DO UPDATE SET
        first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
        role_id=EXCLUDED.role_id, password_hash=EXCLUDED.password_hash, updated_at=NOW()
      RETURNING id, email
    `, [tenantId, s.roleId, s.email, hash, s.firstName, s.lastName]);
    staffIdsByEmail[s.email] = rows[0].id;
    console.log(`  ✅ ${s.firstName} ${s.lastName}  [${ROLE_NAMES[s.roleId]}]`);
  }

  // 3. Leads + AI scoring
  console.log('\n── Leads (30) ──────────────────────────────────────────────────');
  const leadIdsByPhone = {};
  for (const l of LEADS) {
    const createdAt = daysAgo(l.daysAgo);
    const { rows } = await pool.query(`
      INSERT INTO leads
        (tenant_id, phone, first_name, last_name, language, status, source,
         treatment_interest, treatment_value, ai_follow_up_enabled, ai_follow_up_count,
         lead_score, score_label, score_tags, score_reasoning, score_updated_at,
         created_at, updated_at, status_changed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,0,
              $10,$11,$12,$13,$14,$14,$14,$14)
      ON CONFLICT (tenant_id, phone) DO UPDATE SET
        first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
        status=EXCLUDED.status, treatment_interest=EXCLUDED.treatment_interest,
        treatment_value=EXCLUDED.treatment_value, source=EXCLUDED.source,
        lead_score=EXCLUDED.lead_score, score_label=EXCLUDED.score_label,
        score_tags=EXCLUDED.score_tags, score_reasoning=EXCLUDED.score_reasoning,
        score_updated_at=EXCLUDED.score_updated_at, updated_at=NOW()
      RETURNING id, first_name, last_name, status
    `, [tenantId, l.phone, l.firstName, l.lastName, l.language, l.status, l.source,
        l.treatment, l.value, l.score, l.label, l.tags,
        l.score ? `Auto-scored: ${l.label} lead, ${l.treatment} enquiry valued at €${l.value}.` : null,
        createdAt]);
    leadIdsByPhone[l.phone] = rows[0].id;
  }
  console.log(`  ✅ ${LEADS.length} leads inserted (scores, statuses, 5 languages)`);

  console.log('\n━━━ Bölüm 1 tamamlandı: tenant + 10 personel + 30 lead ━━━');
  console.log('Tenant ID:', tenantId);
  console.log('(Mesajlar ve komisyon bölümü ayrı eklenecek.)');

  await pool.end();
}

main().catch(e => { console.error('SEED ERROR:', e.message); process.exit(1); });

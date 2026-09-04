/**
 * Demo seed — populates Railway PostgreSQL with realistic test data:
 *   - 3 clinic tenants
 *   - 6 staff users (2 per clinic: clinic_admin + receptionist)
 *   - 15 leads (EN/TR/AR mix, all status stages, UK names + phones)
 *   - 25 AI conversation messages
 *
 * Also adds treatment_value column to leads if not present.
 * Safe to re-run: uses ON CONFLICT DO NOTHING / DO UPDATE.
 *
 * Usage: node src/db/seed-demo.js
 */

require('dotenv').config({ override: true, path: require('path').join(__dirname, '../../.env') });

const bcrypt   = require('bcryptjs');
const { pool } = require('./index');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function hoursAgo(n) {
  return new Date(Date.now() - n * 3600_000).toISOString();
}

// ---------------------------------------------------------------------------
// Data definitions
// ---------------------------------------------------------------------------
const CLINICS = [
  {
    name: 'Smile Studio London',
    slug: 'smile-studio-london',
    address: '25 Harley Street, London W1G 9QW',
  },
  {
    name: 'Pearl Dental Canary Wharf',
    slug: 'pearl-dental-canary-wharf',
    address: '1 Canada Square, London E14 5AB',
  },
  {
    name: 'Elite Dental Manchester',
    slug: 'elite-dental-manchester',
    address: '47 King Street, Manchester M2 7AT',
  },
];

// Two staff per clinic (indices match CLINICS array)
const STAFF = [
  // Smile Studio London
  { email: 'sarah.nelson@smilestudio.com',    firstName: 'Sarah',   lastName: 'Nelson',   roleId: 3, clinicIdx: 0 },
  { email: 'tom.archer@smilestudio.com',      firstName: 'Tom',     lastName: 'Archer',   roleId: 4, clinicIdx: 0 },
  // Pearl Dental
  { email: 'jessica.cole@pearldental.com',    firstName: 'Jessica', lastName: 'Cole',     roleId: 3, clinicIdx: 1 },
  { email: 'mike.foster@pearldental.com',     firstName: 'Mike',    lastName: 'Foster',   roleId: 4, clinicIdx: 1 },
  // Elite Dental Manchester
  { email: 'rachel.hunt@elitedental.com',     firstName: 'Rachel',  lastName: 'Hunt',     roleId: 3, clinicIdx: 2 },
  { email: 'daniel.price@elitedental.com',    firstName: 'Daniel',  lastName: 'Price',    roleId: 4, clinicIdx: 2 },
];

// 15 leads — 5 per clinic (mixed language, status, treatment)
const LEADS_DATA = [
  // ── Smile Studio London ──────────────────────────────────────────────────
  {
    clinicIdx: 0, firstName: 'Emma', lastName: 'Thompson',
    phone: '447700900001', language: 'en', status: 'new',
    treatment: 'Teeth Whitening', value: 380, source: 'website', daysAgoCreated: 1,
  },
  {
    clinicIdx: 0, firstName: 'Fatma', lastName: 'Yılmaz',
    phone: '447700900002', language: 'tr', status: 'contacted',
    treatment: 'Porcelain Veneers', value: 2800, source: 'ad_campaign', daysAgoCreated: 4,
  },
  {
    clinicIdx: 0, firstName: 'Ahmed', lastName: 'Hassan',
    phone: '447700900003', language: 'ar', status: 'booked',
    treatment: 'Dental Implants', value: 3500, source: 'referral', daysAgoCreated: 7,
  },
  {
    clinicIdx: 0, firstName: 'James', lastName: 'Mitchell',
    phone: '447700900004', language: 'en', status: 'lost',
    treatment: 'Invisalign', value: 2400, source: 'website', daysAgoCreated: 10,
  },
  {
    clinicIdx: 0, firstName: 'Priya', lastName: 'Patel',
    phone: '447700900005', language: 'en', status: 'responded',
    treatment: 'Full Mouth Rehabilitation', value: 8500, source: 'missed_call', daysAgoCreated: 3,
  },

  // ── Pearl Dental Canary Wharf ─────────────────────────────────────────────
  {
    clinicIdx: 1, firstName: 'Oliver', lastName: 'Clarke',
    phone: '447700900006', language: 'en', status: 'contacted',
    treatment: 'Porcelain Veneers', value: 3200, source: 'ad_campaign', daysAgoCreated: 5,
  },
  {
    clinicIdx: 1, firstName: 'Zeynep', lastName: 'Kaya',
    phone: '447700900007', language: 'tr', status: 'booked',
    treatment: 'Invisalign', value: 2900, source: 'website', daysAgoCreated: 8,
  },
  {
    clinicIdx: 1, firstName: 'Mohamed', lastName: 'Al-Rashid',
    phone: '447700900008', language: 'ar', status: 'new',
    treatment: 'Dental Implants', value: 4200, source: 'referral', daysAgoCreated: 2,
  },
  {
    clinicIdx: 1, firstName: 'Charlotte', lastName: 'Davies',
    phone: '447700900009', language: 'en', status: 'booked',
    treatment: 'Teeth Whitening', value: 420, source: 'website', daysAgoCreated: 9,
  },
  {
    clinicIdx: 1, firstName: 'Aisha', lastName: 'Mahmoud',
    phone: '447700900010', language: 'ar', status: 'lost',
    treatment: 'Full Mouth Rehabilitation', value: 7800, source: 'missed_call', daysAgoCreated: 12,
  },

  // ── Elite Dental Manchester ───────────────────────────────────────────────
  {
    clinicIdx: 2, firstName: 'Thomas', lastName: 'Hughes',
    phone: '447700900011', language: 'en', status: 'contacted',
    treatment: 'Dental Implants', value: 4500, source: 'ad_campaign', daysAgoCreated: 6,
  },
  {
    clinicIdx: 2, firstName: 'Sofia', lastName: 'Martinez',
    phone: '447700900012', language: 'en', status: 'new',
    treatment: 'Porcelain Veneers', value: 2600, source: 'website', daysAgoCreated: 1,
  },
  {
    clinicIdx: 2, firstName: 'Kerem', lastName: 'Demir',
    phone: '447700900013', language: 'tr', status: 'booked',
    treatment: 'Invisalign', value: 3100, source: 'referral', daysAgoCreated: 11,
  },
  {
    clinicIdx: 2, firstName: 'William', lastName: 'Brown',
    phone: '447700900014', language: 'en', status: 'contacted',
    treatment: 'Teeth Whitening', value: 460, source: 'website', daysAgoCreated: 5,
  },
  {
    clinicIdx: 2, firstName: 'Layla', lastName: 'Al-Amin',
    phone: '447700900015', language: 'ar', status: 'new',
    treatment: 'Full Mouth Rehabilitation', value: 6200, source: 'missed_call', daysAgoCreated: 2,
  },
];

// 25 messages — spread across leads (by phone number reference)
const MESSAGES = [
  // Emma Thompson — new lead
  { phone: '447700900001', direction: 'inbound',  ai: false, hoursAgoSent: 22,
    content: "Hi, I saw your offer for teeth whitening. How much does it cost and how long does it take?" },
  { phone: '447700900001', direction: 'outbound', ai: true,  hoursAgoSent: 21,
    content: "Hi Emma! Thanks for reaching out to Smile Studio London 😊 Our professional teeth whitening starts from €380 and takes about 60–90 minutes in the chair. Would you like to book a free consultation this week?" },

  // Fatma Yılmaz — contacted
  { phone: '447700900002', direction: 'inbound',  ai: false, hoursAgoSent: 96,
    content: "Merhabalar, veneer fiyatlarınız hakkında bilgi almak istiyorum." },
  { phone: '447700900002', direction: 'outbound', ai: true,  hoursAgoSent: 95,
    content: "Merhaba Fatma Hanım! Smile Studio London'a hoş geldiniz 🦷 Porselen veneer fiyatlarımız diş başına €700'den başlamaktadır. Ücretsiz danışma için uygun olduğunuz bir gün var mı?" },
  { phone: '447700900002', direction: 'inbound',  ai: false, hoursAgoSent: 90,
    content: "Cuma günü müsait olabilirim, saat 3 uyar mı?" },
  { phone: '447700900002', direction: 'outbound', ai: true,  hoursAgoSent: 89,
    content: "Mükemmel! Cuma saat 15:00'i rezerve ettim. Adresimiz 25 Harley Street, London. Görüşmek üzere! 😊" },

  // Ahmed Hassan — booked
  { phone: '447700900003', direction: 'inbound',  ai: false, hoursAgoSent: 168,
    content: "السلام عليكم، أريد الاستفسار عن زراعة الأسنان" },
  { phone: '447700900003', direction: 'outbound', ai: true,  hoursAgoSent: 167,
    content: "وعليكم السلام أحمد! أهلاً بك في Smile Studio London 🦷 زراعة الأسنان لدينا تبدأ من €1,200 للسن الواحدة مع استشارة مجانية. هل ترغب في تحديد موعد؟" },
  { phone: '447700900003', direction: 'inbound',  ai: false, hoursAgoSent: 150,
    content: "نعم أريد موعد الأسبوع القادم" },
  { phone: '447700900003', direction: 'outbound', ai: true,  hoursAgoSent: 149,
    content: "ممتاز! تم تحديد موعدك يوم الاثنين القادم الساعة 10 صباحاً. سنرسل لك تأكيداً على الواتساب. 😊" },

  // Oliver Clarke — contacted
  { phone: '447700900006', direction: 'inbound',  ai: false, hoursAgoSent: 120,
    content: "Hello, I'm interested in getting veneers. I have a gap between my front teeth and some discolouration." },
  { phone: '447700900006', direction: 'outbound', ai: true,  hoursAgoSent: 119,
    content: "Hi Oliver! Great to hear from you. Veneers are perfect for closing gaps and improving colour — we see brilliant results every day ✨ Our consultations are completely free. Can I book you in for an assessment this week?" },
  { phone: '447700900006', direction: 'inbound',  ai: false, hoursAgoSent: 110,
    content: "That would be great, what's the rough cost for 4 veneers?" },
  { phone: '447700900006', direction: 'outbound', ai: true,  hoursAgoSent: 109,
    content: "For 4 porcelain veneers you're looking at around €2,800–€3,200 depending on complexity. The consultation is the best way to get an exact quote. Shall I suggest some available slots?" },

  // Zeynep Kaya — booked
  { phone: '447700900007', direction: 'inbound',  ai: false, hoursAgoSent: 192,
    content: "Merhaba, Invisalign fiyatları ne kadar? Dişlerim biraz eğri." },
  { phone: '447700900007', direction: 'outbound', ai: true,  hoursAgoSent: 191,
    content: "Merhaba Zeynep Hanım! Pearl Dental'a hoş geldiniz 😊 Invisalign tedavisinin fiyatı €2,400'den başlıyor. Ücretsiz 3D tarama ile başlamak ister misiniz?" },
  { phone: '447700900007', direction: 'inbound',  ai: false, hoursAgoSent: 180,
    content: "Evet, bu hafta uygun olabilirim." },
  { phone: '447700900007', direction: 'outbound', ai: true,  hoursAgoSent: 179,
    content: "Harika! Perşembe öğleden sonra 14:30'u ayırdım. Adresimiz 1 Canada Square, Canary Wharf. Görüşürüz! 🦷" },

  // Thomas Hughes — contacted
  { phone: '447700900011', direction: 'inbound',  ai: false, hoursAgoSent: 144,
    content: "Hi, I had an implant consultation elsewhere but felt rushed. Do you offer a more thorough assessment?" },
  { phone: '447700900011', direction: 'outbound', ai: true,  hoursAgoSent: 143,
    content: "Hi Thomas! Absolutely — our implant consultations are 45 minutes with a full digital X-ray and 3D scan at no charge. We take the time to explain every step. Shall I book you in with Dr. Price?" },
  { phone: '447700900011', direction: 'inbound',  ai: false, hoursAgoSent: 130,
    content: "Yes please. What days do you have available?" },
  { phone: '447700900011', direction: 'outbound', ai: true,  hoursAgoSent: 129,
    content: "We have Tuesday at 2pm or Thursday at 10am this week, and multiple slots next week. Which works best for you, Thomas?" },

  // Kerem Demir — booked
  { phone: '447700900013', direction: 'inbound',  ai: false, hoursAgoSent: 264,
    content: "Selam, Invisalign hakkında bilgi almak istiyorum. Ne kadar sürer?" },
  { phone: '447700900013', direction: 'outbound', ai: true,  hoursAgoSent: 263,
    content: "Merhaba Kerem! Elite Dental Manchester'e hoş geldiniz 🦷 Invisalign tedavisi genellikle 6–18 ay sürer, durumunuza göre değişir. Ücretsiz muayenede size özel bir plan hazırlayabiliriz. Bu hafta uygun musunuz?" },
  { phone: '447700900013', direction: 'inbound',  ai: false, hoursAgoSent: 250,
    content: "Evet, Salı günü saat 11 olur mu?" },
  { phone: '447700900013', direction: 'outbound', ai: true,  hoursAgoSent: 249,
    content: "Salı 11:00 confirmed! Sizi bekliyoruz. Adresimiz 47 King Street, Manchester. Herhangi bir sorunuz olursa lütfen yazın 😊" },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seed() {
  console.log('[Demo Seed] Connecting…');

  // 0. Add treatment_value column if it doesn't exist
  await pool.query(`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS treatment_value NUMERIC(10,2)
  `);
  console.log('[Demo Seed] Ensured treatment_value column on leads');

  // 1. Tenants
  const tenantIds = [];
  for (const clinic of CLINICS) {
    const { rows } = await pool.query(`
      INSERT INTO tenants (name, slug, status, plan_tier, country, timezone)
      VALUES ($1, $2, 'active', 'growth', 'GB', 'Europe/London')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
      RETURNING id, name
    `, [clinic.name, clinic.slug]);
    tenantIds.push(rows[0].id);
    console.log(`[Demo Seed] Tenant: "${rows[0].name}" (${rows[0].id})`);
  }

  // 2. Staff users
  const staffPasswordHash = await bcrypt.hash('CareNova2026!', 12);
  for (const staff of STAFF) {
    const tenantId = tenantIds[staff.clinicIdx];
    const { rows } = await pool.query(`
      INSERT INTO users (tenant_id, role_id, email, password_hash, first_name, last_name, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      ON CONFLICT (tenant_id, email) DO UPDATE SET
        first_name    = EXCLUDED.first_name,
        last_name     = EXCLUDED.last_name,
        password_hash = EXCLUDED.password_hash,
        updated_at    = NOW()
      RETURNING id, email
    `, [tenantId, staff.roleId, staff.email, staffPasswordHash, staff.firstName, staff.lastName]);
    console.log(`[Demo Seed] Staff: ${rows[0].email} → clinic ${CLINICS[staff.clinicIdx].name}`);
  }

  // 3. Leads
  const leadIdsByPhone = {};
  for (const l of LEADS_DATA) {
    const tenantId  = tenantIds[l.clinicIdx];
    const createdAt = new Date(Date.now() - l.daysAgoCreated * 86_400_000).toISOString();

    const { rows } = await pool.query(`
      INSERT INTO leads
        (tenant_id, phone, first_name, last_name, language, status, source,
         treatment_interest, treatment_value,
         ai_follow_up_enabled, ai_follow_up_count,
         created_at, updated_at, status_changed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, TRUE, 0, $10, $10, $10)
      ON CONFLICT (tenant_id, phone) DO UPDATE SET
        first_name         = EXCLUDED.first_name,
        last_name          = EXCLUDED.last_name,
        status             = EXCLUDED.status,
        treatment_interest = EXCLUDED.treatment_interest,
        treatment_value    = EXCLUDED.treatment_value,
        updated_at         = NOW()
      RETURNING id, phone, first_name, last_name
    `, [tenantId, l.phone, l.firstName, l.lastName,
        l.language, l.status, l.source,
        l.treatment, l.value, createdAt]);

    leadIdsByPhone[l.phone] = rows[0].id;
    console.log(`[Demo Seed] Lead: ${rows[0].first_name} ${rows[0].last_name} (${l.phone})`);
  }

  // 4. Messages
  let msgCount = 0;
  for (const m of MESSAGES) {
    const leadId = leadIdsByPhone[m.phone];
    if (!leadId) {
      console.warn(`[Demo Seed] No lead found for phone ${m.phone}, skipping message`);
      continue;
    }
    const sentAt = new Date(Date.now() - m.hoursAgoSent * 3_600_000).toISOString();

    await pool.query(`
      INSERT INTO messages
        (tenant_id, lead_id, direction, content, ai_generated, status, sent_at, created_at)
      SELECT
        l.tenant_id, $1, $2::text, $3, $4::boolean,
        'delivered', $5, $5
      FROM leads l WHERE l.id = $1
    `, [leadId, m.direction, m.content, m.ai, sentAt]);
    msgCount++;
  }
  console.log(`[Demo Seed] Inserted ${msgCount} messages`);

  // 5. Update ai_follow_up_count for leads that have outbound AI messages
  await pool.query(`
    UPDATE leads l
    SET ai_follow_up_count = (
      SELECT COUNT(*) FROM messages m
      WHERE m.lead_id = l.id AND m.direction = 'outbound' AND m.ai_generated = TRUE
    ),
    last_ai_message_at = (
      SELECT MAX(created_at) FROM messages m
      WHERE m.lead_id = l.id AND m.direction = 'outbound' AND m.ai_generated = TRUE
    )
    WHERE l.deleted_at IS NULL
  `);
  console.log('[Demo Seed] Updated ai_follow_up_count on all leads');

  await pool.end();
  console.log('[Demo Seed] Done ✅');
}

seed().catch(err => {
  console.error('[Demo Seed] Error:', err.message);
  process.exit(1);
});

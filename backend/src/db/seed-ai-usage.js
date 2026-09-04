/**
 * seed-ai-usage.js
 * Seeds realistic AI activity data for Smile Studio London
 * so the /clinics/:id/ai-usage tab shows meaningful charts and metrics.
 *
 * Run: node src/db/seed-ai-usage.js
 */

require('dotenv').config({ override: true });
const { pool } = require('./index');

const CLINIC_ID = '4b9e8aab-b9ea-4d15-bb2b-ffb90b516225';

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 18) + 7, Math.floor(Math.random() * 60), 0, 0); // 7am–1am
  return d;
}

function hoursLater(date, h) {
  return new Date(date.getTime() + h * 3600 * 1000);
}

function minutesLater(date, m) {
  return new Date(date.getTime() + m * 60 * 1000);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const TREATMENTS = [
  { name: 'Dental Implants',     value: 3200 },
  { name: 'Invisalign',          value: 3800 },
  { name: 'Teeth Whitening',     value: 480  },
  { name: 'Composite Bonding',   value: 650  },
  { name: 'Smile Makeover',      value: 7500 },
  { name: 'Emergency Treatment', value: 250  },
  { name: 'Veneers',             value: 5200 },
  { name: 'Root Canal',          value: 950  },
];

const SCENARIOS = ['new_enquiry', 'finance_objection', 'cold_lead', 'missed_call'];

// Weighted scenarios: new_enquiry most common
const SCENARIO_WEIGHTS = [
  { s: 'new_enquiry',       w: 40 },
  { s: 'finance_objection', w: 25 },
  { s: 'cold_lead',         w: 20 },
  { s: 'missed_call',       w: 15 },
];
function pickScenario() {
  const total = SCENARIO_WEIGHTS.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of SCENARIO_WEIGHTS) { r -= x.w; if (r <= 0) return x.s; }
  return 'new_enquiry';
}

const AI_MESSAGES = {
  new_enquiry: [
    "Hi! Thanks for reaching out to Smile Studio London 😊 I'm Sarah, your patient coordinator. I'd love to help you with your dental enquiry. Could you share a bit more about what you're looking for — implants, whitening, or something else?",
    "Great to hear from you! We have some fantastic availability this week. Our Dental Implants consultation is completely free, and Dr. Ahmed has been getting brilliant results. Would Tuesday or Thursday work for you?",
    "Just following up on your enquiry! We have a special offer running this month — 10% off all implant treatments. Shall I pencil you in for a free consultation? Takes just 30 minutes 🦷",
  ],
  finance_objection: [
    "I completely understand — dental treatment can feel like a big investment! The great news is we offer 0% finance over 12 months, so for example our implants work out to just €267/month. Would that make it more manageable?",
    "No worries at all about budget — we work with everyone. We have a flexible payment plan starting from €99/month. Many of our patients find it much easier that way. Can I send you our finance brochure?",
    "Finance doesn't need to be a barrier 💛 We partner with Chrysalis Finance and can spread the cost over 1–5 years. Want me to run a quick illustration for you with no obligation?",
  ],
  cold_lead: [
    "Hi! It's been a little while since you first got in touch with us. I wanted to check if you're still considering treatment — we have some great availability this month and I'd hate for you to miss out 🦷",
    "Hey! Just a friendly nudge from Smile Studio 😊 Your enquiry is still open with us. Is there anything that held you back — we're happy to answer any questions or concerns you might have!",
    "Hi again! We'd love to welcome you to the Smile Studio family. We have a limited-time consultation offer this month. Still interested? Reply YES and I'll get you booked in straight away!",
  ],
  missed_call: [
    "Hi! We just tried to give you a call but couldn't reach you. No worries — you can reply here to arrange a callback, or I can help you book directly via WhatsApp. What works best for you? 😊",
    "Hey, we missed each other on the phone! We'd love to connect — when's the best time for a quick 5-minute call? Or if you prefer, I can answer any questions right here.",
    "Sorry we missed you! Our patient coordinator tried to reach you about your dental enquiry. Feel free to reply here or give us a call on 020 7946 0823 whenever convenient 🙂",
  ],
};

const PATIENT_REPLIES = [
  "Yes that sounds good, what availability do you have?",
  "I'm interested, can you tell me more about the process?",
  "That 0% finance option sounds perfect actually!",
  "Can I come in this week? I'm free Thursday afternoon",
  "Thanks for following up! I was meaning to get back to you",
  "Is the consultation really free? I'd love to come in",
  "Could you send me some more info please?",
  "I need to check my diary but probably yes",
  "Yes I'm still interested! Can you book me in?",
  "Thank you, I'll discuss with my partner and get back to you",
];

// ── Lead definitions ──────────────────────────────────────────────────────────

// 45 new leads spread over 12 weeks (days ago from today)
// language distribution: ~60% EN, ~25% TR, ~15% AR (London realistic)
const LEADS = [
  // ── 10–12 weeks ago (heavy historical volume) ───────────────────────────
  { first: 'Oliver',    last: 'Smith',     phone: '+447700900101', lang: 'en', daysAgo: 83, status: 'attended',  responded: true,  booked: true  },
  { first: 'Charlotte', last: 'Jones',     phone: '+447700900102', lang: 'en', daysAgo: 81, status: 'booked',   responded: true,  booked: true  },
  { first: 'Mehmet',    last: 'Kaya',      phone: '+447700900103', lang: 'tr', daysAgo: 80, status: 'qualified', responded: true,  booked: false },
  { first: 'Omar',      last: 'Al-Rashid', phone: '+447700900104', lang: 'ar', daysAgo: 78, status: 'lost',     responded: false, booked: false },
  { first: 'Sophie',    last: 'Wilson',    phone: '+447700900105', lang: 'en', daysAgo: 76, status: 'attended',  responded: true,  booked: true  },

  // ── 8–10 weeks ago ───────────────────────────────────────────────────────
  { first: 'William',   last: 'Brown',     phone: '+447700900106', lang: 'en', daysAgo: 70, status: 'booked',   responded: true,  booked: true  },
  { first: 'Zeynep',    last: 'Demir',     phone: '+447700900107', lang: 'tr', daysAgo: 68, status: 'responded', responded: true,  booked: false },
  { first: 'Layla',     last: 'Nasser',    phone: '+447700900108', lang: 'ar', daysAgo: 67, status: 'booked',   responded: true,  booked: true  },
  { first: 'Jack',      last: 'Taylor',    phone: '+447700900109', lang: 'en', daysAgo: 65, status: 'attended',  responded: true,  booked: true  },
  { first: 'Ali',       last: 'Yıldız',    phone: '+447700900110', lang: 'tr', daysAgo: 63, status: 'lost',     responded: false, booked: false },

  // ── 6–8 weeks ago ────────────────────────────────────────────────────────
  { first: 'Ella',      last: 'Anderson',  phone: '+447700900111', lang: 'en', daysAgo: 56, status: 'attended',  responded: true,  booked: true  },
  { first: 'Khalid',    last: 'Ibrahim',   phone: '+447700900112', lang: 'ar', daysAgo: 54, status: 'qualified', responded: true,  booked: false },
  { first: 'Selin',     last: 'Arslan',    phone: '+447700900113', lang: 'tr', daysAgo: 52, status: 'booked',   responded: true,  booked: true  },
  { first: 'Harry',     last: 'Davies',    phone: '+447700900114', lang: 'en', daysAgo: 50, status: 'attended',  responded: true,  booked: true  },
  { first: 'Sara',      last: 'Mansour',   phone: '+447700900115', lang: 'ar', daysAgo: 49, status: 'responded', responded: true,  booked: false },

  // ── 5–6 weeks ago ────────────────────────────────────────────────────────
  { first: 'Mia',       last: 'Roberts',   phone: '+447700900116', lang: 'en', daysAgo: 42, status: 'attended',  responded: true,  booked: true  },
  { first: 'Burak',     last: 'Çelik',     phone: '+447700900117', lang: 'tr', daysAgo: 40, status: 'qualified', responded: true,  booked: false },
  { first: 'Amira',     last: 'Hassan',    phone: '+447700900118', lang: 'ar', daysAgo: 39, status: 'booked',   responded: true,  booked: true  },
  { first: 'George',    last: 'Walker',    phone: '+447700900119', lang: 'en', daysAgo: 38, status: 'attended',  responded: true,  booked: true  },
  { first: 'Isla',      last: 'Wright',    phone: '+447700900120', lang: 'en', daysAgo: 36, status: 'lost',     responded: false, booked: false },

  // ── 4–5 weeks ago ────────────────────────────────────────────────────────
  { first: 'Noah',      last: 'Green',     phone: '+447700900121', lang: 'en', daysAgo: 34, status: 'booked',   responded: true,  booked: true  },
  { first: 'Fatima',    last: 'Öztürk',    phone: '+447700900122', lang: 'tr', daysAgo: 33, status: 'responded', responded: true,  booked: false },
  { first: 'Yusuf',     last: 'Al-Amin',   phone: '+447700900123', lang: 'ar', daysAgo: 32, status: 'attended',  responded: true,  booked: true  },
  { first: 'Amelia',    last: 'Hall',      phone: '+447700900124', lang: 'en', daysAgo: 31, status: 'attended',  responded: true,  booked: true  },
  { first: 'Liam',      last: 'Allen',     phone: '+447700900125', lang: 'en', daysAgo: 29, status: 'booked',   responded: true,  booked: true  },

  // ── 3–4 weeks ago (last month — important for comparison) ────────────────
  { first: 'Chloe',     last: 'Young',     phone: '+447700900126', lang: 'en', daysAgo: 26, status: 'qualified', responded: true,  booked: false },
  { first: 'Asel',      last: 'Demirci',   phone: '+447700900127', lang: 'tr', daysAgo: 25, status: 'booked',   responded: true,  booked: true  },
  { first: 'Hana',      last: 'Al-Sayed',  phone: '+447700900128', lang: 'ar', daysAgo: 24, status: 'attended',  responded: true,  booked: true  },
  { first: 'Freddie',   last: 'King',      phone: '+447700900129', lang: 'en', daysAgo: 22, status: 'responded', responded: true,  booked: false },
  { first: 'Isabella',  last: 'Scott',     phone: '+447700900130', lang: 'en', daysAgo: 21, status: 'attended',  responded: true,  booked: true  },

  // ── 2–3 weeks ago ────────────────────────────────────────────────────────
  { first: 'Tarık',     last: 'Yılmaz',    phone: '+447700900131', lang: 'tr', daysAgo: 19, status: 'qualified', responded: true,  booked: false },
  { first: 'Nour',      last: 'Abbas',     phone: '+447700900132', lang: 'ar', daysAgo: 18, status: 'booked',   responded: true,  booked: true  },
  { first: 'Alfie',     last: 'Mitchell',  phone: '+447700900133', lang: 'en', daysAgo: 17, status: 'attended',  responded: true,  booked: true  },
  { first: 'Grace',     last: 'Turner',    phone: '+447700900134', lang: 'en', daysAgo: 16, status: 'responded', responded: true,  booked: false },
  { first: 'Berk',      last: 'Koç',       phone: '+447700900135', lang: 'tr', daysAgo: 14, status: 'lost',     responded: false, booked: false },

  // ── Last week (current data — this month) ───────────────────────────────
  { first: 'Poppy',     last: 'Phillips',  phone: '+447700900136', lang: 'en', daysAgo: 12, status: 'booked',   responded: true,  booked: true  },
  { first: 'Yasmin',    last: 'Kahraman',  phone: '+447700900137', lang: 'tr', daysAgo: 11, status: 'qualified', responded: true,  booked: false },
  { first: 'Sami',      last: 'Haddad',    phone: '+447700900138', lang: 'ar', daysAgo: 10, status: 'responded', responded: true,  booked: false },
  { first: 'Leo',       last: 'Campbell',  phone: '+447700900139', lang: 'en', daysAgo: 8,  status: 'booked',   responded: true,  booked: true  },
  { first: 'Lily',      last: 'Evans',     phone: '+447700900140', lang: 'en', daysAgo: 7,  status: 'responded', responded: true,  booked: false },

  // ── This week (very recent) ──────────────────────────────────────────────
  { first: 'Dylan',     last: 'Murray',    phone: '+447700900141', lang: 'en', daysAgo: 5,  status: 'qualified', responded: true,  booked: false },
  { first: 'Elif',      last: 'Şahin',     phone: '+447700900142', lang: 'tr', daysAgo: 4,  status: 'responded', responded: true,  booked: false },
  { first: 'Rania',     last: 'Khalil',    phone: '+447700900143', lang: 'ar', daysAgo: 3,  status: 'new',      responded: false, booked: false },
  { first: 'Emily',     last: 'Hughes',    phone: '+447700900144', lang: 'en', daysAgo: 2,  status: 'contacted', responded: false, booked: false },
  { first: 'Hugo',      last: 'Price',     phone: '+447700900145', lang: 'en', daysAgo: 1,  status: 'new',      responded: false, booked: false },
];

// ── Main seed function ────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱  Seeding AI usage data for Smile Studio London…');
  const client = await pool.connect();

  let leadsInserted   = 0;
  let messagesInserted = 0;

  try {
    await client.query('BEGIN');

    for (const lead of LEADS) {
      const treatment = pick(TREATMENTS);
      const scenario  = pickScenario();
      const leadDate  = daysAgo(lead.daysAgo);

      // ── Insert lead ────────────────────────────────────────────────────────
      const leadRes = await client.query(`
        INSERT INTO leads
          (tenant_id, first_name, last_name, phone, language, status, source,
           treatment_interest, treatment_value, ai_follow_up_enabled, ai_follow_up_count,
           last_ai_message_at, created_at, updated_at, status_changed_at)
        VALUES ($1,$2,$3,$4,$5,$6,'whatsapp',$7,$8,TRUE,0,$9,$9,$9,$9)
        ON CONFLICT (tenant_id, phone) DO NOTHING
        RETURNING id
      `, [
        CLINIC_ID, lead.first, lead.last, lead.phone, lead.lang, lead.status,
        treatment.name, treatment.value,
        leadDate.toISOString(),
      ]);

      if (!leadRes.rows.length) {
        console.log(`  ⏭  Skipped ${lead.first} ${lead.last} (phone conflict)`);
        continue;
      }
      const leadId = leadRes.rows[0].id;
      leadsInserted++;

      // ── Response time: realistic random 2 min → 4 hours ───────────────────
      const responseMinutes = Math.floor(2 + Math.random() * 230); // 2–232 min

      // ── First inbound (lead enquiry) ───────────────────────────────────────
      const inbound1At = leadDate;
      await client.query(`
        INSERT INTO messages
          (tenant_id, lead_id, direction, content, ai_generated, status,
           scenario_type, sent_at, created_at)
        VALUES ($1,$2,'inbound',$3,FALSE,'delivered',$4,$5,$5)
      `, [
        CLINIC_ID, leadId,
        `Hi, I'm interested in ${treatment.name} at your clinic. Could you give me more details?`,
        scenario,
        inbound1At.toISOString(),
      ]);
      messagesInserted++;

      // ── First AI outbound reply (fast, within responseMinutes) ────────────
      const outbound1At = minutesLater(inbound1At, responseMinutes);
      const aiMsg1 = pick(AI_MESSAGES[scenario]);
      await client.query(`
        INSERT INTO messages
          (tenant_id, lead_id, direction, content, ai_generated, status,
           scenario_type, sent_at, created_at)
        VALUES ($1,$2,'outbound',$3,TRUE,'delivered',$4,$5,$5)
      `, [
        CLINIC_ID, leadId, aiMsg1, scenario,
        outbound1At.toISOString(),
      ]);
      messagesInserted++;

      // Update lead's last_ai_message_at
      await client.query(
        `UPDATE leads SET last_ai_message_at = $1, ai_follow_up_count = 1 WHERE id = $2`,
        [outbound1At.toISOString(), leadId]
      );

      // ── Optional: patient reply ────────────────────────────────────────────
      if (lead.responded) {
        const replyAt = hoursLater(outbound1At, 1 + Math.random() * 6);
        await client.query(`
          INSERT INTO messages
            (tenant_id, lead_id, direction, content, ai_generated, status, sent_at, created_at)
          VALUES ($1,$2,'inbound',$3,FALSE,'delivered',$4,$4)
        `, [
          CLINIC_ID, leadId,
          pick(PATIENT_REPLIES),
          replyAt.toISOString(),
        ]);
        messagesInserted++;

        // Second AI follow-up after reply
        const outbound2At = minutesLater(replyAt, 3 + Math.floor(Math.random() * 15));
        const aiMsg2 = pick(AI_MESSAGES[scenario]);
        await client.query(`
          INSERT INTO messages
            (tenant_id, lead_id, direction, content, ai_generated, status,
             scenario_type, sent_at, created_at)
          VALUES ($1,$2,'outbound',$3,TRUE,'delivered',$4,$5,$5)
        `, [
          CLINIC_ID, leadId, aiMsg2, scenario,
          outbound2At.toISOString(),
        ]);
        messagesInserted++;

        await client.query(
          `UPDATE leads SET last_ai_message_at = $1, ai_follow_up_count = 2 WHERE id = $2`,
          [outbound2At.toISOString(), leadId]
        );

        // Mark as read if booked
        if (lead.booked) {
          await client.query(
            `UPDATE messages SET status = 'read' WHERE lead_id = $1 AND direction = 'outbound'`,
            [leadId]
          );
        }
      }

      // ── For older leads: add a third follow-up (cold lead re-engagement) ──
      if (lead.daysAgo > 20 && lead.responded && Math.random() > 0.4) {
        const followupAt = hoursLater(outbound1At, 24 + Math.random() * 72);
        const scenario2  = Math.random() > 0.5 ? 'cold_lead' : scenario;
        await client.query(`
          INSERT INTO messages
            (tenant_id, lead_id, direction, content, ai_generated, status,
             scenario_type, sent_at, created_at)
          VALUES ($1,$2,'outbound',$3,TRUE,'delivered',$4,$5,$5)
        `, [
          CLINIC_ID, leadId,
          pick(AI_MESSAGES[scenario2]),
          scenario2,
          followupAt.toISOString(),
        ]);
        messagesInserted++;
        await client.query(
          `UPDATE leads SET last_ai_message_at = $1, ai_follow_up_count = 3 WHERE id = $2`,
          [followupAt.toISOString(), leadId]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`✅  Done! Inserted ${leadsInserted} leads and ${messagesInserted} messages.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));

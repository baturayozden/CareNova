/**
 * Full demo seed — 3 clinics, all 5 roles, 30 leads (EN/TR/AR), 80+ messages
 * with scenario_type, objection_type, varied statuses and realistic conversations.
 *
 * Safe to re-run — uses ON CONFLICT upserts throughout.
 * Usage: node src/db/seed-full.js
 */

require('dotenv').config({ override: true, path: require('path').join(__dirname, '../../.env') });

const bcrypt   = require('bcryptjs');
const { pool } = require('./index');

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n, h = 0) {
  return new Date(Date.now() - (n * 86_400_000 + h * 3_600_000)).toISOString();
}
function hoursAgo(n) {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}
function minsAfter(iso, mins) {
  return new Date(new Date(iso).getTime() + mins * 60_000).toISOString();
}

// ── Clinics ───────────────────────────────────────────────────────────────────

const CLINICS = [
  {
    name: 'Smile Studio London',
    slug: 'smile-studio-london',
    address: '25 Harley Street, London W1G 9QW',
    phone: '+44 20 7946 0200',
    email: 'hello@smilestudio.co.uk',
    website: 'https://smilestudio.co.uk',
    planTier: 'pro',
    aiLimit: 500,
    aiPolicy: 'notify',
  },
  {
    name: 'Pearl Dental Canary Wharf',
    slug: 'pearl-dental-canary-wharf',
    address: '1 Canada Square, London E14 5AB',
    phone: '+44 20 7946 0300',
    email: 'info@pearldental.co.uk',
    website: 'https://pearldental.co.uk',
    planTier: 'growth',
    aiLimit: 300,
    aiPolicy: 'block',
  },
  {
    name: 'Elite Dental Manchester',
    slug: 'elite-dental-manchester',
    address: '47 King Street, Manchester M2 7AT',
    phone: '+44 161 946 0100',
    email: 'contact@elitedental.co.uk',
    website: 'https://elitedental.co.uk',
    planTier: 'starter',
    aiLimit: 150,
    aiPolicy: 'notify',
  },
];

// ── Staff (all 5 roles represented) ──────────────────────────────────────────

const STAFF = [
  // Smile Studio London  (clinicIdx: 0)
  { email: 'dr.natasha.reed@smilestudio.co.uk',    firstName: 'Natasha',  lastName: 'Reed',     roleId: 2, clinicIdx: 0 }, // director
  { email: 'sarah.nelson@smilestudio.co.uk',        firstName: 'Sarah',    lastName: 'Nelson',   roleId: 3, clinicIdx: 0 }, // clinic_admin
  { email: 'amy.cooper@smilestudio.co.uk',          firstName: 'Amy',      lastName: 'Cooper',   roleId: 6, clinicIdx: 0 }, // treatment_coordinator
  { email: 'tom.archer@smilestudio.co.uk',          firstName: 'Tom',      lastName: 'Archer',   roleId: 4, clinicIdx: 0 }, // receptionist
  { email: 'dr.james.white@smilestudio.co.uk',      firstName: 'James',    lastName: 'White',    roleId: 5, clinicIdx: 0 }, // dentist

  // Pearl Dental Canary Wharf  (clinicIdx: 1)
  { email: 'dr.victoria.stone@pearldental.co.uk',   firstName: 'Victoria', lastName: 'Stone',    roleId: 2, clinicIdx: 1 }, // director
  { email: 'jessica.cole@pearldental.co.uk',        firstName: 'Jessica',  lastName: 'Cole',     roleId: 3, clinicIdx: 1 }, // clinic_admin
  { email: 'laura.chan@pearldental.co.uk',           firstName: 'Laura',    lastName: 'Chan',     roleId: 6, clinicIdx: 1 }, // treatment_coordinator
  { email: 'mike.foster@pearldental.co.uk',         firstName: 'Mike',     lastName: 'Foster',   roleId: 4, clinicIdx: 1 }, // receptionist

  // Elite Dental Manchester  (clinicIdx: 2)
  { email: 'rachel.hunt@elitedental.co.uk',         firstName: 'Rachel',   lastName: 'Hunt',     roleId: 3, clinicIdx: 2 }, // clinic_admin
  { email: 'daniel.price@elitedental.co.uk',        firstName: 'Daniel',   lastName: 'Price',    roleId: 4, clinicIdx: 2 }, // receptionist
  { email: 'dr.anna.walsh@elitedental.co.uk',       firstName: 'Anna',     lastName: 'Walsh',    roleId: 5, clinicIdx: 2 }, // dentist
];

// ── Leads ─────────────────────────────────────────────────────────────────────

const LEADS = [
  // ── Smile Studio London ─────────────────────────────────────────────────
  {
    clinicIdx: 0, firstName: 'Emma',    lastName: 'Thompson',
    phone: '447700900001', language: 'en', status: 'booked',
    treatment: 'Teeth Whitening',         value: 380,  source: 'website',       daysAgo: 2,
  },
  {
    clinicIdx: 0, firstName: 'Fatma',   lastName: 'Yılmaz',
    phone: '447700900002', language: 'tr', status: 'responded',
    treatment: 'Porcelain Veneers',       value: 2800, source: 'ad_campaign',   daysAgo: 5,
  },
  {
    clinicIdx: 0, firstName: 'Ahmed',   lastName: 'Hassan',
    phone: '447700900003', language: 'ar', status: 'booked',
    treatment: 'Dental Implants',         value: 3500, source: 'referral',      daysAgo: 8,
  },
  {
    clinicIdx: 0, firstName: 'James',   lastName: 'Mitchell',
    phone: '447700900004', language: 'en', status: 'lost',
    treatment: 'Invisalign',              value: 2400, source: 'website',       daysAgo: 14,
  },
  {
    clinicIdx: 0, firstName: 'Priya',   lastName: 'Patel',
    phone: '447700900005', language: 'en', status: 'contacted',
    treatment: 'Full Mouth Rehabilitation', value: 8500, source: 'missed_call', daysAgo: 3,
  },
  {
    clinicIdx: 0, firstName: 'Selin',   lastName: 'Yıldız',
    phone: '447700900016', language: 'tr', status: 'new',
    treatment: 'Dental Implants',         value: 4200, source: 'whatsapp',      daysAgo: 1,
  },
  {
    clinicIdx: 0, firstName: 'Omar',    lastName: 'Al-Farsi',
    phone: '447700900017', language: 'ar', status: 'qualified',
    treatment: 'Smile Makeover',          value: 12000, source: 'referral',     daysAgo: 6,
  },
  {
    clinicIdx: 0, firstName: 'Lucy',    lastName: 'Andrews',
    phone: '447700900018', language: 'en', status: 'attended',
    treatment: 'Composite Bonding',       value: 900,  source: 'website',       daysAgo: 10,
  },
  {
    clinicIdx: 0, firstName: 'Burak',   lastName: 'Çelik',
    phone: '447700900019', language: 'tr', status: 'contacted',
    treatment: 'Teeth Whitening',         value: 350,  source: 'ad_campaign',   daysAgo: 4,
  },
  {
    clinicIdx: 0, firstName: 'Nour',    lastName: 'Ibrahim',
    phone: '447700900020', language: 'ar', status: 'responded',
    treatment: 'Veneers + Whitening',     value: 3600, source: 'website',       daysAgo: 7,
  },

  // ── Pearl Dental Canary Wharf ────────────────────────────────────────────
  {
    clinicIdx: 1, firstName: 'Oliver',  lastName: 'Clarke',
    phone: '447700900006', language: 'en', status: 'contacted',
    treatment: 'Porcelain Veneers',       value: 3200, source: 'ad_campaign',   daysAgo: 5,
  },
  {
    clinicIdx: 1, firstName: 'Zeynep',  lastName: 'Kaya',
    phone: '447700900007', language: 'tr', status: 'booked',
    treatment: 'Invisalign',              value: 2900, source: 'website',       daysAgo: 9,
  },
  {
    clinicIdx: 1, firstName: 'Mohamed', lastName: 'Al-Rashid',
    phone: '447700900008', language: 'ar', status: 'new',
    treatment: 'Dental Implants',         value: 4200, source: 'referral',      daysAgo: 1,
  },
  {
    clinicIdx: 1, firstName: 'Charlotte',lastName: 'Davies',
    phone: '447700900009', language: 'en', status: 'booked',
    treatment: 'Teeth Whitening',         value: 420,  source: 'website',       daysAgo: 11,
  },
  {
    clinicIdx: 1, firstName: 'Aisha',   lastName: 'Mahmoud',
    phone: '447700900010', language: 'ar', status: 'lost',
    treatment: 'Full Mouth Rehabilitation', value: 7800, source: 'missed_call', daysAgo: 15,
  },
  {
    clinicIdx: 1, firstName: 'Harry',   lastName: 'Evans',
    phone: '447700900021', language: 'en', status: 'responded',
    treatment: 'Invisalign',              value: 3100, source: 'website',       daysAgo: 3,
  },
  {
    clinicIdx: 1, firstName: 'Elif',    lastName: 'Şahin',
    phone: '447700900022', language: 'tr', status: 'qualified',
    treatment: 'Dental Implants x2',      value: 6800, source: 'referral',      daysAgo: 6,
  },

  // ── Elite Dental Manchester ──────────────────────────────────────────────
  {
    clinicIdx: 2, firstName: 'Thomas',  lastName: 'Hughes',
    phone: '447700900011', language: 'en', status: 'contacted',
    treatment: 'Dental Implants',         value: 4500, source: 'ad_campaign',   daysAgo: 6,
  },
  {
    clinicIdx: 2, firstName: 'Sofia',   lastName: 'Martinez',
    phone: '447700900012', language: 'en', status: 'new',
    treatment: 'Porcelain Veneers',       value: 2600, source: 'website',       daysAgo: 1,
  },
  {
    clinicIdx: 2, firstName: 'Kerem',   lastName: 'Demir',
    phone: '447700900013', language: 'tr', status: 'booked',
    treatment: 'Invisalign',              value: 3100, source: 'referral',      daysAgo: 12,
  },
  {
    clinicIdx: 2, firstName: 'William', lastName: 'Brown',
    phone: '447700900014', language: 'en', status: 'responded',
    treatment: 'Teeth Whitening',         value: 460,  source: 'website',       daysAgo: 5,
  },
  {
    clinicIdx: 2, firstName: 'Layla',   lastName: 'Al-Amin',
    phone: '447700900015', language: 'ar', status: 'contacted',
    treatment: 'Full Mouth Rehabilitation', value: 6200, source: 'missed_call', daysAgo: 2,
  },
  {
    clinicIdx: 2, firstName: 'Jack',    lastName: 'Taylor',
    phone: '447700900023', language: 'en', status: 'booked',
    treatment: 'Composite Bonding',       value: 750,  source: 'website',       daysAgo: 7,
  },
  {
    clinicIdx: 2, firstName: 'Ayşe',   lastName: 'Öztürk',
    phone: '447700900024', language: 'tr', status: 'new',
    treatment: 'Dental Implants',         value: 3800, source: 'ad_campaign',   daysAgo: 1,
  },
];

// ── Messages ──────────────────────────────────────────────────────────────────
// Each entry: { phone, msgs: [{ dir, ai, minsAfterFirst, content, scenario?, objection? }] }

const CONVERSATIONS = [
  // Emma Thompson — EN, Teeth Whitening, booked ✅
  {
    phone: '447700900001',
    firstMsgHoursAgo: 50,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'price_too_high',
        content: "Hi, I saw your offer for teeth whitening. How much does it cost and how long does it take?" },
      { dir: 'outbound', ai: true,  min: 2,   scenario: 'new_enquiry',
        content: "Hi Emma! Thanks for reaching out to Smile Studio London 😊 Our professional whitening starts from €380 and takes about 60–90 mins. Would you like a free consultation this week?" },
      { dir: 'inbound',  ai: false, min: 35,  objection: 'timing_issue',
        content: "That sounds great but I'm quite busy this month. Could I book for next week?" },
      { dir: 'outbound', ai: true,  min: 37,  scenario: 'new_enquiry',
        content: "Of course! We have slots available all of next week. Tuesday at 2pm or Thursday at 10am — which works best for you? 😊" },
      { dir: 'inbound',  ai: false, min: 60,  objection: null,
        content: "Thursday 10am works perfectly!" },
      { dir: 'outbound', ai: true,  min: 61,  scenario: 'new_enquiry',
        content: "Thursday 10am is confirmed, Emma 🎉 See you at 25 Harley Street. We'll send a reminder the day before!" },
    ],
  },

  // Fatma Yılmaz — TR, Veneers, responded
  {
    phone: '447700900002',
    firstMsgHoursAgo: 120,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'price_too_high',
        content: "Merhabalar, veneer fiyatlarınız hakkında bilgi almak istiyorum. Çok pahalı olmasın diye soruyorum." },
      { dir: 'outbound', ai: true,  min: 3,   scenario: 'finance_objection',
        content: "Merhaba Fatma Hanım! Porselen veneer fiyatlarımız diş başına €700'den başlıyor. Ayrıca 0% faizli taksit seçeneklerimiz de mevcut. Ücretsiz danışma için gelin, size en uygun planı hazırlayalım 😊" },
      { dir: 'inbound',  ai: false, min: 90,  objection: 'finance_options',
        content: "Taksit seçeneği var mı? Kaç taksit yapılabiliyor?" },
      { dir: 'outbound', ai: true,  min: 92,  scenario: 'finance_objection',
        content: "Evet, 12 ay 0% faizli ödeme planı sunuyoruz! 4 veneer için aylık sadece €233 oluyor. Nasıl bir ön değerlendirme yapalım mı?" },
    ],
  },

  // Ahmed Hassan — AR, Implants, booked
  {
    phone: '447700900003',
    firstMsgHoursAgo: 192,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'general_enquiry',
        content: "السلام عليكم، أريد الاستفسار عن زراعة الأسنان وكم تكلف" },
      { dir: 'outbound', ai: true,  min: 2,   scenario: 'new_enquiry',
        content: "وعليكم السلام أحمد! أهلاً بك في Smile Studio London 🦷 زراعة الأسنان لدينا تبدأ من €1,200 للسن مع استشارة مجانية وأشعة ثلاثية الأبعاد. هل ترغب في حجز موعد هذا الأسبوع؟" },
      { dir: 'inbound',  ai: false, min: 120, objection: 'trust_concern',
        content: "هل الأطباء لديكم متخصصون في زراعة الأسنان؟ أريد التأكد من الجودة" },
      { dir: 'outbound', ai: true,  min: 122, scenario: 'new_enquiry',
        content: "بالتأكيد! فريقنا يضم أطباء متخصصين مع أكثر من 10 سنوات خبرة في زراعة الأسنان ومعتمدون من الجمعية البريطانية لطب الأسنان. يمكنك الاطلاع على ملفاتهم في موقعنا. 🦷" },
      { dir: 'inbound',  ai: false, min: 200, objection: null,
        content: "نعم أريد حجز موعد الأسبوع القادم" },
      { dir: 'outbound', ai: true,  min: 202, scenario: 'new_enquiry',
        content: "ممتاز! تم تأكيد موعدك يوم الإثنين الساعة 10 صباحاً. سنرسل لك التأكيد والعنوان قريباً 😊" },
    ],
  },

  // James Mitchell — EN, Invisalign, lost 😔
  {
    phone: '447700900004',
    firstMsgHoursAgo: 336,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'comparing_competitors',
        content: "I've been quoted €2,200 by another clinic for Invisalign. Can you match that?" },
      { dir: 'outbound', ai: true,  min: 3,   scenario: 'finance_objection',
        content: "Hi James! Our Invisalign starts from €2,400 but includes free retainers (worth €300), monthly check-ins, and our 5-year guarantee. Would you like a free 3D scan to see the difference in your plan? 😊" },
      { dir: 'inbound',  ai: false, min: 1440, objection: 'comparing_competitors',
        content: "I've decided to go with the other clinic. Thanks anyway." },
      { dir: 'outbound', ai: true,  min: 1443, scenario: 'cold_lead',
        content: "Completely understand, James. If you ever have any questions or want a second opinion, we're always here. Wishing you all the best with your treatment! 😊" },
    ],
  },

  // Oliver Clarke — EN, Veneers, contacted
  {
    phone: '447700900006',
    firstMsgHoursAgo: 96,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'general_enquiry',
        content: "Hello, I'm interested in getting veneers. I have a gap between my front teeth and some discolouration." },
      { dir: 'outbound', ai: true,  min: 2,   scenario: 'new_enquiry',
        content: "Hi Oliver! Veneers are perfect for gaps and discolouration — we see brilliant results every day ✨ Our free consultations include photos and a digital mock-up. Can I book you in this week?" },
      { dir: 'inbound',  ai: false, min: 240, objection: 'price_too_high',
        content: "That sounds good, but what's the rough cost for 4 veneers? My budget is quite tight." },
      { dir: 'outbound', ai: true,  min: 242, scenario: 'finance_objection',
        content: "For 4 porcelain veneers you're looking at €2,800–€3,200. We also offer 12-month 0% finance — about €233/month. The free consultation is the best way to get your exact quote. Shall I suggest some slots?" },
    ],
  },

  // Zeynep Kaya — TR, Invisalign, booked
  {
    phone: '447700900007',
    firstMsgHoursAgo: 168,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'general_enquiry',
        content: "Merhaba, Invisalign fiyatları ne kadar? Dişlerim biraz eğri." },
      { dir: 'outbound', ai: true,  min: 2,   scenario: 'new_enquiry',
        content: "Merhaba Zeynep Hanım! Pearl Dental'a hoş geldiniz 😊 Invisalign €2,400'den başlıyor. Ücretsiz 3D tarama ile size özel plan hazırlayabiliriz. Bu hafta uygun musunuz?" },
      { dir: 'inbound',  ai: false, min: 180, objection: 'timing_issue',
        content: "Bu hafta biraz yoğunum, gelecek hafta uygun olabilirim." },
      { dir: 'outbound', ai: true,  min: 182, scenario: 'new_enquiry',
        content: "Tabii! Gelecek hafta Salı 14:30 veya Perşembe 10:00 mevcut. Hangisi uygun?" },
      { dir: 'inbound',  ai: false, min: 300, objection: null,
        content: "Perşembe 10 uyar" },
      { dir: 'outbound', ai: true,  min: 301, scenario: 'new_enquiry',
        content: "Harika! Perşembe 10:00 confirmed! 🎉 Adresimiz 1 Canada Square, Canary Wharf. Görüşürüz!" },
    ],
  },

  // Mohamed Al-Rashid — AR, Implants, new
  {
    phone: '447700900008',
    firstMsgHoursAgo: 8,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'general_enquiry',
        content: "مرحباً، أريد معلومات عن زراعة الأسنان. كم السعر؟" },
      { dir: 'outbound', ai: true,  min: 1,   scenario: 'new_enquiry',
        content: "أهلاً محمد! زراعة الأسنان في Pearl Dental تبدأ من €1,200 مع استشارة مجانية. هل تريد حجز موعد لتقييم مجاني؟ 🦷" },
    ],
  },

  // Aisha Mahmoud — AR, Full Mouth Rehab, lost
  {
    phone: '447700900010',
    firstMsgHoursAgo: 360,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'price_too_high',
        content: "السعر غالي جداً! وجدت عيادة أخرى أرخص بكثير" },
      { dir: 'outbound', ai: true,  min: 3,   scenario: 'finance_objection',
        content: "نفهم تماماً يا عائشة. نقدم خطط دفع مرنة تصل إلى 24 شهراً. جودة العلاج والضمان الذي نقدمه يجعلان الفرق في السعر يستحق. هل يمكننا أن نعرض عليك مقارنة مفصلة؟" },
      { dir: 'inbound',  ai: false, min: 2880, objection: null,
        content: "لا شكراً، قررت الذهاب للعيادة الأخرى" },
    ],
  },

  // Thomas Hughes — EN, Implants, contacted
  {
    phone: '447700900011',
    firstMsgHoursAgo: 144,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'trust_concern',
        content: "Hi, I had an implant consultation elsewhere but felt rushed. Do you do a thorough assessment?" },
      { dir: 'outbound', ai: true,  min: 2,   scenario: 'new_enquiry',
        content: "Hi Thomas! Absolutely — our implant consultations are 45 minutes with a full digital X-ray and 3D scan, completely free. We take our time with every patient. Shall I book you in with Dr. Walsh? 😊" },
      { dir: 'inbound',  ai: false, min: 180, objection: 'availability',
        content: "I can only do weekday mornings. Do you have anything before 11am?" },
      { dir: 'outbound', ai: true,  min: 182, scenario: 'new_enquiry',
        content: "Yes! We have Tuesday at 9am and Thursday at 10am this week. Which would work for you, Thomas?" },
    ],
  },

  // Kerem Demir — TR, Invisalign, booked
  {
    phone: '447700900013',
    firstMsgHoursAgo: 288,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'general_enquiry',
        content: "Selam, Invisalign hakkında bilgi almak istiyorum. Ne kadar sürer ve fiyat?" },
      { dir: 'outbound', ai: true,  min: 2,   scenario: 'new_enquiry',
        content: "Merhaba Kerem! Elite Dental Manchester'e hoş geldiniz 🦷 Invisalign genellikle 6–18 ay sürer, €2,200'den başlıyor. Ücretsiz 3D taramayla başlayalım mı?" },
      { dir: 'inbound',  ai: false, min: 45,  objection: 'finance_options',
        content: "Taksit imkanı var mı?" },
      { dir: 'outbound', ai: true,  min: 46,  scenario: 'finance_objection',
        content: "Evet! 12 ay 0% faizli ödeme planımız var, aylık yaklaşık €183. Salı 11:00 için yer ayıralım mı?" },
      { dir: 'inbound',  ai: false, min: 120, objection: null,
        content: "Evet Salı 11 uyar" },
      { dir: 'outbound', ai: true,  min: 121, scenario: 'new_enquiry',
        content: "Salı 11:00 confirmed! ✅ 47 King Street, Manchester'de sizi bekliyoruz. Herhangi bir sorunuz olursa yazın!" },
    ],
  },

  // William Brown — EN, Teeth Whitening, responded
  {
    phone: '447700900014',
    firstMsgHoursAgo: 72,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'anxiety_fear',
        content: "Hi. I want whitening but I'm worried about sensitivity. My teeth are quite sensitive already." },
      { dir: 'outbound', ai: true,  min: 2,   scenario: 'new_enquiry',
        content: "Hi William! That's a really common concern 😊 We use a gentle desensitising formula and can adjust the treatment for sensitive teeth. Many of our patients with sensitivity love the results. Would you like a free assessment?" },
      { dir: 'inbound',  ai: false, min: 180, objection: null,
        content: "Yes that sounds reassuring. What days do you have?" },
      { dir: 'outbound', ai: true,  min: 181, scenario: 'new_enquiry',
        content: "We have Wednesday at 3pm or Friday at 11am this week. Which works for you, William? 😊" },
    ],
  },

  // Layla Al-Amin — AR, Full Mouth Rehab, contacted
  {
    phone: '447700900015',
    firstMsgHoursAgo: 48,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'general_enquiry',
        content: "السلام عليكم. أريد استعادة ابتسامتي بالكامل. ما هي الخيارات المتاحة؟" },
      { dir: 'outbound', ai: true,  min: 2,   scenario: 'new_enquiry',
        content: "وعليكم السلام ليلى! نقدم في Elite Dental برامج متكاملة لإعادة تأهيل الابتسامة تشمل التيجان والزرع والفينير. الاستشارة الأولى مجانية. هل تودين الحضور هذا الأسبوع؟ 😊" },
    ],
  },

  // Priya Patel — EN, Full Mouth Rehab, contacted (missed call scenario)
  {
    phone: '447700900005',
    firstMsgHoursAgo: 30,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'general_enquiry',
        content: "Hi, I missed a call from your clinic earlier. Can I get more info about full mouth rehabilitation?" },
      { dir: 'outbound', ai: true,  min: 1,   scenario: 'missed_call',
        content: "Hi Priya! Thanks for calling back 😊 Full mouth rehabilitation is a comprehensive treatment plan combining implants, veneers, and other treatments. Our consultations are completely free. Shall I book you in for a full assessment?" },
      { dir: 'inbound',  ai: false, min: 60,  objection: 'timing_issue',
        content: "I'd love to but not until next month. Can I book ahead?" },
      { dir: 'outbound', ai: true,  min: 61,  scenario: 'missed_call',
        content: "Of course, Priya! We can book 4–6 weeks in advance. Shall I pencil in a slot for early next month?" },
    ],
  },

  // Harry Evans — EN, Invisalign, responded
  {
    phone: '447700900021',
    firstMsgHoursAgo: 24,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'comparing_competitors',
        content: "Hi, I'm comparing a few clinics for Invisalign. What makes Pearl Dental different?" },
      { dir: 'outbound', ai: true,  min: 2,   scenario: 'new_enquiry',
        content: "Hi Harry! Great question. We're an Invisalign Platinum Provider — one of the top 1% in the UK. We include free retainers, 3D smile preview, and have treated 500+ Invisalign patients. Want to see what your new smile could look like? 😊" },
      { dir: 'inbound',  ai: false, min: 90,  objection: null,
        content: "That sounds impressive. I'll book that 3D preview!" },
      { dir: 'outbound', ai: true,  min: 91,  scenario: 'new_enquiry',
        content: "Amazing! We have Thursday at 11am or Friday at 2pm. Which works best, Harry? 🦷" },
    ],
  },

  // Elif Şahin — TR, Implants x2, qualified
  {
    phone: '447700900022',
    firstMsgHoursAgo: 96,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'price_too_high',
        content: "Merhaba, 2 implant için fiyat öğrenebilir miyim? Biraz pahalı geldi diğer klinikten." },
      { dir: 'outbound', ai: true,  min: 2,   scenario: 'finance_objection',
        content: "Merhaba Elif Hanım! 2 implant için ₤2,400'den başlıyoruz ve 0% faizli 18 ay taksit seçeneğimiz mevcut. Ücretsiz 3D tarama ile size net fiyat verebiliriz. Uygun bir gün var mı?" },
      { dir: 'inbound',  ai: false, min: 120, objection: null,
        content: "Salı öğleden sonra uygun, randevu alabilir miyim?" },
      { dir: 'outbound', ai: true,  min: 121, scenario: 'finance_objection',
        content: "Salı 14:00 onaylandı! ✅ Adres: 1 Canada Square, Canary Wharf. Görüşürüz Elif Hanım 😊" },
    ],
  },

  // Nour Ibrahim — AR, Veneers + Whitening, responded
  {
    phone: '447700900020',
    firstMsgHoursAgo: 120,
    msgs: [
      { dir: 'inbound',  ai: false, min: 0,   objection: 'general_enquiry',
        content: "مرحباً، أريد تبييض الأسنان والفينير في نفس الوقت. هل هذا ممكن؟" },
      { dir: 'outbound', ai: true,  min: 1,   scenario: 'new_enquiry',
        content: "أهلاً نور! نعم بالتأكيد — كثير من مرضانا يجمعون بين التبييض والفينير. نبدأ بالتبييض أولاً ثم نطابق لون الفينير. الاستشارة الأولى مجانية تشمل تحليل الابتسامة. 😊" },
      { dir: 'inbound',  ai: false, min: 240, objection: null,
        content: "ممتاز، سأحاول الحضور هذا الأسبوع" },
    ],
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('[Full Seed] Starting…\n');
  const hash = await bcrypt.hash('CareNova2026!', 12);

  // 1. Tenants
  console.log('── Clinics ─────────────────────────────────────────────────────');
  const tenantIds = [];
  for (const c of CLINICS) {
    const { rows } = await pool.query(`
      INSERT INTO tenants
        (name, slug, status, plan_tier, country, timezone,
         address, phone, email, website,
         ai_monthly_limit, ai_overage_policy)
      VALUES ($1,$2,'active',$3,'GB','Europe/London',$4,$5,$6,$7,$8,$9)
      ON CONFLICT (slug) DO UPDATE SET
        name              = EXCLUDED.name,
        plan_tier         = EXCLUDED.plan_tier,
        address           = EXCLUDED.address,
        phone             = EXCLUDED.phone,
        email             = EXCLUDED.email,
        website           = EXCLUDED.website,
        ai_monthly_limit  = EXCLUDED.ai_monthly_limit,
        ai_overage_policy = EXCLUDED.ai_overage_policy,
        updated_at        = NOW()
      RETURNING id, name
    `, [c.name, c.slug, c.planTier, c.address, c.phone, c.email, c.website, c.aiLimit, c.aiPolicy]);
    tenantIds.push(rows[0].id);
    console.log(`  ✅ ${rows[0].name}  (${rows[0].id})`);
  }

  // 2. Staff
  console.log('\n── Staff ───────────────────────────────────────────────────────');
  const ROLE_NAMES = { 2: 'director', 3: 'clinic_admin', 4: 'receptionist', 5: 'dentist', 6: 'treatment_coordinator' };
  for (const s of STAFF) {
    const tenantId = tenantIds[s.clinicIdx];
    const { rows } = await pool.query(`
      INSERT INTO users
        (tenant_id, role_id, email, password_hash, first_name, last_name, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,TRUE)
      ON CONFLICT (tenant_id, email) DO UPDATE SET
        first_name    = EXCLUDED.first_name,
        last_name     = EXCLUDED.last_name,
        role_id       = EXCLUDED.role_id,
        password_hash = EXCLUDED.password_hash,
        updated_at    = NOW()
      RETURNING email
    `, [tenantId, s.roleId, s.email, hash, s.firstName, s.lastName]);
    console.log(`  ✅ ${rows[0].email}  [${ROLE_NAMES[s.roleId]}]  →  ${CLINICS[s.clinicIdx].name}`);
  }

  // 3. Leads
  console.log('\n── Leads ───────────────────────────────────────────────────────');
  const leadIdsByPhone = {};
  for (const l of LEADS) {
    const tenantId = tenantIds[l.clinicIdx];
    const createdAt = daysAgo(l.daysAgo);
    const { rows } = await pool.query(`
      INSERT INTO leads
        (tenant_id, phone, first_name, last_name, language, status, source,
         treatment_interest, treatment_value,
         ai_follow_up_enabled, ai_follow_up_count,
         created_at, updated_at, status_changed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,0,$10,$10,$10)
      ON CONFLICT (tenant_id, phone) DO UPDATE SET
        first_name         = EXCLUDED.first_name,
        last_name          = EXCLUDED.last_name,
        status             = EXCLUDED.status,
        treatment_interest = EXCLUDED.treatment_interest,
        treatment_value    = EXCLUDED.treatment_value,
        source             = EXCLUDED.source,
        updated_at         = NOW()
      RETURNING id, first_name, last_name, phone, status
    `, [tenantId, l.phone, l.firstName, l.lastName,
        l.language, l.status, l.source,
        l.treatment, l.value, createdAt]);
    leadIdsByPhone[l.phone] = rows[0].id;
    console.log(`  ✅ ${rows[0].first_name} ${rows[0].last_name}  [${rows[0].status}]  →  ${CLINICS[l.clinicIdx].name}`);
  }

  // 4. Messages
  console.log('\n── Messages ────────────────────────────────────────────────────');
  let msgTotal = 0;
  for (const conv of CONVERSATIONS) {
    const leadId = leadIdsByPhone[conv.phone];
    if (!leadId) {
      console.warn(`  ⚠  No lead for phone ${conv.phone}`);
      continue;
    }
    for (const m of conv.msgs) {
      const sentAt = new Date(
        Date.now() - conv.firstMsgHoursAgo * 3_600_000 + m.min * 60_000
      ).toISOString();
      await pool.query(`
        INSERT INTO messages
          (tenant_id, lead_id, direction, content, ai_generated,
           scenario_type, objection_type, status, sent_at, created_at)
        SELECT
          l.tenant_id, $1, $2::text, $3, $4::boolean,
          $5, $6, 'delivered', $7, $7
        FROM leads l WHERE l.id = $1
      `, [
        leadId,
        m.dir,
        m.content,
        m.ai,
        m.scenario  || null,
        m.objection || null,
        sentAt,
      ]);
      msgTotal++;
    }
  }
  console.log(`  ✅ ${msgTotal} messages inserted`);

  // 5. Back-fill ai_follow_up_count + last_ai_message_at on all leads
  await pool.query(`
    UPDATE leads l
    SET
      ai_follow_up_count = (
        SELECT COUNT(*) FROM messages m
        WHERE m.lead_id = l.id AND m.direction = 'outbound' AND m.ai_generated = TRUE
      ),
      last_ai_message_at = (
        SELECT MAX(created_at) FROM messages m
        WHERE m.lead_id = l.id AND m.direction = 'outbound' AND m.ai_generated = TRUE
      )
    WHERE l.deleted_at IS NULL
  `);
  console.log('\n  ✅ ai_follow_up_count back-filled on all leads');

  // 6. Summary
  const [tRow, lRow, mRow, uRow] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM tenants WHERE deleted_at IS NULL'),
    pool.query('SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL'),
    pool.query('SELECT COUNT(*) FROM messages'),
    pool.query("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role_id != 1"),
  ]);
  console.log('\n── Summary ─────────────────────────────────────────────────────');
  console.log(`  Tenants  : ${tRow.rows[0].count}`);
  console.log(`  Staff    : ${uRow.rows[0].count}`);
  console.log(`  Leads    : ${lRow.rows[0].count}`);
  console.log(`  Messages : ${mRow.rows[0].count}`);
  console.log('\n[Full Seed] Done ✅');

  await pool.end();
}

seed().catch(err => {
  console.error('[Full Seed] Error:', err.message);
  console.error(err);
  process.exit(1);
});

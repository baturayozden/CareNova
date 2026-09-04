/**
 * Riverside Dental — Bölüm 2: WhatsApp conversations.
 *
 * Adds realistic multi-language AI follow-up conversations to selected Riverside leads.
 * Showcases: finance objection handling (core differentiator), multilingual (EN/TR/AR/ES/RU),
 * missed-call recovery, ghost re-engagement, new enquiry.
 *
 * Idempotent: deletes existing messages for the Riverside tenant first, then re-inserts.
 * Run AFTER seed-demo-riverside.js.
 * Usage: node src/db/seed-demo-riverside-messages.js
 */

require('dotenv').config({ override: true, path: require('path').join(__dirname, '../../.env') });

const { pool } = require('./index');

const TENANT_SLUG = 'riverside-dental-london';

// dir: inbound (patient) / outbound (AI or staff)
// ai: true if AI-generated outbound
// scenario: outbound scenario_type | objection: inbound objection_type
// min: minutes offset from conversation start
const CONVERSATIONS = [
  // ── Ahmed Hassan (AR) — Hot, finance objection → handled, high value implant ──
  { phone:'447700910001', startHoursAgo:20, msgs:[
    { dir:'outbound', ai:true,  scenario:'new_enquiry', min:0,
      content:'مرحباً أحمد، شكراً لتواصلك مع عيادة ريفرسايد. لاحظنا اهتمامك بزراعة الأسنان. هل ترغب بحجز استشارة مجانية؟' },
    { dir:'inbound',  objection:'price_too_high', min:45,
      content:'مرحباً، كم تكلفة زراعة الأسنان الكاملة؟ سمعت أنها مكلفة جداً' },
    { dir:'outbound', ai:true,  scenario:'finance_objection', min:48,
      content:'نتفهم أن التكلفة مهمة. زراعة الأسنان تبدأ من €2,400 للسن الواحد، ونوفر خطط تقسيط بدون فوائد على 12 شهر. هل تود معرفة التفاصيل؟' },
    { dir:'inbound',  objection:'finance_options', min:90,
      content:'نعم، خطة التقسيط تبدو جيدة. متى يمكنني القدوم؟' },
    { dir:'outbound', ai:true,  scenario:'new_enquiry', min:92,
      content:'رائع! لدينا مواعيد متاحة هذا الأسبوع. هل يناسبك يوم الخميس الساعة 2 ظهراً مع د. كالدويل؟' },
  ]},

  // ── Elif Şahin (TR) — Hot, multilingual, ready to book ──
  { phone:'447700910003', startHoursAgo:18, msgs:[
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:0,
      content:'Merhaba Elif, Riverside Dental\'e ulaştığınız için teşekkürler. İmplant tedavisiyle ilgilendiğinizi görüyoruz. Ücretsiz konsültasyon ayarlayalım mı?' },
    { dir:'inbound', objection:'comparing_competitors', min:30,
      content:'Merhaba, başka kliniklere de bakıyorum. Sizi farklı kılan ne?' },
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:33,
      content:'Çok iyi anlıyoruz. Riverside\'da tüm implantlar İsviçre menşeli, 10 yıl garantili ve tedavinizi kendi dilinizde takip ediyoruz. Ayrıca faizsiz ödeme planı sunuyoruz. Bir konsültasyonla farkı görebilirsiniz.' },
    { dir:'inbound', objection:null, min:75,
      content:'Kulağa harika geliyor. Bu hafta uygun musunuz?' },
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:77,
      content:'Tabii ki! Çarşamba 15:00 veya Cuma 11:00 müsait. Hangisi size uyar?' },
  ]},

  // ── Sofia Moreno (ES) — Hot, veneers, engaged ──
  { phone:'447700910005', startHoursAgo:16, msgs:[
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:0,
      content:'Hola Sofia, gracias por contactar con Riverside Dental. Vimos su interés en carillas de porcelana. ¿Le gustaría reservar una consulta gratuita?' },
    { dir:'inbound', objection:'trust_concern', min:25,
      content:'Hola, ¿las carillas se ven naturales? Me preocupa que parezcan falsas' },
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:27,
      content:'Es una preocupación muy común. Nuestras carillas de porcelana se diseñan a medida para cada paciente y se ven completamente naturales. Podemos mostrarle casos reales en la consulta. ¿Le va bien esta semana?' },
    { dir:'inbound', objection:null, min:60,
      content:'Sí, me encantaría ver ejemplos. ¿El jueves?' },
  ]},

  // ── Dmitri Volkov (RU) — Warm, implants, multilingual ──
  { phone:'447700910009', startHoursAgo:30, msgs:[
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:0,
      content:'Здравствуйте, Дмитрий! Спасибо за обращение в Riverside Dental. Вы интересовались имплантами. Хотите записаться на бесплатную консультацию?' },
    { dir:'inbound', objection:'timing_issue', min:120,
      content:'Здравствуйте. Сейчас занят, может быть через пару недель?' },
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:123,
      content:'Конечно, без проблем. Я отправлю вам напоминание через две недели. А пока могу прислать информацию о вариантах имплантации, если интересно?' },
  ]},

  // ── Olivia Bennett (EN) — Warm, missed call recovery ──
  { phone:'447700910008', startHoursAgo:40, msgs:[
    { dir:'outbound', ai:true, scenario:'missed_call', min:0,
      content:'Hi Olivia, sorry we missed your call at Riverside Dental! You enquired about porcelain veneers — happy to help over WhatsApp. What would you like to know?' },
    { dir:'inbound', objection:'price_too_high', min:55,
      content:'Hi, I called about veneers but they seem really expensive. What\'s the cost?' },
    { dir:'outbound', ai:true, scenario:'finance_objection', min:58,
      content:'Totally understand. Porcelain veneers start from €650 per tooth, and we offer 0% interest payment plans over 12 months — so a full smile can be very manageable monthly. Would you like a free consultation to see what\'s right for you?' },
    { dir:'inbound', objection:null, min:120,
      content:'That actually sounds doable. Yes please, can I come in next week?' },
  ]},

  // ── Ryan Murphy (EN) — Ghost risk, re-engagement attempt ──
  { phone:'447700910022', startHoursAgo:430, msgs:[
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:0,
      content:'Hi Ryan, thanks for your interest in dental implants at Riverside Dental. Would you like to book a free consultation?' },
    { dir:'inbound', objection:'general_enquiry', min:200,
      content:'Maybe, let me think about it' },
    { dir:'outbound', ai:true, scenario:'cold_lead', min:7200,
      content:'Hi Ryan, just checking back in — your free implant consultation offer is still available, and we have new payment plans that make it easier than ever. Shall I hold a slot for you this week?' },
  ]},

  // ── Harry Evans (EN) — Warm, Invisalign, anxiety ──
  { phone:'447700910006', startHoursAgo:50, msgs:[
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:0,
      content:'Hi Harry, thanks for enquiring about Invisalign at Riverside Dental! Happy to answer any questions. Would a free consultation help?' },
    { dir:'inbound', objection:'anxiety_fear', min:40,
      content:'Hi, I\'m a bit nervous about dental treatment to be honest. Is Invisalign painful?' },
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:42,
      content:'That\'s completely understandable, and you\'re not alone! Invisalign is one of the gentlest options — clear, removable aligners with no needles or drilling. Most patients feel only mild pressure for a day or two with each new set. Our team is very used to nervous patients. Would a relaxed, no-pressure consultation help?' },
    { dir:'inbound', objection:null, min:95,
      content:'Okay that makes me feel better. Yes let\'s book something' },
  ]},

  // ── Layla Mansour (AR) — Warm, smile makeover ──
  { phone:'447700910011', startHoursAgo:60, msgs:[
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:0,
      content:'مرحباً ليلى، شكراً لاهتمامك بتجميل الابتسامة في عيادة ريفرسايد. هل ترغبين بحجز استشارة مجانية؟' },
    { dir:'inbound', objection:'availability', min:80,
      content:'مرحباً، هل لديكم مواعيد في عطلة نهاية الأسبوع؟ أعمل خلال الأسبوع' },
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:83,
      content:'بالتأكيد! نوفر مواعيد يوم السبت. هل يناسبك السبت القادم الساعة 11 صباحاً؟' },
  ]},

  // ── Thomas Whitfield (EN) — booked, clean conversion ──
  { phone:'447700910004', startHoursAgo:70, msgs:[
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:0,
      content:'Hi Thomas, thanks for your dental implant enquiry at Riverside Dental. Would you like to book a free consultation?' },
    { dir:'inbound', objection:null, min:30,
      content:'Yes please, the sooner the better' },
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:32,
      content:'Great! I have Thursday 2pm or Friday 10am with Dr. Caldwell. Which suits you?' },
    { dir:'inbound', objection:null, min:50,
      content:'Thursday 2pm works' },
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:52,
      content:'Perfect, you\'re booked for Thursday 2pm with Dr. Caldwell. We\'ll send a reminder. See you then!' },
  ]},

  // ── Mehmet Demir (TR) — Cool, slow response ──
  { phone:'447700910015', startHoursAgo:200, msgs:[
    { dir:'outbound', ai:true, scenario:'new_enquiry', min:0,
      content:'Merhaba Mehmet, Riverside Dental\'e implant talebiniz için teşekkürler. Ücretsiz konsültasyon ayarlayalım mı?' },
    { dir:'inbound', objection:'timing_issue', min:300,
      content:'Şu an müsait değilim, sonra dönerim' },
  ]},
];

async function main() {
  console.log('━━━ Riverside mesaj seed (Bölüm 2) ━━━\n');

  // Tenant + lead lookup
  const { rows: tRows } = await pool.query('SELECT id FROM tenants WHERE slug=$1', [TENANT_SLUG]);
  if (!tRows[0]) { console.error('Riverside tenant bulunamadı — önce seed-demo-riverside.js çalıştır.'); process.exit(1); }
  const tenantId = tRows[0].id;

  const { rows: leadRows } = await pool.query(
    'SELECT id, phone FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL', [tenantId]);
  const leadIdByPhone = {};
  leadRows.forEach(r => { leadIdByPhone[r.phone] = r.id; });

  // Idempotent: clear existing Riverside messages first
  const del = await pool.query('DELETE FROM messages WHERE tenant_id=$1', [tenantId]);
  console.log(`  🧹 ${del.rowCount} eski mesaj temizlendi (idempotent)\n`);

  let total = 0;
  for (const conv of CONVERSATIONS) {
    const leadId = leadIdByPhone[conv.phone];
    if (!leadId) { console.warn(`  ⚠ lead yok: ${conv.phone}`); continue; }
    for (const m of conv.msgs) {
      const sentAt = new Date(
        Date.now() - conv.startHoursAgo * 3_600_000 + m.min * 60_000
      ).toISOString();
      const status = m.dir === 'outbound' ? (Math.random() > 0.4 ? 'read' : 'delivered') : 'delivered';
      await pool.query(`
        INSERT INTO messages
          (tenant_id, lead_id, direction, content, message_type, ai_generated,
           scenario_type, objection_type, status, status_updated_at, sent_at, created_at)
        VALUES ($1,$2,$3,$4,'text',$5,$6,$7,$8,$9,$9,$9)
      `, [tenantId, leadId, m.dir, m.content, !!m.ai,
          m.scenario || null, m.objection || null, status, sentAt]);
      total++;
    }
  }
  console.log(`  ✅ ${total} mesaj eklendi (${CONVERSATIONS.length} konuşma, 5 dil)`);

  // Back-fill ai_follow_up_count + last_ai_message_at
  await pool.query(`
    UPDATE leads l SET
      ai_follow_up_count = (SELECT COUNT(*) FROM messages m
        WHERE m.lead_id=l.id AND m.direction='outbound' AND m.ai_generated=TRUE),
      last_ai_message_at = (SELECT MAX(created_at) FROM messages m
        WHERE m.lead_id=l.id AND m.direction='outbound' AND m.ai_generated=TRUE)
    WHERE l.tenant_id=$1 AND l.deleted_at IS NULL
  `, [tenantId]);
  console.log('  ✅ ai_follow_up_count + last_ai_message_at güncellendi');

  console.log('\n━━━ Bölüm 2 tamamlandı: çok-dilli WhatsApp konuşmaları ━━━');
  await pool.end();
}

main().catch(e => { console.error('SEED ERROR:', e.message); process.exit(1); });

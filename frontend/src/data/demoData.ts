import { ApiLead, Message, ConversationSummary, DashboardStats, ApiActivity } from '../types';

// Realistic Turkish health-tourism demo data (PAKET 5 / REACT_APP_DEMO_MODE).
// 4 cases per GECE-CALISMA-BRIEFI.md: German hair-transplant patient (doctor
// approval pending), Iraqi dental patient (panoramic pending), British
// aesthetic patient (quoted, deposit pending), Russian eye patient (D+30
// aftercare). Modeled as ApiLead/Message since the Case File model (PAKET 6)
// isn't built yet — see docs/dental-cleanup-inventory.md and GECE-LOG.md.

const now = new Date('2026-09-05T09:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600000).toISOString();

export const DEMO_TENANT_ID = 'demo-tenant-nova-hair';
export const DEMO_TENANT_NAME = 'Nova Hair & Aesthetics Clinic';

export const DEMO_USER = {
  id: 'demo-user-1',
  email: 'demo@carenova.ai',
  firstName: 'Demo',
  lastName: 'Kullanıcı',
  role: 'operasyon_muduru' as const,
  tenantId: DEMO_TENANT_ID,
  phone: null,
  avatarUrl: null,
  financeEnabled: true,
};

// Platform-role demo user for the admin host (admin.carenova.ai). demoAdapter
// returns this instead of DEMO_USER when hostMode==='admin' — see
// lib/demoAdapter.ts. Typing an email containing "clinic" on the admin
// login form returns DEMO_USER instead, specifically so the "wrong role"
// rejection screen (GECE-2-BRIEFI.md Bölüm B.3 güvenlik kuralı #1) has a
// way to be exercised in demo mode, since a real backend would otherwise be
// needed to produce a non-platform user on that host.
export const DEMO_SUPER_ADMIN = {
  id: 'demo-super-admin-1',
  email: 'admin@carenova.ai',
  firstName: 'Baturay',
  lastName: 'Özden',
  role: 'super_admin' as const,
  tenantId: null,
  phone: null,
  avatarUrl: null,
  financeEnabled: true,
};

export const demoLeads: ApiLead[] = [
  {
    id: 'lead-1', tenantId: DEMO_TENANT_ID, tenantName: DEMO_TENANT_NAME,
    phone: '+49 151 2345 6789', firstName: 'Lukas', lastName: 'Weber',
    email: 'lukas.weber@example.de', language: 'de', status: 'qualified',
    source: 'instagram_dm', treatmentInterest: 'Saç Ekimi (FUE, 3400 greft)',
    notes: 'Norwood 4. 3 fotoğraf yüklendi, doktor onayı bekleniyor. Ekim ayı ortasında seyahat etmek istiyor.',
    treatmentValue: 2100, aiFollowUpEnabled: true, aiFollowUpCount: 6,
    gdprConsentGiven: true, lastAiMessageAt: hoursAgo(2),
    leadScore: 82, scoreLabel: 'Hot', scoreTags: ['treatment_serious', 'ready_to_book'],
    scoreReasoning: 'Fotoğraf gönderdi, tarih sordu, bütçe itirazı yok.',
    assignedTo: 'Dr. Emre Yıldız', createdAt: daysAgo(6), updatedAt: hoursAgo(2),
  },
  {
    id: 'lead-2', tenantId: DEMO_TENANT_ID, tenantName: DEMO_TENANT_NAME,
    phone: '+964 750 123 4567', firstName: 'Ahmed', lastName: 'Al-Rashid',
    email: null, language: 'ar', status: 'contacted',
    treatmentInterest: 'Diş İmplantı (üst çene, 4 diş)',
    notes: 'Panoramik röntgen bekleniyor — implantAI yetkisi aralık dahi veremiyor, görüntüleme şart.',
    source: 'whatsapp_referral', treatmentValue: 1800, aiFollowUpEnabled: true,
    aiFollowUpCount: 3, gdprConsentGiven: true, lastAiMessageAt: hoursAgo(20),
    leadScore: 58, scoreLabel: 'Warm', scoreTags: ['high_value', 'comparing_options'],
    scoreReasoning: 'İlgili ama başka klinikle de görüşüyor, görüntüleme bekleniyor.',
    assignedTo: 'Ayşe Demir', createdAt: daysAgo(3), updatedAt: hoursAgo(20),
  },
  {
    id: 'lead-3', tenantId: DEMO_TENANT_ID, tenantName: DEMO_TENANT_NAME,
    phone: '+44 7700 900123', firstName: 'Charlotte', lastName: 'Bennett',
    email: 'charlotte.bennett@example.co.uk', language: 'en', status: 'booked',
    treatmentInterest: 'Estetik Cerrahi (rinoplasti)',
    notes: 'Teklif verildi (kilitli, 21 gün geçerli). Depozito bekleniyor — %30, kart ile.',
    source: 'google_ads', treatmentValue: 3200, aiFollowUpEnabled: true,
    aiFollowUpCount: 9, gdprConsentGiven: true, lastAiMessageAt: hoursAgo(5),
    leadScore: 91, scoreLabel: 'Hot', scoreTags: ['ready_to_book', 'high_value'],
    scoreReasoning: 'Teklifi onayladı, depozito linkini istedi.',
    assignedTo: 'Dr. Selin Kaya', createdAt: daysAgo(11), updatedAt: hoursAgo(5),
  },
  {
    id: 'lead-4', tenantId: DEMO_TENANT_ID, tenantName: DEMO_TENANT_NAME,
    phone: '+7 916 123 45 67', firstName: 'Irina', lastName: 'Sokolova',
    email: 'irina.sokolova@example.ru', language: 'ru', status: 'attended',
    treatmentInterest: 'Göz (LASIK)', notes: 'D+30 bakım hattında. Son kontrol fotoğrafı istendi, komplikasyon yok.',
    source: 'referral', treatmentValue: 1400, aiFollowUpEnabled: true,
    aiFollowUpCount: 14, gdprConsentGiven: true, lastAiMessageAt: daysAgo(1),
    leadScore: 74, scoreLabel: 'Warm', scoreTags: ['treatment_serious'],
    scoreReasoning: 'Tedavi tamamlandı, bakım hattı takibi sürüyor.',
    assignedTo: 'Dr. Mert Aydın', createdAt: daysAgo(34), updatedAt: daysAgo(1),
  },
];

export const demoMessages: Record<string, Message[]> = {
  'lead-1': [
    { id: 'm1-1', leadId: 'lead-1', direction: 'inbound', aiGenerated: false, status: 'read', createdAt: daysAgo(6),
      content: 'Hallo! Ich interessiere mich für eine Haartransplantation. Können Sie mir einen Preis nennen?' },
    { id: 'm1-2', leadId: 'lead-1', direction: 'outbound', aiGenerated: true, status: 'delivered', createdAt: daysAgo(6),
      content: 'Hallo! 😊 Könnten Sie uns 3 Fotos schicken (Vorderansicht, Oberkopf, Spenderbereich)?' },
    { id: 'm1-3', leadId: 'lead-1', direction: 'inbound', aiGenerated: false, status: 'read', createdAt: daysAgo(5),
      content: '[3 fotoğraf gönderildi]' },
    { id: 'm1-4', leadId: 'lead-1', direction: 'outbound', aiGenerated: true, status: 'delivered', createdAt: hoursAgo(2),
      content: 'Danke! Basierend auf den Fotos: 3200–3800 Grafts, €1900–2300. Endgültiger Preis nach Arztfreigabe.' },
  ],
  'lead-2': [
    { id: 'm2-1', leadId: 'lead-2', direction: 'inbound', aiGenerated: false, status: 'read', createdAt: daysAgo(3),
      content: 'مرحباً، أرغب في معرفة سعر زراعة الأسنان' },
    { id: 'm2-2', leadId: 'lead-2', direction: 'outbound', aiGenerated: true, status: 'delivered', createdAt: hoursAgo(20),
      content: 'أهلاً! لتقديم سعر دقيق نحتاج صورة أشعة بانورامية. هل تم إجراؤها من قبل؟' },
  ],
  'lead-3': [
    { id: 'm3-1', leadId: 'lead-3', direction: 'inbound', aiGenerated: false, status: 'read', createdAt: daysAgo(11),
      content: "Hi, I'd like a quote for a rhinoplasty." },
    { id: 'm3-2', leadId: 'lead-3', direction: 'outbound', aiGenerated: true, status: 'delivered', createdAt: daysAgo(2),
      content: 'Your locked quote is ready — €3,200, valid 21 days. Would you like the deposit link?' },
    { id: 'm3-3', leadId: 'lead-3', direction: 'inbound', aiGenerated: false, status: 'read', createdAt: hoursAgo(5),
      content: 'Yes please, send it over!' },
  ],
  'lead-4': [
    { id: 'm4-1', leadId: 'lead-4', direction: 'outbound', aiGenerated: true, status: 'delivered', createdAt: daysAgo(1),
      content: 'Здравствуйте, Ирина! Как ваше зрение спустя 30 дней? Пришлите, пожалуйста, фото для контроля.' },
    { id: 'm4-2', leadId: 'lead-4', direction: 'inbound', aiGenerated: false, status: 'read', createdAt: daysAgo(1),
      content: '[фото отправлено] Всё отлично, спасибо!' },
  ],
};

export const demoConversations: ConversationSummary[] = demoLeads.map(l => {
  const msgs = demoMessages[l.id] || [];
  const lastOut = [...msgs].reverse().find(m => m.direction === 'outbound');
  const lastIn = [...msgs].reverse().find(m => m.direction === 'inbound');
  return {
    leadId: l.id, patientName: `${l.firstName} ${l.lastName}`, phone: l.phone,
    language: l.language, clinic: DEMO_TENANT_NAME, clinicId: DEMO_TENANT_ID,
    scenario: 'new_enquiry', objectionType: null,
    outcome: l.status === 'booked' ? 'booked' : l.status === 'attended' ? 'booked' : 'replied',
    treatment: l.treatmentInterest, treatmentValue: l.treatmentValue,
    aiMessages: msgs.filter(m => m.aiGenerated).length,
    lastAiContent: lastOut?.content || null, lastAiAt: lastOut?.createdAt || null,
    deliveryStatus: 'delivered', lastReplyContent: lastIn?.content || null,
    lastReplyAt: lastIn?.createdAt || null,
    actionRequired: l.status === 'qualified' || l.status === 'booked',
    aiFollowUpEnabled: l.aiFollowUpEnabled, leadCreatedAt: l.createdAt,
  };
});

export const demoActivityEvents: ApiActivity[] = demoLeads.flatMap(l => {
  const msgs = demoMessages[l.id] || [];
  return msgs.slice(-1).map(m => ({
    id: `evt-${m.id}`, leadName: `${l.firstName} ${l.lastName}`,
    type: (m.direction === 'outbound' ? 'message_sent' : 'response_received') as 'message_sent' | 'response_received',
    content: m.content, timestamp: m.createdAt, clinic: DEMO_TENANT_NAME, aiGenerated: m.aiGenerated,
  }));
});

export const demoStats: DashboardStats = {
  total: demoLeads.length, booked: demoLeads.filter(l => l.status === 'booked' || l.status === 'attended').length,
  aiMessages: Object.values(demoMessages).flat().filter(m => m.aiGenerated).length,
  recoveryRate: 68,
};

export const demoDoctors = [
  { id: 'dr-1', name: 'Dr. Emre Yıldız', title: 'Saç Ekimi Uzmanı', branch: 'Saç Ekimi', languages: ['tr', 'en', 'de'], registrationNo: 'TR-34-88213' },
  { id: 'dr-2', name: 'Dr. Selin Kaya', title: 'Plastik ve Rekonstrüktif Cerrahi', branch: 'Estetik Cerrahi', languages: ['tr', 'en'], registrationNo: 'TR-34-77410' },
  { id: 'dr-3', name: 'Dr. Mert Aydın', title: 'Göz Hastalıkları Uzmanı', branch: 'Göz', languages: ['tr', 'en', 'ru'], registrationNo: 'TR-06-55219' },
];

export const demoConsultants = [
  { id: 'pc-1', name: 'Ayşe Demir', role: 'Hasta Danışmanı', languages: ['tr', 'ar', 'en'] },
  { id: 'pc-2', name: 'Jonas Fischer', role: 'Hasta Danışmanı', languages: ['de', 'en', 'tr'] },
];

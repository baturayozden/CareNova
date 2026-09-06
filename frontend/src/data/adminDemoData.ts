// Platform-wide demo data for the admin console (admin.carenova.ai).
// Realistic Turkish health-tourism clinics, generic-but-plausible names
// ("Nova Hair Clinic", "Ege Estetik") — never a real clinic's name or brand.
// GECE-2-BRIEFI.md Bölüm C: 8-12 clinics, different cities, branches, plans,
// onboarding stages.

export type ClinicStatus = 'active' | 'trial' | 'onboarding' | 'suspended';
export type PlanKey = 'solo' | 'klinik' | 'grup';

export interface AdminClinic {
  id: string;
  name: string;
  legalName: string;
  city: string;
  branches: string[]; // branch_templates.key values
  plan: PlanKey;
  status: ClinicStatus;
  userCount: number;
  activeCases: number;
  lastActivityAt: string;
  mrrEur: number;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
  currency: string;
  licenseNumber: string | null; // Uluslararası Sağlık Turizmi Yetki Belgesi
  licenseExpiry: string | null;
  onboarding: {
    step: number; // 0-7, 7 = live
    stepStartedAt: string;
    stuck: boolean; // spent unusually long on current step
  };
  whatsapp: {
    displayNumber: string;
    phoneNumberId: string;
    connected: boolean;
    lastWebhookSuccessAt: string | null;
    messagesLast24h: number;
    errorsLast24h: number;
  };
  aiUsage: {
    monthlyQuota: number;
    usedThisMonth: number;
    overagePolicy: 'block' | 'allow';
    estimatedCostEur: number;
  };
  compliance: {
    licenseOnFile: boolean;
    complicationInsurance: boolean;
    complicationInsuranceExpiry: string | null;
    verbisRegistered: boolean;
    foreignLanguageStaffRatio: number; // percent, target 20
    ek1TotalConsents: number;
    ek1RevokedConsents: number;
    ek1HasUnconsentedMedia: boolean;
    crossBorderNotified: boolean;
    crossBorderNotifiedAt: string | null;
  };
  billing: {
    periodicity: 'annual' | 'monthly';
    amountEur: number;
    status: 'current' | 'overdue' | 'trial';
    nextChargeAt: string;
  };
}

const now = new Date('2026-09-07T08:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000).toISOString();
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600000).toISOString();

export const ONBOARDING_STEPS = [
  'Klinik bilgisi', 'Branş seçimi', 'WhatsApp bağlama', 'Doktor kartları',
  'Bilgi bankası', 'Fiyat/yetki onayı', 'KVKK metinleri', 'Test → canlı',
] as const;

export const adminClinics: AdminClinic[] = [
  {
    id: 'clinic-nova-hair', name: 'Nova Hair Clinic', legalName: 'Nova Saç Ekimi Sağlık Hiz. A.Ş.',
    city: 'İstanbul', branches: ['hair_transplant'], plan: 'klinik', status: 'active',
    userCount: 12, activeCases: 34, lastActivityAt: hoursAgo(1), mrrEur: 449,
    contactEmail: 'ops@novahairclinic.com', contactPhone: '+90 212 555 0101',
    timezone: 'Europe/Istanbul', currency: 'EUR',
    licenseNumber: 'USHT-2026-00142', licenseExpiry: daysFromNow(280),
    onboarding: { step: 7, stepStartedAt: daysAgo(120), stuck: false },
    whatsapp: { displayNumber: '+90 212 555 0102', phoneNumberId: '778812345600100', connected: true, lastWebhookSuccessAt: hoursAgo(0.2), messagesLast24h: 214, errorsLast24h: 0 },
    aiUsage: { monthlyQuota: 2000, usedThisMonth: 1680, overagePolicy: 'allow', estimatedCostEur: 62 },
    compliance: { licenseOnFile: true, complicationInsurance: true, complicationInsuranceExpiry: daysFromNow(310), verbisRegistered: true, foreignLanguageStaffRatio: 24, ek1TotalConsents: 312, ek1RevokedConsents: 2, ek1HasUnconsentedMedia: false, crossBorderNotified: true, crossBorderNotifiedAt: daysAgo(200) },
    billing: { periodicity: 'annual', amountEur: 449, status: 'current', nextChargeAt: daysFromNow(58) },
  },
  {
    id: 'clinic-ege-estetik', name: 'Ege Estetik', legalName: 'Ege Estetik Cerrahi Ltd. Şti.',
    city: 'İzmir', branches: ['aesthetic_surgery'], plan: 'klinik', status: 'active',
    userCount: 8, activeCases: 19, lastActivityAt: hoursAgo(3), mrrEur: 449,
    contactEmail: 'yonetim@egeestetik.com.tr', contactPhone: '+90 232 555 0201',
    timezone: 'Europe/Istanbul', currency: 'EUR',
    licenseNumber: 'USHT-2026-00098', licenseExpiry: daysFromNow(140),
    onboarding: { step: 7, stepStartedAt: daysAgo(200), stuck: false },
    whatsapp: { displayNumber: '+90 232 555 0202', phoneNumberId: '778812345600200', connected: true, lastWebhookSuccessAt: hoursAgo(0.5), messagesLast24h: 87, errorsLast24h: 1 },
    aiUsage: { monthlyQuota: 2000, usedThisMonth: 940, overagePolicy: 'block', estimatedCostEur: 34 },
    compliance: { licenseOnFile: true, complicationInsurance: true, complicationInsuranceExpiry: daysFromNow(45), verbisRegistered: true, foreignLanguageStaffRatio: 18, ek1TotalConsents: 156, ek1RevokedConsents: 0, ek1HasUnconsentedMedia: false, crossBorderNotified: true, crossBorderNotifiedAt: daysAgo(180) },
    billing: { periodicity: 'monthly', amountEur: 45, status: 'current', nextChargeAt: daysFromNow(12) },
  },
  {
    id: 'clinic-anadolu-dental', name: 'Anadolu Dental', legalName: 'Anadolu Ağız ve Diş Sağlığı Poliklinik A.Ş.',
    city: 'Ankara', branches: ['dental'], plan: 'grup', status: 'active',
    userCount: 22, activeCases: 61, lastActivityAt: hoursAgo(0.4), mrrEur: 1190,
    contactEmail: 'info@anadoludental.com.tr', contactPhone: '+90 312 555 0301',
    timezone: 'Europe/Istanbul', currency: 'EUR',
    licenseNumber: 'USHT-2025-00512', licenseExpiry: daysFromNow(400),
    onboarding: { step: 7, stepStartedAt: daysAgo(300), stuck: false },
    whatsapp: { displayNumber: '+90 312 555 0302', phoneNumberId: '778812345600300', connected: true, lastWebhookSuccessAt: hoursAgo(0.1), messagesLast24h: 341, errorsLast24h: 0 },
    aiUsage: { monthlyQuota: 10000, usedThisMonth: 7200, overagePolicy: 'allow', estimatedCostEur: 265 },
    compliance: { licenseOnFile: true, complicationInsurance: true, complicationInsuranceExpiry: daysFromNow(500), verbisRegistered: true, foreignLanguageStaffRatio: 31, ek1TotalConsents: 890, ek1RevokedConsents: 5, ek1HasUnconsentedMedia: false, crossBorderNotified: true, crossBorderNotifiedAt: daysAgo(280) },
    billing: { periodicity: 'annual', amountEur: 11190, status: 'current', nextChargeAt: daysFromNow(65) },
  },
  {
    id: 'clinic-akdeniz-goz', name: 'Akdeniz Göz Merkezi', legalName: 'Akdeniz Göz Sağlığı Hiz. Ltd.',
    city: 'Antalya', branches: ['eye_lasik'], plan: 'solo', status: 'active',
    userCount: 3, activeCases: 7, lastActivityAt: hoursAgo(6), mrrEur: 149,
    contactEmail: 'ilgi@akdenizgoz.com', contactPhone: '+90 242 555 0401',
    timezone: 'Europe/Istanbul', currency: 'EUR',
    licenseNumber: 'USHT-2026-00201', licenseExpiry: daysFromNow(20),
    onboarding: { step: 7, stepStartedAt: daysAgo(60), stuck: false },
    whatsapp: { displayNumber: '+90 242 555 0402', phoneNumberId: '778812345600400', connected: true, lastWebhookSuccessAt: hoursAgo(2), messagesLast24h: 12, errorsLast24h: 0 },
    aiUsage: { monthlyQuota: 300, usedThisMonth: 290, overagePolicy: 'block', estimatedCostEur: 11 },
    compliance: { licenseOnFile: true, complicationInsurance: false, complicationInsuranceExpiry: null, verbisRegistered: true, foreignLanguageStaffRatio: 15, ek1TotalConsents: 22, ek1RevokedConsents: 0, ek1HasUnconsentedMedia: false, crossBorderNotified: false, crossBorderNotifiedAt: null },
    billing: { periodicity: 'monthly', amountEur: 15, status: 'overdue', nextChargeAt: daysAgo(3) },
  },
  {
    id: 'clinic-bogazici-bariatrik', name: 'Boğaziçi Bariatrik', legalName: 'Boğaziçi Obezite Cerrahisi A.Ş.',
    city: 'İstanbul', branches: ['bariatric'], plan: 'klinik', status: 'trial',
    userCount: 5, activeCases: 4, lastActivityAt: hoursAgo(20), mrrEur: 0,
    contactEmail: 'info@bogazicibariatrik.com', contactPhone: '+90 212 555 0501',
    timezone: 'Europe/Istanbul', currency: 'EUR',
    licenseNumber: null, licenseExpiry: null,
    onboarding: { step: 7, stepStartedAt: daysAgo(10), stuck: false },
    whatsapp: { displayNumber: '+90 212 555 0502', phoneNumberId: '778812345600500', connected: true, lastWebhookSuccessAt: hoursAgo(4), messagesLast24h: 6, errorsLast24h: 0 },
    aiUsage: { monthlyQuota: 2000, usedThisMonth: 120, overagePolicy: 'block', estimatedCostEur: 4 },
    compliance: { licenseOnFile: false, complicationInsurance: false, complicationInsuranceExpiry: null, verbisRegistered: false, foreignLanguageStaffRatio: 8, ek1TotalConsents: 4, ek1RevokedConsents: 0, ek1HasUnconsentedMedia: true, crossBorderNotified: false, crossBorderNotifiedAt: null },
    billing: { periodicity: 'monthly', amountEur: 0, status: 'trial', nextChargeAt: daysFromNow(4) },
  },
  {
    id: 'clinic-marmara-ivf', name: 'Marmara Tüp Bebek', legalName: 'Marmara Üreme Sağlığı Merkezi Ltd.',
    city: 'İstanbul', branches: ['ivf'], plan: 'klinik', status: 'active',
    userCount: 9, activeCases: 15, lastActivityAt: hoursAgo(2), mrrEur: 449,
    contactEmail: 'iletisim@marmaraivf.com', contactPhone: '+90 216 555 0601',
    timezone: 'Europe/Istanbul', currency: 'EUR',
    licenseNumber: 'USHT-2025-00389', licenseExpiry: daysFromNow(220),
    onboarding: { step: 7, stepStartedAt: daysAgo(150), stuck: false },
    whatsapp: { displayNumber: '+90 216 555 0602', phoneNumberId: '778812345600600', connected: true, lastWebhookSuccessAt: hoursAgo(1), messagesLast24h: 58, errorsLast24h: 0 },
    aiUsage: { monthlyQuota: 2000, usedThisMonth: 610, overagePolicy: 'block', estimatedCostEur: 22 },
    compliance: { licenseOnFile: true, complicationInsurance: true, complicationInsuranceExpiry: daysFromNow(200), verbisRegistered: true, foreignLanguageStaffRatio: 22, ek1TotalConsents: 98, ek1RevokedConsents: 1, ek1HasUnconsentedMedia: false, crossBorderNotified: true, crossBorderNotifiedAt: daysAgo(140) },
    billing: { periodicity: 'annual', amountEur: 449, status: 'current', nextChargeAt: daysFromNow(215) },
  },
  {
    id: 'clinic-toros-ortopedi', name: 'Toros Ortopedi', legalName: 'Toros Ortopedi ve Travmatoloji A.Ş.',
    city: 'Antalya', branches: ['orthopedics'], plan: 'solo', status: 'onboarding',
    userCount: 2, activeCases: 0, lastActivityAt: hoursAgo(30), mrrEur: 0,
    contactEmail: 'destek@torosortopedi.com', contactPhone: '+90 242 555 0701',
    timezone: 'Europe/Istanbul', currency: 'EUR',
    licenseNumber: null, licenseExpiry: null,
    onboarding: { step: 3, stepStartedAt: daysAgo(9), stuck: true },
    whatsapp: { displayNumber: '', phoneNumberId: '', connected: false, lastWebhookSuccessAt: null, messagesLast24h: 0, errorsLast24h: 0 },
    aiUsage: { monthlyQuota: 300, usedThisMonth: 0, overagePolicy: 'block', estimatedCostEur: 0 },
    compliance: { licenseOnFile: false, complicationInsurance: false, complicationInsuranceExpiry: null, verbisRegistered: false, foreignLanguageStaffRatio: 0, ek1TotalConsents: 0, ek1RevokedConsents: 0, ek1HasUnconsentedMedia: false, crossBorderNotified: false, crossBorderNotifiedAt: null },
    billing: { periodicity: 'monthly', amountEur: 0, status: 'trial', nextChargeAt: daysFromNow(21) },
  },
  {
    id: 'clinic-anka-checkup', name: 'Anka Check-up Merkezi', legalName: 'Anka Sağlık Kontrol Hiz. Ltd.',
    city: 'Ankara', branches: ['checkup'], plan: 'solo', status: 'active',
    userCount: 4, activeCases: 11, lastActivityAt: hoursAgo(5), mrrEur: 149,
    contactEmail: 'randevu@ankacheckup.com', contactPhone: '+90 312 555 0801',
    timezone: 'Europe/Istanbul', currency: 'EUR',
    licenseNumber: 'USHT-2026-00276', licenseExpiry: daysFromNow(330),
    onboarding: { step: 7, stepStartedAt: daysAgo(40), stuck: false },
    whatsapp: { displayNumber: '+90 312 555 0802', phoneNumberId: '778812345600800', connected: true, lastWebhookSuccessAt: hoursAgo(3), messagesLast24h: 29, errorsLast24h: 0 },
    aiUsage: { monthlyQuota: 300, usedThisMonth: 145, overagePolicy: 'allow', estimatedCostEur: 5 },
    compliance: { licenseOnFile: true, complicationInsurance: true, complicationInsuranceExpiry: daysFromNow(330), verbisRegistered: true, foreignLanguageStaffRatio: 20, ek1TotalConsents: 40, ek1RevokedConsents: 0, ek1HasUnconsentedMedia: false, crossBorderNotified: true, crossBorderNotifiedAt: daysAgo(35) },
    billing: { periodicity: 'monthly', amountEur: 15, status: 'current', nextChargeAt: daysFromNow(8) },
  },
  {
    id: 'clinic-istanbul-onkoloji', name: 'İstanbul Onkoloji Danışma', legalName: 'İstanbul Onkoloji Danışmanlık A.Ş.',
    city: 'İstanbul', branches: ['oncology'], plan: 'klinik', status: 'suspended',
    userCount: 6, activeCases: 2, lastActivityAt: daysAgo(18), mrrEur: 0,
    contactEmail: 'iletisim@istonkoloji.com', contactPhone: '+90 212 555 0901',
    timezone: 'Europe/Istanbul', currency: 'EUR',
    licenseNumber: 'USHT-2025-00033', licenseExpiry: daysAgo(5),
    onboarding: { step: 7, stepStartedAt: daysAgo(220), stuck: false },
    whatsapp: { displayNumber: '+90 212 555 0902', phoneNumberId: '778812345600900', connected: false, lastWebhookSuccessAt: daysAgo(18), messagesLast24h: 0, errorsLast24h: 3 },
    aiUsage: { monthlyQuota: 2000, usedThisMonth: 30, overagePolicy: 'block', estimatedCostEur: 1 },
    compliance: { licenseOnFile: true, complicationInsurance: true, complicationInsuranceExpiry: daysAgo(20), verbisRegistered: true, foreignLanguageStaffRatio: 12, ek1TotalConsents: 28, ek1RevokedConsents: 0, ek1HasUnconsentedMedia: false, crossBorderNotified: true, crossBorderNotifiedAt: daysAgo(200) },
    billing: { periodicity: 'annual', amountEur: 449, status: 'overdue', nextChargeAt: daysAgo(15) },
  },
  {
    id: 'clinic-karadeniz-estetik', name: 'Karadeniz Estetik ve Cerrahi', legalName: 'Karadeniz Estetik Cerrahi Merkezi Ltd.',
    city: 'İzmir', branches: ['aesthetic_surgery', 'hair_transplant'], plan: 'grup', status: 'active',
    userCount: 17, activeCases: 43, lastActivityAt: hoursAgo(0.8), mrrEur: 1190,
    contactEmail: 'operasyon@karadenizestetik.com', contactPhone: '+90 232 555 1001',
    timezone: 'Europe/Istanbul', currency: 'EUR',
    licenseNumber: 'USHT-2026-00087', licenseExpiry: daysFromNow(260),
    onboarding: { step: 7, stepStartedAt: daysAgo(90), stuck: false },
    whatsapp: { displayNumber: '+90 232 555 1002', phoneNumberId: '778812345601000', connected: true, lastWebhookSuccessAt: hoursAgo(0.3), messagesLast24h: 198, errorsLast24h: 2 },
    aiUsage: { monthlyQuota: 10000, usedThisMonth: 9450, overagePolicy: 'allow', estimatedCostEur: 348 },
    compliance: { licenseOnFile: true, complicationInsurance: true, complicationInsuranceExpiry: daysFromNow(60), verbisRegistered: true, foreignLanguageStaffRatio: 19, ek1TotalConsents: 520, ek1RevokedConsents: 8, ek1HasUnconsentedMedia: true, crossBorderNotified: true, crossBorderNotifiedAt: daysAgo(85) },
    billing: { periodicity: 'annual', amountEur: 11190, status: 'current', nextChargeAt: daysFromNow(275) },
  },
  {
    id: 'clinic-selcuk-dental', name: 'Selçuk Diş Polikliniği', legalName: 'Selçuk Ağız Diş Sağlığı Polikliniği',
    city: 'Konya', branches: ['dental'], plan: 'solo', status: 'onboarding',
    userCount: 1, activeCases: 0, lastActivityAt: hoursAgo(12), mrrEur: 0,
    contactEmail: 'klinik@selcukdis.com', contactPhone: '+90 332 555 1101',
    timezone: 'Europe/Istanbul', currency: 'EUR',
    licenseNumber: null, licenseExpiry: null,
    onboarding: { step: 1, stepStartedAt: daysAgo(1), stuck: false },
    whatsapp: { displayNumber: '', phoneNumberId: '', connected: false, lastWebhookSuccessAt: null, messagesLast24h: 0, errorsLast24h: 0 },
    aiUsage: { monthlyQuota: 300, usedThisMonth: 0, overagePolicy: 'block', estimatedCostEur: 0 },
    compliance: { licenseOnFile: false, complicationInsurance: false, complicationInsuranceExpiry: null, verbisRegistered: false, foreignLanguageStaffRatio: 0, ek1TotalConsents: 0, ek1RevokedConsents: 0, ek1HasUnconsentedMedia: false, crossBorderNotified: false, crossBorderNotifiedAt: null },
    billing: { periodicity: 'monthly', amountEur: 0, status: 'trial', nextChargeAt: daysFromNow(29) },
  },
];

export const BRANCH_LABELS: Record<string, string> = {
  hair_transplant: 'Saç Ekimi', dental: 'Diş', aesthetic_surgery: 'Estetik Cerrahi',
  eye_lasik: 'Göz (LASIK)', bariatric: 'Bariatrik', ivf: 'Tüp Bebek (IVF)',
  orthopedics: 'Ortopedi', cardiology: 'Kardiyoloji', oncology: 'Onkoloji', checkup: 'Check-up',
};

export const PLAN_LABELS: Record<PlanKey, string> = { solo: 'Solo', klinik: 'Klinik', grup: 'Grup' };

// ── Demo talepleri (C.8) ─────────────────────────────────────────────────
export interface AdminDemoRequest {
  id: string; name: string; email: string; clinic: string; city: string;
  branch: string; phone: string; createdAt: string;
  status: 'new' | 'contacted' | 'demo_done' | 'won' | 'lost';
  note: string;
}
export const adminDemoRequests: AdminDemoRequest[] = [
  { id: 'dr-1', name: 'Dr. Hakan Sezer', email: 'hakan@sezerklinik.com', clinic: 'Sezer Saç Ekimi', city: 'İstanbul', branch: 'hair_transplant', phone: '+90 532 111 2233', createdAt: hoursAgo(4), status: 'new', note: '' },
  { id: 'dr-2', name: 'Elif Yalçın', email: 'elif@yalcindent.com', clinic: 'Yalçın Diş Kliniği', city: 'Bursa', branch: 'dental', phone: '+90 533 222 3344', createdAt: daysAgo(1), status: 'contacted', note: 'Perşembe demo planlandı.' },
  { id: 'dr-3', name: 'Mert Aksoy', email: 'mert@aksoyestetik.com', clinic: 'Aksoy Estetik', city: 'İzmir', branch: 'aesthetic_surgery', phone: '+90 535 333 4455', createdAt: daysAgo(3), status: 'demo_done', note: 'Fiyat konusunda tereddütlü, takip edilecek.' },
  { id: 'dr-4', name: 'Zeynep Kurt', email: 'zeynep@kurtgoz.com', clinic: 'Kurt Göz Merkezi', city: 'Antalya', branch: 'eye_lasik', phone: '+90 536 444 5566', createdAt: daysAgo(7), status: 'won', note: 'Nova Hair Clinic olarak değil, ayrı yeni klinik — sözleşme imzalandı.' },
  { id: 'dr-5', name: 'Caner Bulut', email: 'caner@bulutivf.com', clinic: 'Bulut Tüp Bebek', city: 'Ankara', branch: 'ivf', phone: '+90 537 555 6677', createdAt: daysAgo(10), status: 'lost', note: 'Bütçe uymadı.' },
  { id: 'dr-6', name: 'Aslı Demirtaş', email: 'asli@demirtasortopedi.com', clinic: 'Demirtaş Ortopedi', city: 'Antalya', branch: 'orthopedics', phone: '+90 538 666 7788', createdAt: hoursAgo(20), status: 'new', note: '' },
];

// ── Denetim kaydı (C.11) ─────────────────────────────────────────────────
export interface AdminAuditEvent {
  id: string; actor: string; action: string; clinicId: string | null; clinicName: string | null; at: string;
}
export const adminAuditEvents: AdminAuditEvent[] = [
  { id: 'ae-1', actor: 'Baturay Özden', action: 'Klinik onaylandı', clinicId: 'clinic-marmara-ivf', clinicName: 'Marmara Tüp Bebek', at: daysAgo(150) },
  { id: 'ae-2', actor: 'Baturay Özden', action: 'Plan değiştirildi: Solo → Klinik', clinicId: 'clinic-ege-estetik', clinicName: 'Ege Estetik', at: daysAgo(60) },
  { id: 'ae-3', actor: 'Baturay Özden', action: 'Klinik askıya alındı (ödeme gecikmesi)', clinicId: 'clinic-istanbul-onkoloji', clinicName: 'İstanbul Onkoloji Danışma', at: daysAgo(15) },
  { id: 'ae-4', actor: 'Baturay Özden', action: 'Branş şablonu güncellendi: aesthetic_surgery AI yetkisi', clinicId: null, clinicName: null, at: daysAgo(30) },
  { id: 'ae-5', actor: 'Baturay Özden', action: 'Kota eklendi: +5000 AI konuşma', clinicId: 'clinic-karadeniz-estetik', clinicName: 'Karadeniz Estetik ve Cerrahi', at: hoursAgo(40) },
  { id: 'ae-6', actor: 'Baturay Özden', action: 'Klinik olarak görüntüleme başlatıldı', clinicId: 'clinic-nova-hair', clinicName: 'Nova Hair Clinic', at: hoursAgo(2) },
  { id: 'ae-7', actor: 'Baturay Özden', action: 'Klinik olarak görüntüleme sonlandırıldı', clinicId: 'clinic-nova-hair', clinicName: 'Nova Hair Clinic', at: hoursAgo(1.9) },
];

// ── Kullanıcılar (C.10) ──────────────────────────────────────────────────
export interface AdminPlatformUser {
  id: string; name: string; email: string; role: 'super_admin' | 'admin'; lastLoginAt: string;
}
export const adminPlatformUsers: AdminPlatformUser[] = [
  { id: 'pu-1', name: 'Baturay Özden', email: 'baturay@carenova.ai', role: 'super_admin', lastLoginAt: hoursAgo(0.1) },
];

export interface AdminClinicUser {
  id: string; name: string; email: string; clinicId: string; clinicName: string;
  role: 'klinik_sahibi' | 'operasyon_muduru' | 'hasta_danismani' | 'doktor' | 'koordinator' | 'tercuman' | 'muhasebe';
  lastLoginAt: string;
}
export const CLINIC_ROLE_LABELS: Record<AdminClinicUser['role'], string> = {
  klinik_sahibi: 'Klinik Sahibi', operasyon_muduru: 'Operasyon Müdürü', hasta_danismani: 'Hasta Danışmanı',
  doktor: 'Doktor', koordinator: 'Koordinatör', tercuman: 'Tercüman', muhasebe: 'Muhasebe',
};
export const adminClinicUsers: AdminClinicUser[] = [
  { id: 'cu-1', name: 'Emre Yıldız', email: 'emre@novahairclinic.com', clinicId: 'clinic-nova-hair', clinicName: 'Nova Hair Clinic', role: 'klinik_sahibi', lastLoginAt: hoursAgo(1) },
  { id: 'cu-2', name: 'Selin Kaya', email: 'selin@novahairclinic.com', clinicId: 'clinic-nova-hair', clinicName: 'Nova Hair Clinic', role: 'doktor', lastLoginAt: hoursAgo(3) },
  { id: 'cu-3', name: 'Ayşe Demir', email: 'ayse@novahairclinic.com', clinicId: 'clinic-nova-hair', clinicName: 'Nova Hair Clinic', role: 'hasta_danismani', lastLoginAt: hoursAgo(0.5) },
  { id: 'cu-4', name: 'Cem Aksu', email: 'cem@egeestetik.com.tr', clinicId: 'clinic-ege-estetik', clinicName: 'Ege Estetik', role: 'operasyon_muduru', lastLoginAt: hoursAgo(4) },
  { id: 'cu-5', name: 'Merve Öz', email: 'merve@anadoludental.com.tr', clinicId: 'clinic-anadolu-dental', clinicName: 'Anadolu Dental', role: 'koordinator', lastLoginAt: hoursAgo(2) },
  { id: 'cu-6', name: 'Deniz Ak', email: 'deniz@anadoludental.com.tr', clinicId: 'clinic-anadolu-dental', clinicName: 'Anadolu Dental', role: 'muhasebe', lastLoginAt: daysAgo(1) },
  { id: 'cu-7', name: 'Fatma Şen', email: 'fatma@karadenizestetik.com', clinicId: 'clinic-karadeniz-estetik', clinicName: 'Karadeniz Estetik ve Cerrahi', role: 'tercuman', lastLoginAt: hoursAgo(5) },
];

// ── Platform sağlığı (C.12) ──────────────────────────────────────────────
export const adminHealth = {
  webhookSuccessRate: 97.4,
  avgFirstReplySeconds: 4.2,
  aiErrorRate: 0.6,
  recentErrors: [
    { id: 'err-1', clinicName: 'İstanbul Onkoloji Danışma', message: 'Webhook zaman aşımı (10s)', at: hoursAgo(20) },
    { id: 'err-2', clinicName: 'Karadeniz Estetik ve Cerrahi', message: 'AI yanıt formatı geçersiz, yeniden denendi', at: hoursAgo(6) },
    { id: 'err-3', clinicName: 'Ege Estetik', message: 'WhatsApp API 429 (rate limit)', at: hoursAgo(9) },
  ],
};

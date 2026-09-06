// Case File demo data (GECE-2-BRIEFI.md Bölüm D.2/D.5) — CareNova's central
// concept for health tourism (patient + companions + medical file + quotes +
// travel + payments + aftercare), matching backend/src/migrations/057's
// `cases` table status enum exactly (English snake_case — the concrete
// implementation, not the Turkish prose version in CARENOVA-STRATEJI.md
// Bölüm 7/M1, which describes the same states but doesn't match the DB).
// Not DB-backed (no Postgres available — BLOKAJLAR.md B2), frontend-only
// for tonight's demo.

export type CaseStatus =
  | 'new' | 'qualified' | 'pre_assessment' | 'awaiting_doctor' | 'quoted'
  | 'awaiting_deposit' | 'reserved' | 'travel_planned' | 'arrived' | 'treated'
  | 'returned' | 'in_aftercare' | 'completed' | 'lost' | 'medically_ineligible';

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  new: 'Yeni', qualified: 'Nitelendi', pre_assessment: 'Ön Değerlendirme',
  awaiting_doctor: 'Doktor Onayı Bekliyor', quoted: 'Teklif Verildi',
  awaiting_deposit: 'Depozito Bekliyor', reserved: 'Rezerve', travel_planned: 'Seyahat Planlandı',
  arrived: 'Geldi', treated: 'Tedavi Edildi', returned: 'Döndü', in_aftercare: 'Bakım Hattında',
  completed: 'Tamamlandı', lost: 'Kayıp', medically_ineligible: 'Tıbben Uygun Değil',
};

export interface CaseMessage { side: 'in' | 'out'; text: string; translation?: string; at: string; hasVoiceNote?: boolean; hasPhoto?: boolean }
export interface CaseFile {
  id: string;
  caseNumber: string;
  patientName: string;
  patientCountryFlag: string;
  patientCountry: string;
  patientLanguage: string;
  patientAge: number;
  companions: { name: string; relation: string }[];
  branch: string;
  status: CaseStatus;
  assignedConsultant: string | null;
  assignedDoctor: string | null;
  assignedCoordinator: string | null;
  assignedInterpreter: string | null;
  estimatedValueEur: number;
  lastActivityAt: string;
  timeline: { status: CaseStatus; at: string }[];
  messages: CaseMessage[];
  medicalFile: {
    preAssessment: { q: string; a: string }[];
    uploadedImages: number;
    doctorDecision: 'pending' | 'eligible' | 'conditional' | 'ineligible';
    doctorNote: string;
    aiExtraction: string; // doctor/admin-only — never shown to patient
  };
  quotes: { version: number; amountEur: number; items: string[]; locked: boolean; changeReason?: string; validUntil?: string }[];
  travel: { flight: string; hotel: string; transfer: string; itinerary: { day: string; plan: string }[] } | null;
  aftercare: { day: string; contactedAt: string | null; response: string | null; photoUploaded: boolean }[];
  auditLog: { actor: string; action: string; at: string }[];
}

const now = new Date('2026-09-07T08:00:00Z');
// Exported so page-level "X dk/gün önce" helpers diff against this fixed
// reference instead of the real Date.now() — the two drift (this demo
// dataset's reference date is fixed slightly ahead of real time), which
// otherwise renders as a negative, nonsensical "-646 dk önce".
export const DEMO_NOW_MS = now.getTime();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();
const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000).toISOString();
const hoursAgo = (n: number) => new Date(now.getTime() - n * 3600000).toISOString();

export const caseDoctors = [
  { id: 'doc-1', name: 'Dr. Emre Yıldız', branch: 'hair_transplant', registrationNo: 'TR-34-88213', languages: ['tr', 'en', 'de'] },
  { id: 'doc-2', name: 'Dr. Selin Kaya', branch: 'aesthetic_surgery', registrationNo: 'TR-35-44120', languages: ['tr', 'en'] },
  { id: 'doc-3', name: 'Dr. Mert Aydın', branch: 'eye_lasik', registrationNo: 'TR-06-91002', languages: ['tr', 'en', 'ar'] },
  { id: 'doc-4', name: 'Dr. Ayla Çelik', branch: 'dental', registrationNo: 'TR-34-55671', languages: ['tr', 'en', 'ru'] },
  { id: 'doc-5', name: 'Dr. Kerem Ateş', branch: 'ivf', registrationNo: 'TR-34-23890', languages: ['tr', 'en'] },
];
export const caseConsultants = [
  { id: 'con-1', name: 'Ayşe Demir', languages: ['tr', 'en', 'de'] },
  { id: 'con-2', name: 'Jonas Fischer', languages: ['en', 'de'] },
  { id: 'con-3', name: 'Layla Hassan', languages: ['en', 'ar'] },
  { id: 'con-4', name: 'Olga Petrova', languages: ['en', 'ru'] },
];
export const caseCoordinators = [
  { id: 'coord-1', name: 'Kaan Şahin' },
  { id: 'coord-2', name: 'Elif Aksoy' },
];
export const caseInterpreters = [
  { id: 'int-1', name: 'Reem Al-Sayed', languages: ['ar'] },
  { id: 'int-2', name: 'Natasha Ivanova', languages: ['ru'] },
  { id: 'int-3', name: 'Hans Weber', languages: ['de'] },
];

// One case per status value at minimum (brief: "farklı durumlarda 12-15 vaka").
export const cases: CaseFile[] = [
  {
    id: 'case-1', caseNumber: 'CN-2026-0201', patientName: 'Michael Brandt', patientCountryFlag: '🇩🇪', patientCountry: 'Germany', patientLanguage: 'de', patientAge: 34,
    companions: [], branch: 'hair_transplant', status: 'new',
    assignedConsultant: 'Ayşe Demir', assignedDoctor: null, assignedCoordinator: null, assignedInterpreter: null,
    estimatedValueEur: 2600, lastActivityAt: hoursAgo(0.3),
    timeline: [{ status: 'new', at: hoursAgo(0.3) }],
    messages: [
      { side: 'in', text: 'Hallo, ich interessiere mich für eine Haartransplantation.', translation: 'Merhaba, saç ekimi ile ilgileniyorum.', at: hoursAgo(0.3) },
    ],
    medicalFile: { preAssessment: [], uploadedImages: 0, doctorDecision: 'pending', doctorNote: '', aiExtraction: '' },
    quotes: [], travel: null, aftercare: [],
    auditLog: [{ actor: 'Sistem', action: 'Vaka oluşturuldu', at: hoursAgo(0.3) }],
  },
  {
    id: 'case-2', caseNumber: 'CN-2026-0187', patientName: 'Sara Al-Amin', patientCountryFlag: '🇮🇶', patientCountry: 'Iraq', patientLanguage: 'ar', patientAge: 29,
    companions: [{ name: 'Youssef Al-Amin', relation: 'Eş' }], branch: 'dental', status: 'qualified',
    assignedConsultant: 'Layla Hassan', assignedDoctor: null, assignedCoordinator: null, assignedInterpreter: 'Reem Al-Sayed',
    estimatedValueEur: 3400, lastActivityAt: hoursAgo(2),
    timeline: [{ status: 'new', at: daysAgo(2) }, { status: 'qualified', at: hoursAgo(2) }],
    messages: [
      { side: 'in', text: 'مرحباً، أحتاج زراعة أسنان', translation: 'Merhaba, diş implantına ihtiyacım var', at: daysAgo(2) },
      { side: 'out', text: 'أهلاً! هل يمكنك إرسال صورة بانورامية إن وجدت؟', translation: 'Merhaba! Varsa panoramik fotoğraf gönderebilir misiniz?', at: hoursAgo(47.9) },
    ],
    medicalFile: { preAssessment: [{ q: 'Eksik diş sayısı', a: '4' }], uploadedImages: 2, doctorDecision: 'pending', doctorNote: '', aiExtraction: '' },
    quotes: [], travel: null, aftercare: [],
    auditLog: [{ actor: 'AI', action: 'Ön-değerlendirme tamamlandı', at: hoursAgo(2) }],
  },
  {
    id: 'case-3', caseNumber: 'CN-2026-0142', patientName: 'Lukas Weber', patientCountryFlag: '🇩🇪', patientCountry: 'Germany', patientLanguage: 'de', patientAge: 41,
    companions: [], branch: 'hair_transplant', status: 'pre_assessment',
    assignedConsultant: 'Jonas Fischer', assignedDoctor: null, assignedCoordinator: null, assignedInterpreter: null,
    estimatedValueEur: 2900, lastActivityAt: hoursAgo(5),
    timeline: [{ status: 'new', at: daysAgo(3) }, { status: 'qualified', at: daysAgo(2) }, { status: 'pre_assessment', at: hoursAgo(5) }],
    messages: [
      { side: 'in', text: 'Hallo, ich interessiere mich für eine Haartransplantation. Können Sie mir einen Preis nennen?', translation: 'Merhaba, saç ekimi ile ilgileniyorum. Fiyat verebilir misiniz?', at: daysAgo(3) },
      { side: 'out', text: 'Hallo! 😊 Könnten Sie uns 3 Fotos schicken (Vorderansicht, Oberkopf, Spenderbereich)?', translation: 'Merhaba! 😊 3 fotoğraf gönderir misiniz (ön, tepe, donör bölge)?', at: hoursAgo(71.93) },
      { side: 'in', text: '[3 Fotos gesendet]', at: daysAgo(2), hasPhoto: true },
    ],
    medicalFile: { preAssessment: [{ q: 'Norwood evresi (fotoğraftan)', a: '4' }, { q: 'Kronik hastalık', a: 'Yok' }], uploadedImages: 3, doctorDecision: 'pending', doctorNote: '', aiExtraction: 'Norwood 4, donör yoğunluk iyi, ~3200-3800 greft tahmini' },
    quotes: [], travel: null, aftercare: [],
    auditLog: [{ actor: 'AI', action: 'Fotoğraflar alındı, ön-değerlendirme tamamlandı', at: hoursAgo(5) }],
  },
  {
    id: 'case-4', caseNumber: 'CN-2026-0198', patientName: 'Ahmed Al-Rashid', patientCountryFlag: '🇮🇶', patientCountry: 'Iraq', patientLanguage: 'ar', patientAge: 52,
    companions: [], branch: 'dental', status: 'awaiting_doctor',
    assignedConsultant: 'Layla Hassan', assignedDoctor: 'Dr. Ayla Çelik', assignedCoordinator: null, assignedInterpreter: 'Reem Al-Sayed',
    estimatedValueEur: 3100, lastActivityAt: hoursAgo(8),
    timeline: [{ status: 'new', at: daysAgo(4) }, { status: 'qualified', at: daysAgo(3) }, { status: 'pre_assessment', at: daysAgo(2) }, { status: 'awaiting_doctor', at: hoursAgo(8) }],
    messages: [
      { side: 'in', text: 'مرحباً، أحتاج زراعة أسنان في الفك السفلي', translation: 'Merhaba, alt çenede implant ihtiyacım var', at: daysAgo(4) },
      { side: 'in', text: '[بانوراما مرسلة]', translation: '[Panoramik gönderildi]', at: daysAgo(2), hasPhoto: true },
    ],
    medicalFile: { preAssessment: [{ q: 'Eksik diş sayısı', a: '3' }], uploadedImages: 1, doctorDecision: 'pending', doctorNote: '', aiExtraction: 'Panoramikte kemik yoğunluğu yeterli görünüyor, implant adayı' },
    quotes: [], travel: null, aftercare: [],
    auditLog: [{ actor: 'Sistem', action: 'Doktor onay kuyruğuna eklendi', at: hoursAgo(8) }],
  },
  {
    id: 'case-5', caseNumber: 'CN-2026-0156', patientName: 'Charlotte Bennett', patientCountryFlag: '🇬🇧', patientCountry: 'United Kingdom', patientLanguage: 'en', patientAge: 38,
    companions: [{ name: 'James Bennett', relation: 'Eş' }], branch: 'aesthetic_surgery', status: 'quoted',
    assignedConsultant: 'Jonas Fischer', assignedDoctor: 'Dr. Selin Kaya', assignedCoordinator: null, assignedInterpreter: null,
    estimatedValueEur: 5200, lastActivityAt: hoursAgo(12),
    timeline: [{ status: 'new', at: daysAgo(6) }, { status: 'qualified', at: daysAgo(5) }, { status: 'pre_assessment', at: daysAgo(4) }, { status: 'awaiting_doctor', at: daysAgo(2) }, { status: 'quoted', at: hoursAgo(12) }],
    messages: [{ side: 'in', text: "Hi! I'm interested in a rhinoplasty consultation.", at: daysAgo(6) }],
    medicalFile: { preAssessment: [{ q: 'İlgilenilen prosedür', a: 'Rinoplasti' }], uploadedImages: 4, doctorDecision: 'eligible', doctorNote: 'Uygun, standart rinoplasti planı.', aiExtraction: '' },
    quotes: [{ version: 1, amountEur: 5200, items: ['Rinoplasti', '2 gece hastane', 'Transfer'], locked: true, validUntil: daysFromNow(2) }],
    travel: null, aftercare: [],
    auditLog: [{ actor: 'Dr. Selin Kaya', action: 'Uygun olarak onaylandı', at: daysAgo(1) }, { actor: 'Sistem', action: 'Kilitli teklif gönderildi', at: hoursAgo(12) }],
  },
  {
    id: 'case-6', caseNumber: 'CN-2026-0133', patientName: 'Irina Sokolova', patientCountryFlag: '🇷🇺', patientCountry: 'Russia', patientLanguage: 'ru', patientAge: 27,
    companions: [], branch: 'eye_lasik', status: 'awaiting_deposit',
    assignedConsultant: 'Olga Petrova', assignedDoctor: 'Dr. Mert Aydın', assignedCoordinator: 'Kaan Şahin', assignedInterpreter: 'Natasha Ivanova',
    estimatedValueEur: 2100, lastActivityAt: daysAgo(1),
    timeline: [{ status: 'new', at: daysAgo(10) }, { status: 'quoted', at: daysAgo(3) }, { status: 'awaiting_deposit', at: daysAgo(1) }],
    messages: [{ side: 'in', text: 'Здравствуйте! Интересует лазерная коррекция зрения.', translation: 'Merhaba! Lazer göz ameliyatı ile ilgileniyorum.', at: daysAgo(10) }],
    medicalFile: { preAssessment: [], uploadedImages: 2, doctorDecision: 'eligible', doctorNote: 'Uygun.', aiExtraction: '' },
    quotes: [{ version: 1, amountEur: 2100, items: ['Bilateral LASIK', 'Kontrol muayeneleri'], locked: true, validUntil: daysFromNow(0.5) }],
    travel: null, aftercare: [],
    auditLog: [{ actor: 'Sistem', action: 'Depozito linki gönderildi', at: daysAgo(1) }],
  },
  {
    id: 'case-7', caseNumber: 'CN-2026-0098', patientName: 'Fatima Zohra', patientCountryFlag: '🇩🇿', patientCountry: 'Algeria', patientLanguage: 'ar', patientAge: 31,
    companions: [{ name: 'Amina Zohra', relation: 'Kız kardeş' }], branch: 'hair_transplant', status: 'reserved',
    assignedConsultant: 'Layla Hassan', assignedDoctor: 'Dr. Emre Yıldız', assignedCoordinator: 'Elif Aksoy', assignedInterpreter: 'Reem Al-Sayed',
    estimatedValueEur: 3300, lastActivityAt: daysAgo(2),
    timeline: [{ status: 'new', at: daysAgo(20) }, { status: 'quoted', at: daysAgo(12) }, { status: 'awaiting_deposit', at: daysAgo(8) }, { status: 'reserved', at: daysAgo(2) }],
    messages: [], medicalFile: { preAssessment: [], uploadedImages: 3, doctorDecision: 'eligible', doctorNote: 'Uygun.', aiExtraction: 'Norwood 3' },
    quotes: [{ version: 1, amountEur: 3300, items: ['FUE saç ekimi', 'PRP x2', '3 gece otel'], locked: true }],
    travel: null, aftercare: [],
    auditLog: [{ actor: 'Sistem', action: 'Depozito alındı, rezervasyon onaylandı', at: daysAgo(2) }],
  },
  {
    id: 'case-8', caseNumber: 'CN-2026-0077', patientName: 'David Kim', patientCountryFlag: '🇰🇷', patientCountry: 'South Korea', patientLanguage: 'en', patientAge: 45,
    companions: [], branch: 'dental', status: 'travel_planned',
    assignedConsultant: 'Jonas Fischer', assignedDoctor: 'Dr. Ayla Çelik', assignedCoordinator: 'Kaan Şahin', assignedInterpreter: null,
    estimatedValueEur: 4100, lastActivityAt: daysAgo(3),
    timeline: [{ status: 'reserved', at: daysAgo(10) }, { status: 'travel_planned', at: daysAgo(3) }],
    messages: [], medicalFile: { preAssessment: [], uploadedImages: 2, doctorDecision: 'eligible', doctorNote: 'Uygun.', aiExtraction: '' },
    quotes: [{ version: 1, amountEur: 4100, items: ['6 implant', 'Tam ağız restorasyonu'], locked: true }],
    travel: { flight: 'IST 14 Eylül 09:20 varış', hotel: 'Hilton Bomonti, 5 gece', transfer: 'Havalimanı VIP transfer', itinerary: [{ day: 'Gün 1', plan: 'Varış + konsültasyon' }, { day: 'Gün 2', plan: 'Operasyon' }, { day: 'Gün 3-4', plan: 'Dinlenme + kontrol' }, { day: 'Gün 5', plan: 'Dönüş' }] },
    aftercare: [], auditLog: [{ actor: 'Elif Aksoy', action: 'Uçuş ve otel onaylandı', at: daysAgo(3) }],
  },
  {
    id: 'case-9', caseNumber: 'CN-2026-0055', patientName: 'Hassan Baig', patientCountryFlag: '🇵🇰', patientCountry: 'Pakistan', patientLanguage: 'en', patientAge: 36,
    companions: [{ name: 'Amir Baig', relation: 'Kardeş' }], branch: 'hair_transplant', status: 'arrived',
    assignedConsultant: 'Ayşe Demir', assignedDoctor: 'Dr. Emre Yıldız', assignedCoordinator: 'Kaan Şahin', assignedInterpreter: null,
    estimatedValueEur: 2800, lastActivityAt: hoursAgo(6),
    timeline: [{ status: 'travel_planned', at: daysAgo(5) }, { status: 'arrived', at: hoursAgo(6) }],
    messages: [], medicalFile: { preAssessment: [], uploadedImages: 3, doctorDecision: 'eligible', doctorNote: 'Uygun.', aiExtraction: 'Norwood 5' },
    quotes: [{ version: 1, amountEur: 2800, items: ['FUE saç ekimi'], locked: true }],
    travel: { flight: 'Varış tamamlandı', hotel: 'Check-in yapıldı', transfer: 'Tamamlandı', itinerary: [{ day: 'Gün 1', plan: 'Varış — otelde' }] },
    aftercare: [], auditLog: [{ actor: 'Kaan Şahin', action: 'Havalimanından karşılandı', at: hoursAgo(6) }],
  },
  {
    id: 'case-10', caseNumber: 'CN-2026-0031', patientName: 'Marco Rossi', patientCountryFlag: '🇮🇹', patientCountry: 'Italy', patientLanguage: 'en', patientAge: 48,
    companions: [], branch: 'aesthetic_surgery', status: 'treated',
    assignedConsultant: 'Jonas Fischer', assignedDoctor: 'Dr. Selin Kaya', assignedCoordinator: 'Elif Aksoy', assignedInterpreter: null,
    estimatedValueEur: 6100, lastActivityAt: daysAgo(1),
    timeline: [{ status: 'arrived', at: daysAgo(3) }, { status: 'treated', at: daysAgo(1) }],
    messages: [], medicalFile: { preAssessment: [], uploadedImages: 5, doctorDecision: 'eligible', doctorNote: 'Operasyon başarılı.', aiExtraction: '' },
    quotes: [{ version: 1, amountEur: 6100, items: ['Liposuction', 'Karın germe'], locked: true }],
    travel: { flight: 'Tamamlandı', hotel: 'Devam ediyor', transfer: 'Tamamlandı', itinerary: [{ day: 'Gün 3', plan: 'Operasyon tamamlandı, dinlenme' }] },
    aftercare: [], auditLog: [{ actor: 'Dr. Selin Kaya', action: 'Operasyon tamamlandı', at: daysAgo(1) }],
  },
  {
    id: 'case-11', caseNumber: 'CN-2026-0012', patientName: 'Sophie Martin', patientCountryFlag: '🇫🇷', patientCountry: 'France', patientLanguage: 'en', patientAge: 33,
    companions: [], branch: 'dental', status: 'returned',
    assignedConsultant: 'Ayşe Demir', assignedDoctor: 'Dr. Ayla Çelik', assignedCoordinator: null, assignedInterpreter: null,
    estimatedValueEur: 2950, lastActivityAt: daysAgo(4),
    timeline: [{ status: 'treated', at: daysAgo(6) }, { status: 'returned', at: daysAgo(4) }],
    messages: [], medicalFile: { preAssessment: [], uploadedImages: 2, doctorDecision: 'eligible', doctorNote: 'Tamamlandı.', aiExtraction: '' },
    quotes: [{ version: 1, amountEur: 2950, items: ['4 implant'], locked: true }],
    travel: null, aftercare: [{ day: 'D+1', contactedAt: daysAgo(3), response: 'İyi hissediyorum', photoUploaded: false }],
    auditLog: [{ actor: 'Sistem', action: 'Eve döndü, bakım hattı başladı', at: daysAgo(4) }],
  },
  {
    id: 'case-12', caseNumber: 'CN-2025-0891', patientName: 'Klaus Richter', patientCountryFlag: '🇩🇪', patientCountry: 'Germany', patientLanguage: 'de', patientAge: 39,
    companions: [], branch: 'hair_transplant', status: 'in_aftercare',
    assignedConsultant: 'Jonas Fischer', assignedDoctor: 'Dr. Emre Yıldız', assignedCoordinator: null, assignedInterpreter: null,
    estimatedValueEur: 3050, lastActivityAt: daysAgo(7),
    timeline: [{ status: 'returned', at: daysAgo(30) }, { status: 'in_aftercare', at: daysAgo(30) }],
    messages: [], medicalFile: { preAssessment: [], uploadedImages: 4, doctorDecision: 'eligible', doctorNote: '', aiExtraction: '' },
    quotes: [{ version: 1, amountEur: 3050, items: ['FUE saç ekimi'], locked: true }],
    travel: null,
    aftercare: [
      { day: 'D+1', contactedAt: daysAgo(29), response: 'İyi', photoUploaded: false },
      { day: 'D+7', contactedAt: daysAgo(23), response: 'Kabuklanma normal seyrediyor', photoUploaded: true },
      { day: 'D+14', contactedAt: daysAgo(16), response: 'Kaşıntı var, normal denildi', photoUploaded: true },
      { day: 'D+30', contactedAt: daysAgo(7), response: 'Yeni çıkışlar görülüyor', photoUploaded: true },
      { day: 'D+90', contactedAt: hoursAgo(14), response: null, photoUploaded: false },
    ],
    auditLog: [{ actor: 'AI', action: 'D+30 bakım mesajı gönderildi', at: daysAgo(7) }],
  },
  {
    id: 'case-13', caseNumber: 'CN-2025-0654', patientName: 'Rania Khoury', patientCountryFlag: '🇱🇧', patientCountry: 'Lebanon', patientLanguage: 'ar', patientAge: 44,
    companions: [], branch: 'aesthetic_surgery', status: 'completed',
    assignedConsultant: 'Layla Hassan', assignedDoctor: 'Dr. Selin Kaya', assignedCoordinator: null, assignedInterpreter: 'Reem Al-Sayed',
    estimatedValueEur: 5500, lastActivityAt: daysAgo(90),
    timeline: [{ status: 'in_aftercare', at: daysAgo(180) }, { status: 'completed', at: daysAgo(90) }],
    messages: [], medicalFile: { preAssessment: [], uploadedImages: 6, doctorDecision: 'eligible', doctorNote: '', aiExtraction: '' },
    quotes: [{ version: 1, amountEur: 5500, items: ['Rinoplasti'], locked: true }],
    travel: null,
    aftercare: [{ day: 'D+365', contactedAt: daysAgo(90), response: 'Çok memnun', photoUploaded: true }],
    auditLog: [{ actor: 'Sistem', action: 'Bakım hattı tamamlandı, vaka kapatıldı', at: daysAgo(90) }],
  },
  {
    id: 'case-14', caseNumber: 'CN-2026-0177', patientName: 'Tom Andersen', patientCountryFlag: '🇳🇴', patientCountry: 'Norway', patientLanguage: 'en', patientAge: 42,
    companions: [], branch: 'hair_transplant', status: 'lost',
    assignedConsultant: 'Ayşe Demir', assignedDoctor: null, assignedCoordinator: null, assignedInterpreter: null,
    estimatedValueEur: 2400, lastActivityAt: daysAgo(15),
    timeline: [{ status: 'quoted', at: daysAgo(20) }, { status: 'lost', at: daysAgo(15) }],
    messages: [{ side: 'in', text: "Thanks, but I found a better price elsewhere.", at: daysAgo(15) }],
    medicalFile: { preAssessment: [], uploadedImages: 2, doctorDecision: 'eligible', doctorNote: '', aiExtraction: '' },
    quotes: [{ version: 1, amountEur: 2400, items: ['FUE saç ekimi'], locked: true }],
    travel: null, aftercare: [],
    auditLog: [{ actor: 'Sistem', action: 'Vaka kayıp olarak işaretlendi', at: daysAgo(15) }],
  },
  {
    id: 'case-15', caseNumber: 'CN-2026-0203', patientName: 'Aylin Yusupova', patientCountryFlag: '🇰🇿', patientCountry: 'Kazakhstan', patientLanguage: 'ru', patientAge: 30,
    companions: [{ name: 'Ruslan Yusupov', relation: 'Eş' }], branch: 'ivf', status: 'medically_ineligible',
    assignedConsultant: 'Olga Petrova', assignedDoctor: 'Dr. Kerem Ateş', assignedCoordinator: null, assignedInterpreter: 'Natasha Ivanova',
    estimatedValueEur: 0, lastActivityAt: hoursAgo(10),
    timeline: [{ status: 'pre_assessment', at: daysAgo(1) }, { status: 'medically_ineligible', at: hoursAgo(10) }],
    messages: [{ side: 'in', text: 'Здравствуйте, нам нужна донорская яйцеклетка.', translation: 'Merhaba, donör yumurtaya ihtiyacımız var.', at: daysAgo(1) },
      { side: 'out', text: 'Донорские яйцеклетки и сперма не разрешены в Турции по закону.', translation: 'Donör yumurta ve sperm Türkiye\'de yasal olarak izin verilmiyor.', at: hoursAgo(23.967) }],
    medicalFile: { preAssessment: [{ q: 'Donör gamet ihtiyacı', a: 'Evet' }], uploadedImages: 0, doctorDecision: 'ineligible', doctorNote: 'Donör gamet Türkiye\'de yasal değil — branş şablonu kuralı gereği vaka kapatıldı.', aiExtraction: '' },
    quotes: [], travel: null, aftercare: [],
    auditLog: [{ actor: 'Dr. Kerem Ateş', action: 'Tıbben uygun değil — donör gamet yasağı', at: hoursAgo(10) }],
  },
];

// "Bugünün programı" (GECE-3-BRIEFI.md Bölüm C) — demo-only, hand-picked
// same-day schedule. The real backend models this per-case as
// `case_timeline` (day_offset/starts_at/ends_at/type — migration 057), but
// no case in `cases` above carries clock-time-scheduled events, only
// day-label travel itineraries. Rather than bolt clock times onto that
// loosely-typed field, this is a small standalone illustrative list —
// clearly demo, consistent with the "never present fabricated data as if
// real" rule already applied elsewhere (adminDemoData's trend line, etc.).
export type ScheduleEntry = {
  time: string;
  caseId: string;
  patientName: string;
  type: 'arrival' | 'consultation' | 'procedure' | 'checkup' | 'departure';
};
export const todaysSchedule: ScheduleEntry[] = [
  { time: '09:00', caseId: 'case-9', patientName: 'Hassan Baig', type: 'consultation' },
  { time: '11:30', caseId: 'case-10', patientName: 'Marco Rossi', type: 'checkup' },
  { time: '14:00', caseId: 'case-8', patientName: 'David Kim', type: 'arrival' },
  { time: '16:00', caseId: 'case-7', patientName: 'Fatima Zohra', type: 'procedure' },
];

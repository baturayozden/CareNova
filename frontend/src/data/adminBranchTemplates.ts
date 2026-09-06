// Mirrors backend/src/migrations/058_branch_templates.sql's seed data (the
// 3 fully-authored system templates + 7 skeletons) for the admin console's
// read-only view — this is NOT a live DB read (no backend deployed tonight,
// see BLOKAJLAR.md B2), just the same content the migration would produce.

export type AiPricingAuthority = 'full' | 'range_from_photo' | 'range_after_imaging' | 'qualification_only' | 'logistics_only';

export interface AdminBranchTemplate {
  key: string;
  displayName: string;
  aiPricingAuthority: AiPricingAuthority;
  isSystem: boolean;
  fullyAuthored: boolean; // has real pre-assessment content, vs. a skeleton
  preAssessmentQuestions: string[];
  requiredMedia: string[];
  redFlags: string[];
  branchObjections: string[];
  aftercareSchedule: string; // short summary, e.g. "D+1, D+7, D+30, D+90, D+365"
  knowledgeSeedNote: string | null; // e.g. IVF's donor-gamete rule
  locked: boolean; // knowledge_seed entries that must never be removable in the UI
}

export const AUTHORITY_LABELS: Record<AiPricingAuthority, string> = {
  full: 'Tam',
  range_from_photo: 'Fotoğraftan aralık',
  range_after_imaging: 'Görüntüleme sonrası aralık',
  qualification_only: 'Sadece nitelendirme',
  logistics_only: 'Sadece lojistik',
};

export const adminBranchTemplates: AdminBranchTemplate[] = [
  {
    key: 'hair_transplant', displayName: 'Saç Ekimi', aiPricingAuthority: 'range_from_photo', isSystem: true, fullyAuthored: true,
    preAssessmentQuestions: ['Norwood evresi (fotoğraftan)', 'Donör alan yoğunluğu', 'Önceki ekim geçmişi', 'Kronik hastalık/kan sulandırıcı kullanımı'],
    requiredMedia: ['Ön (saç çizgisi)', 'Tepe', 'Donör bölge (ense)', 'Yan profil x2'],
    redFlags: ['Aktif saçlı deri enfeksiyonu', 'Kontrolsüz diyabet', 'Yakın zamanda büyük ameliyat'],
    branchObjections: ['Fiyat karşılaştırması', 'Doğallık endişesi', 'Ağrı korkusu', 'Sonuç garantisi talebi'],
    aftercareSchedule: 'D+1, D+3, D+7, D+14, D+30, D+90, D+180, D+365',
    knowledgeSeedNote: null, locked: false,
  },
  {
    key: 'dental', displayName: 'Diş', aiPricingAuthority: 'range_after_imaging', isSystem: true, fullyAuthored: true,
    preAssessmentQuestions: ['Eksik diş sayısı/konumu', 'Mevcut panoramik/CBCT var mı', 'Diş eti sağlığı', 'Sigara kullanımı'],
    requiredMedia: ['Ağız içi fotoğraf x2', 'Mevcut panoramik (varsa)', 'Gülüş fotoğrafı'],
    redFlags: ['Tedavisiz periodontal hastalık', 'Kemik yetersizliği şüphesi (implantta)'],
    branchObjections: ['İmplant sayısı belirsizliği', 'Tedavi süresi', 'Ağrı/anestezi endişesi'],
    aftercareSchedule: 'D+1, D+7, D+14, D+90, D+365',
    knowledgeSeedNote: null, locked: false,
  },
  {
    key: 'aesthetic_surgery', displayName: 'Estetik Cerrahi', aiPricingAuthority: 'qualification_only', isSystem: true, fullyAuthored: true,
    preAssessmentQuestions: ['İlgilenilen prosedür(ler)', 'Önceki estetik operasyon geçmişi', 'BKİ aralığı', 'Sigara/alkol kullanımı'],
    requiredMedia: ['İlgili bölge fotoğrafları (çok açılı)'],
    redFlags: ['Vücut dismorfik bozukluk belirtisi', 'Gerçekçi olmayan beklenti ifadeleri', 'Kontrolsüz kronik hastalık'],
    branchObjections: ['Fiyat', 'Doktor deneyimi kanıtı', 'Komplikasyon riski', 'İyileşme süresi'],
    aftercareSchedule: 'D+1, D+7, D+14, D+30, D+90, D+365',
    knowledgeSeedNote: null, locked: false,
  },
  { key: 'eye_lasik', displayName: 'Göz (LASIK/SMILE)', aiPricingAuthority: 'qualification_only', isSystem: true, fullyAuthored: false,
    preAssessmentQuestions: [], requiredMedia: [], redFlags: ['Keratokonus şüphesi', 'İnce kornea'], branchObjections: ['Yaş sınırı', 'Numaranın geri gelmesi endişesi'],
    aftercareSchedule: 'D+1, D+7, D+30', knowledgeSeedNote: null, locked: false },
  { key: 'bariatric', displayName: 'Bariatrik', aiPricingAuthority: 'qualification_only', isSystem: true, fullyAuthored: false,
    preAssessmentQuestions: [], requiredMedia: [], redFlags: ['BKİ eşik altı', 'Kontrolsüz psikiyatrik durum'], branchObjections: ['Ameliyat sonrası diyet zorluğu', 'Sarkma endişesi'],
    aftercareSchedule: 'D+1, D+7, D+30, D+90, D+180', knowledgeSeedNote: null, locked: false },
  { key: 'ivf', displayName: 'Tüp Bebek (IVF)', aiPricingAuthority: 'qualification_only', isSystem: true, fullyAuthored: false,
    preAssessmentQuestions: [], requiredMedia: [], redFlags: ['İleri anne yaşı + düşük over rezervi'], branchObjections: ['Başarı oranı belirsizliği', 'Çoklu döngü maliyeti'],
    aftercareSchedule: 'D+2, D+14 (beta), D+30',
    knowledgeSeedNote: "Donör yumurta ve donör sperm Türkiye'de yasal değildir. Hasta donör gamet ihtiyacı belirtirse AI bunu İLK yanıtta açıkça belirtmeli ve önce zaman kaybetmemelidir.",
    locked: true },
  { key: 'orthopedics', displayName: 'Ortopedi', aiPricingAuthority: 'qualification_only', isSystem: true, fullyAuthored: false,
    preAssessmentQuestions: [], requiredMedia: [], redFlags: ['Görüntüleme incelemesi yapılmadan taahhüt'], branchObjections: ['İyileşme/fizyoterapi süresi'],
    aftercareSchedule: 'D+1, D+14, D+45, D+90', knowledgeSeedNote: null, locked: false },
  { key: 'cardiology', displayName: 'Kardiyoloji', aiPricingAuthority: 'logistics_only', isSystem: true, fullyAuthored: false,
    preAssessmentQuestions: [], requiredMedia: [], redFlags: ['AI satış çerçevesi kurmamalı — sadece lojistik/randevu'], branchObjections: [],
    aftercareSchedule: 'Klinik tarafından yönetilir', knowledgeSeedNote: null, locked: false },
  { key: 'oncology', displayName: 'Onkoloji', aiPricingAuthority: 'logistics_only', isSystem: true, fullyAuthored: false,
    preAssessmentQuestions: [], requiredMedia: [], redFlags: ['AI satış çerçevesi kurmamalı — sadece lojistik/randevu'], branchObjections: [],
    aftercareSchedule: 'Klinik tarafından yönetilir', knowledgeSeedNote: null, locked: false },
  { key: 'checkup', displayName: 'Check-up', aiPricingAuthority: 'full', isSystem: true, fullyAuthored: false,
    preAssessmentQuestions: [], requiredMedia: [], redFlags: [], branchObjections: ['Paket içeriği karşılaştırması'],
    aftercareSchedule: 'D+7 (sonuç görüşmesi)', knowledgeSeedNote: null, locked: false },
];

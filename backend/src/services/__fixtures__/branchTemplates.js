'use strict';

// Shared branch template fixtures for tests (promptCompiler, outputGuard,
// e2e-flow). Mirrors the shape services/ai.js will load from the
// `branch_templates` table (migrations 058/062) — camelCase, matching
// whatever row-mapper generateFollowUp's branch loader uses.

const HAIR_TRANSPLANT = {
  key: 'hair_transplant',
  displayName: { tr: 'Saç Ekimi', en: 'Hair Transplant', ar: 'زراعة الشعر', de: 'Haartransplantation', ru: 'Пересадка волос' },
  aiPricingAuthority: 'range_from_photo',
  preAssessmentQuestions: [
    { id: 'yas', type: 'number', required: true, label: { tr: 'Yaş', en: 'Age' } },
    { id: 'sac_dokulme_suresi', type: 'select', label: { tr: 'Saç dökülme süresi', en: 'Hair loss duration' } },
  ],
  requiredMedia: [
    { id: 'on_gorunum', captureInstruction: { tr: 'Doğal ışıkta, saçlar kuru, alından çekilmiş', en: 'Natural light, dry hair, taken from the front' } },
    { id: 'tepe', captureInstruction: { tr: 'Baş tepesi net görünecek şekilde yukarıdan', en: 'From above, crown clearly visible' } },
    { id: 'donor_ense', captureInstruction: { tr: 'Ense/donör bölge', en: 'Nape/donor area' } },
  ],
  redFlags: ['aktif_alopecia_areata', 'yetersiz_donor', 'kontrolsuz_diyabet', '24_yas_alti'],
  objectionStrategies: {
    trust_surgeon: "Doktorun adını, tescil numarasını ve deneyimini paylaş; doktor kimlik kartı linkini gönder ve 10 dakikalık video konsültasyon öner. Kendi başına ikna etmeye çalışma.",
    safety_fear: "Endişeyi önce kabul et, sonra kliniğin komplikasyon sigortası ve doktorun deneyimini belirt; video konsültasyon öner.",
    price_shock: "Fiyatın neyi kapsadığını kalem kalem hatırlat; kesin fiyat için ücretsiz konsültasyon öner.",
  },
};

const DENTAL = {
  key: 'dental',
  displayName: { tr: 'Diş', en: 'Dental', ar: 'طب الأسنان', de: 'Zahnbehandlung', ru: 'Стоматология' },
  aiPricingAuthority: 'range_after_imaging',
  preAssessmentQuestions: [
    { id: 'eksik_dis', type: 'number', required: true, label: { tr: 'Eksik diş sayısı', en: 'Number of missing teeth' } },
  ],
  requiredMedia: [
    { id: 'panoramik', captureInstruction: { tr: 'Panoramik röntgen', en: 'Panoramic X-ray' } },
  ],
  redFlags: ['kontrolsuz_diyabet', 'aktif_enfeksiyon', 'kemik_yetersizligi_dogrulanmamis'],
  objectionStrategies: {
    trust_surgeon: "Doktorun adını, tescil numarasını ve deneyimini paylaş; video konsültasyon öner.",
    price_shock: "Panoramik/CBCT olmadan kesin fiyat verilemeyeceğini nazikçe belirt.",
    trust_clinic: "Kliniğin lisans bilgisini paylaş; hasta yorumu PAYLAŞMA.",
  },
};

const AESTHETIC_SURGERY = {
  key: 'aesthetic_surgery',
  displayName: { tr: 'Estetik Cerrahi', en: 'Aesthetic Surgery', ar: 'الجراحة التجميلية', de: 'Ästhetische Chirurgie', ru: 'Эстетическая хирургия' },
  aiPricingAuthority: 'qualification_only',
  preAssessmentQuestions: [
    { id: 'ilgilenilen_prosedur', type: 'text', required: true, label: { tr: 'İlgilenilen prosedür', en: 'Procedure of interest' } },
  ],
  requiredMedia: [
    { id: 'on_gorunum', captureInstruction: { tr: 'Ön görünüm', en: 'Front view' } },
  ],
  redFlags: ['asa_uygunlugu_dogrulanmamis', 'psikiyatrik_oykü_belirtilmemis', '18_yas_alti'],
  objectionStrategies: {
    safety_fear: "Endişeyi kabul et; anestezi uygunluk değerlendirmesinin doktor tarafından yapılacağını söyle. Güvenlik garantisi verme.",
    trust_surgeon: "Doktorun adını, tescil numarasını ve deneyimini paylaş; video konsültasyon öner.",
    aftercare_fear: "D+1'den D+180'e kadar süren bakım hattını anlat.",
  },
};

const IVF = {
  key: 'ivf',
  displayName: { tr: 'Tüp Bebek', en: 'IVF' },
  aiPricingAuthority: 'qualification_only',
  preAssessmentQuestions: [],
  requiredMedia: [],
  redFlags: ['ileri_anne_yasi_dusuk_over_rezervi'],
  objectionStrategies: {},
  knowledgeSeed: {
    donor_gamete_rule: 'Donor eggs and donor sperm are not legal in Turkey. If a patient indicates need for donor gametes, AI must state this clearly in the FIRST response and must not waste time before saying so.',
  },
};

const CHECKUP = {
  key: 'checkup',
  displayName: { tr: 'Check-up', en: 'Check-up' },
  aiPricingAuthority: 'full',
  preAssessmentQuestions: [],
  requiredMedia: [],
  redFlags: [],
  objectionStrategies: {},
};

const LOGISTICS_ONLY_BRANCH = {
  key: 'oncology',
  displayName: { tr: 'Onkoloji', en: 'Oncology' },
  aiPricingAuthority: 'logistics_only',
  preAssessmentQuestions: [],
  requiredMedia: [],
  redFlags: [],
  objectionStrategies: {},
};

module.exports = { HAIR_TRANSPLANT, DENTAL, AESTHETIC_SURGERY, IVF, CHECKUP, LOGISTICS_ONLY_BRANCH };

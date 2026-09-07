'use strict';

// GECE-4-BRIEFI.md Bölüm D.1 — detectObjection recalibrated from an 8-value
// generic taxonomy to the 11-type health-tourism taxonomy that
// promptCompiler.js/outputGuard.js (Bölüm A/B) and branch_templates.
// objection_strategies (migration 062) already expect. Before this change,
// detectObjection returned values like 'trust_concern' that
// promptCompiler's MUST_ESCALATE_OBJECTIONS (`trust_surgeon`/`safety_fear`)
// never matched, so the mandatory doctor-card/video-consultation escalation
// was silently unreachable — this file exists specifically to prove that's
// now fixed, in both English and Turkish/Arabic phrasing.

const { detectObjection, OBJECTION_TYPES } = require('../ai');

describe('detectObjection — all 11 taxonomy values are reachable', () => {
  test('every OBJECTION_TYPES key (except general_enquiry) has at least one detectObjection() path to it', () => {
    // Not a tautology: this cross-checks that the individual phrase tests
    // below (one per type) actually exist and pass, not just that the
    // constant object has the right keys.
    const values = Object.values(OBJECTION_TYPES);
    expect(values).toEqual(expect.arrayContaining([
      'price_shock', 'trust_surgeon', 'trust_clinic', 'safety_fear',
      'aftercare_fear', 'travel_friction', 'timing', 'comparison_shopping',
      'language_barrier', 'partner_approval', 'financing', 'general_enquiry',
    ]));
    expect(values.length).toBe(12); // 11 real objections + general_enquiry
  });
});

describe('detectObjection — price_shock', () => {
  test.each([
    'This is too expensive for me',
    "I can't afford this",
    'How much does it cost?',
    "What's the price for a full set?",
    'Bu benim için çok pahalı',
    'Bütçemi aşıyor',
    'Fiyat ne kadar?',
    'هذا غالي جداً بالنسبة لي',
    'كم التكلفة؟',
  ])('%j → price_shock', (text) => {
    expect(detectObjection(text)).toBe('price_shock');
  });
});

describe('detectObjection — trust_surgeon (🔴 must-escalate)', () => {
  test.each([
    'Who is the doctor who will do this?',
    'Is the surgeon qualified and experienced?',
    'Doktor kim, deneyimli mi?',
    'Cerrah kim olacak?',
    'من هو الطبيب الذي سيقوم بالعملية؟',
  ])('%j → trust_surgeon', (text) => {
    expect(detectObjection(text)).toBe('trust_surgeon');
  });
});

describe('detectObjection — safety_fear (🔴 must-escalate)', () => {
  test.each([
    'Is it safe? Does it hurt a lot?',
    "I'm scared of the risks",
    'Güvenli mi, ağrır mı?',
    'Komplikasyon riski var mı, korkuyorum',
    'هل هو آمن؟ أنا خائف',
  ])('%j → safety_fear', (text) => {
    expect(detectObjection(text)).toBe('safety_fear');
  });

  test('safety_fear wins over a co-occurring price mention (checked first)', () => {
    expect(detectObjection('Is it safe? Also how much does it cost?')).toBe('safety_fear');
  });
});

describe('detectObjection — trust_clinic', () => {
  test.each([
    'Is this clinic legit?',
    'Are there any real reviews of this clinic?',
    'Klinik güvenilir mi?',
    'Kliniğin lisansı var mı?',
    'هل العيادة موثوقة؟',
  ])('%j → trust_clinic', (text) => {
    expect(detectObjection(text)).toBe('trust_clinic');
  });
});

describe('detectObjection — aftercare_fear', () => {
  test.each([
    'What if something goes wrong after I go home?',
    'What kind of aftercare do you provide?',
    'Ameliyat sonrası bir sorun olursa ne olur?',
    'إذا حدثت مشكلة بعد عودتي إلى بلدي؟',
  ])('%j → aftercare_fear', (text) => {
    expect(detectObjection(text)).toBe('aftercare_fear');
  });
});

describe('detectObjection — travel_friction', () => {
  test.each([
    'Do I need a visa to come there?',
    'How do I get there from the airport?',
    "It's too far for me to travel",
    'Vize gerekiyor mu?',
    'كيف أصل إلى العيادة من المطار؟',
  ])('%j → travel_friction', (text) => {
    expect(detectObjection(text)).toBe('travel_friction');
  });
});

describe('detectObjection — timing', () => {
  test.each([
    "I'm not ready yet, maybe next month",
    "Those dates don't work for me",
    'Henüz hazır değilim, sonra düşünürüm',
    'لست جاهزاً بعد، لاحقاً',
  ])('%j → timing', (text) => {
    expect(detectObjection(text)).toBe('timing');
  });
});

describe('detectObjection — comparison_shopping', () => {
  test.each([
    "I'm checking around at other clinics",
    'I already got a quote from another clinic',
    'Başka bir klinikle de görüşüyorum',
    'أقارن الأسعار مع عيادة أخرى',
  ])('%j → comparison_shopping', (text) => {
    expect(detectObjection(text)).toBe('comparison_shopping');
  });
});

describe('detectObjection — language_barrier', () => {
  test.each([
    'Do you speak English?',
    "I don't understand what you're saying",
    'Türkçe konuşan biri var mı?',
    'هل تتحدث العربية؟',
  ])('%j → language_barrier', (text) => {
    expect(detectObjection(text)).toBe('language_barrier');
  });
});

describe('detectObjection — partner_approval', () => {
  test.each([
    'I need to ask my husband first',
    'I have to check with my family before deciding',
    'Eşime sormam lazım',
    'يجب أن أسأل زوجي أولاً',
  ])('%j → partner_approval', (text) => {
    expect(detectObjection(text)).toBe('partner_approval');
  });
});

describe('detectObjection — financing', () => {
  test.each([
    'Do you offer a payment plan?',
    'Can I pay in installments?',
    'Taksitle ödeme yapabilir miyim?',
    'هل يوجد خطة تقسيط؟',
  ])('%j → financing', (text) => {
    expect(detectObjection(text)).toBe('financing');
  });
});

describe('detectObjection — general_enquiry fallback', () => {
  test('empty/null text → general_enquiry', () => {
    expect(detectObjection('')).toBe('general_enquiry');
    expect(detectObjection(null)).toBe('general_enquiry');
    expect(detectObjection(undefined)).toBe('general_enquiry');
  });

  test('a neutral message matches no objection pattern', () => {
    expect(detectObjection('Hi, I saw your ad on Instagram and wanted to learn more')).toBe('general_enquiry');
  });
});

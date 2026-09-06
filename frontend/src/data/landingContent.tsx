// Bilingual (TR/EN) structured content for the CareNova landing page.
// Selected by the active i18next language at render time. Kept as typed data
// here rather than flat i18next JSON because most of it is repeating
// structured content (FAQ items, pricing tiers, comparison tables) that reads
// far more maintainably as arrays of objects than as hundreds of flat keys.
//
// Honesty rules (see GECE-LOG.md İş Paketi 2 / Bölüm C.1): CareNova has no
// customers yet. No fake testimonials, no fake client logos, no metrics
// presented as CareNova's own results. Industry statistics are allowed, but
// every one carries its source inline. No competitor is named — categories
// only. See CARENOVA-STRATEJI.md for the source data behind every number.
//
// Source-name policy (GECE-LOG.md, "Kaynak politikası"): no private
// agency/vendor site (e.g. a specific marketing firm's domain) is ever named
// on this page — only official sources (USHAŞ, TÜİK, T.C. Sağlık Bakanlığı,
// KVKK, Resmî Gazete). Every number falls into exactly one of three buckets:
//   A) Published by an official source → shown WITH that source's name via
//      `sourceLabel()` + the `source` field (e.g. problemCards).
//   B) Only available from industry/vendor sources → NEVER names the vendor;
//      shown instead with `industryDataLabel()`, a standalone disclaimer
//      that it's sector data, not a CareNova result (e.g. problemFunnel,
//      roiPanelLabel, heroStatsFootnote).
//   C) Not traceable to any source → does not appear on this page at all.

export type Lang = 'tr' | 'en';

function pick<T>(lang: string, tr: T, en: T): T {
  return lang?.startsWith('tr') ? tr : en;
}

// Category A prefix — pairs with a `source` field naming an official source.
export const sourceLabel = (lang: string) => pick(lang, 'Kaynak:', 'Source:');
// Category B — a standalone disclaimer with NO source name attached, for
// figures that only exist in industry/vendor data.
export const industryDataLabel = (lang: string) => pick(lang,
  'Sektör verisi — CareNova\'nın kendi sonucu değildir.',
  'Industry data — not a CareNova result.',
);

// ── Nav ───────────────────────────────────────────────────────────────────

export const navLinks = (lang: string) => pick(lang,
  [
    { label: 'Nasıl Çalışır', href: '#nasil-calisir' },
    { label: 'Platform', href: '#platform' },
    { label: 'Branşlar', href: '#branslar' },
    { label: 'Fiyatlandırma', href: '#pricing' },
    { label: 'SSS', href: '#faq' },
  ],
  [
    { label: 'How It Works', href: '#nasil-calisir' },
    { label: 'Platform', href: '#platform' },
    { label: 'Branches', href: '#branslar' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ],
);

export const navCta = (lang: string) => pick(lang, 'Demo Talep Et', 'Request a Demo');

// ── Hero ──────────────────────────────────────────────────────────────────

export const heroBadge = (lang: string) => pick(lang,
  'Hastaların kliniği seçme şekli değişti.',
  'The way patients choose a clinic has changed.',
);

export const heroHeadline = (lang: string) => pick(lang,
  <>Gelen her hastaya <span className="text-accent">5 saniyede</span>, kendi dilinde cevap verin.</>,
  <>Reply to every patient in <span className="text-accent">5 seconds</span>, in their own language.</>,
);

export const heroSub = (lang: string) => pick(lang,
  'Fiyatı kilitleyen, doktoru isimle taahhüt eden ve hasta eve döndükten sonra bir yıl peşini bırakmayan AI hasta güven platformu.',
  'The AI patient-trust platform that locks the price, commits the surgeon by name, and follows the patient home for a year.',
);

export const heroCtaPrimary = (lang: string) => pick(lang, 'Demo Talep Et', 'Book a Demo');
export const heroCtaSecondary = (lang: string) => pick(lang, 'Nasıl Çalışır?', 'See How It Works');
export const heroTrust = (lang: string) => pick(lang,
  'Türkiye sağlık turizmi klinikleri için · Kredi kartı gerekmez',
  'Built for Turkish health tourism clinics · No credit card required',
);

export const heroStats = (lang: string) => pick(lang,
  [
    { value: '<5sn', label: 'Yanıt Süresi' },
    { value: '5', label: 'Dil' },
    { value: '10×', label: 'Dönüşüm Artışı*' },
    { value: '7/24', label: 'Kesintisiz' },
  ],
  [
    { value: '<5s', label: 'Reply Time' },
    { value: '5', label: 'Languages' },
    { value: '10×', label: 'Conversion Lift*' },
    { value: '24/7', label: 'Always On' },
  ],
);

export const heroStatsFootnote = (lang: string) => `* ${industryDataLabel(lang)}`;

// WhatsApp mock conversation — hair transplant scenario, cycles TR → EN → AR → DE → RU
type Msg = { side: 'in' | 'out'; text: string };
export const heroConversations: Record<'tr' | 'en' | 'ar' | 'de' | 'ru', Msg[]> = {
  de: [
    { side: 'in',  text: 'Hallo! Ich interessiere mich für eine Haartransplantation. Können Sie mir einen Preis nennen?' },
    { side: 'out', text: 'Hallo! 😊 Könnten Sie uns 3 Fotos schicken (Vorderansicht, Oberkopf, Spenderbereich)? So kann ich Ihnen eine erste Preisspanne nennen.' },
    { side: 'in',  text: '[3 Fotos gesendet]' },
    { side: 'out', text: 'Danke! Basierend auf den Fotos: 3200–3800 Grafts, €1900–2300. Endgültiger Preis nach Arztfreigabe. Dr. Emre Yıldız würde Ihren Fall übernehmen — hier sein Profil.' },
  ],
  en: [
    { side: 'in',  text: "Hi! I'm interested in a hair transplant. Can you give me a price?" },
    { side: 'out', text: 'Hi! 😊 Could you send 3 photos (front, crown, donor area)? I can give you an initial range from those.' },
    { side: 'in',  text: '[3 photos sent]' },
    { side: 'out', text: "Thanks! Based on the photos: 3200–3800 grafts, €1900–2300. Final price after doctor's approval. Dr. Emre Yıldız would take your case — here's his profile." },
  ],
  tr: [
    { side: 'in',  text: 'Merhaba, saç ekimi için fiyat alabilir miyim?' },
    { side: 'out', text: 'Merhaba! 😊 3 fotoğraf gönderir misiniz (ön, tepe, donör bölge)? Fotoğraflardan bir ilk aralık verebilirim.' },
    { side: 'in',  text: '[3 fotoğraf gönderildi]' },
    { side: 'out', text: 'Teşekkürler! Fotoğraflara göre: 3200–3800 greft, €1900–2300 aralığında. Kesin fiyat doktor onayından sonra. Dr. Emre Yıldız vakanızı üstlenecek — profili burada.' },
  ],
  ar: [
    { side: 'in',  text: 'مرحباً، أرغب في معرفة سعر زراعة الشعر' },
    { side: 'out', text: 'أهلاً! 😊 هل يمكنك إرسال 3 صور (أمامية، قمة الرأس، منطقة المتبرع)؟ يمكنني إعطاؤك نطاق سعر أولي منها.' },
    { side: 'in',  text: '[تم إرسال 3 صور]' },
    { side: 'out', text: 'شكراً! بناءً على الصور: 3200-3800 بصيلة، 1900-2300 يورو. السعر النهائي بعد موافقة الطبيب. د. أمرة يلدز سيتولى حالتك — ملفه هنا.' },
  ],
  ru: [
    { side: 'in',  text: 'Здравствуйте! Интересует пересадка волос. Подскажете цену?' },
    { side: 'out', text: 'Здравствуйте! 😊 Пришлите, пожалуйста, 3 фото (спереди, макушка, донорская зона) — по ним смогу дать первичный диапазон цены.' },
    { side: 'in',  text: '[Отправлено 3 фото]' },
    { side: 'out', text: 'Спасибо! По фото: 3200–3800 графтов, €1900–2300. Точная цена после одобрения врача. Вашим случаем займётся др. Эмре Йылдыз — вот его профиль.' },
  ],
};
export const heroCycleOrder: (keyof typeof heroConversations)[] = ['tr', 'en', 'ar', 'de', 'ru'];
export const heroLangLabel: Record<keyof typeof heroConversations, string> = {
  tr: '🇹🇷 Türkçe', en: '🇬🇧 English', ar: '🇸🇦 العربية', de: '🇩🇪 Deutsch', ru: '🇷🇺 Русский',
};

// ── Nasıl Çalışır / How It Works ───────────────────────────────────────────

export const howItWorksHeading = (lang: string) => pick(lang, 'Nasıl çalışır?', 'How it works');
export const howItWorksSub = (lang: string) => pick(lang,
  'Beş adım — ilk mesajdan bir yıl sonrasına kadar.',
  'Five steps — from the first message to a year later.',
);
export const howItWorksSteps = (lang: string) => pick(lang,
  [
    { title: 'Hasta yazar', body: 'WhatsApp, Instagram DM veya reklam formundan gelen her mesaj tek gelen kutusuna düşer. Metin, ses notu ve fotoğraf, hepsi anlaşılır.' },
    { title: 'AI 5 saniyede karşılar', body: 'Hastanın dilini tanır, branşa özel ön değerlendirme sorularını sorar, gerekli fotoğrafları çekim talimatıyla ister.' },
    { title: 'Doktor onaylar', body: 'Vaka doktor kuyruğuna düşer. Doktor uygunluk kararını ve fiyat bandını onaylamadan AI kesin fiyat veremez.' },
    { title: 'Kilitli teklif gider', body: 'Kalem kalem, versiyonlu, süreli teklif; ameliyatı yapacak doktorun adıyla. Depozito linki içinde.' },
    { title: 'Bakım hattı devralır', body: "Hasta uçağa bindiği anda D+1'den D+365'e otomatik takip, fotoğraflı iyileşme kaydı, komplikasyon triyajı." },
  ],
  [
    { title: 'The patient writes', body: 'Every message from WhatsApp, Instagram DM, or an ad form lands in one inbox. Text, voice notes, and photos are all understood.' },
    { title: 'AI greets in 5 seconds', body: "It recognizes the patient's language, asks branch-specific pre-assessment questions, and requests the needed photos with capture instructions." },
    { title: 'A doctor approves', body: 'The case drops into the doctor approval queue. The AI cannot quote a firm price until the doctor confirms eligibility and the price band.' },
    { title: 'A locked quote goes out', body: 'Itemized, versioned, time-limited — with the operating surgeon named. The deposit link is inside.' },
    { title: 'The aftercare line takes over', body: 'The moment the patient boards the flight, automatic follow-up runs from D+1 to D+365, with photo-tracked healing and complication triage.' },
  ],
);

// ── Problem ───────────────────────────────────────────────────────────────

export const problemHeading = (lang: string) => pick(lang,
  'Hasta sayısı düşüyor, hasta başı değer yükseliyor.',
  'Fewer patients. Higher value per patient.',
);
export const problemSub = (lang: string) => pick(lang,
  'Artık daha az hastayı daha pahalıya satmak zorundasınız. Bu, gelen her mesajın değerini kalıcı olarak değiştirdi.',
  "You now have to sell fewer patients at a higher price. That has permanently changed what every incoming message is worth.",
);
// Category A per the source policy: figures published by USHAŞ/TÜİK, shown
// with the official source name attached (docs/CARENOVA-STRATEJI.md §2.1).
// No private agency/vendor site is ever named on this page — see
// GECE-LOG.md for the three-category source policy this section follows.
export const problemCards = (lang: string) => pick(lang,
  [
    { stat: '1,54 mn → 1,40 mn', title: 'Hasta sayısı 2023\'ten beri %9 düştü', body: 'Türkiye\'ye gelen sağlık turisti sayısı 2023 zirvesinden bu yana geriliyor.', source: 'USHAŞ / TÜİK sağlık turizmi istatistikleri' },
    { stat: '$1.597 → $2.805', title: 'Hasta başı gelir %76 arttı (2022 → 2026 Ç2)', body: 'Pazar hacimden değere kayıyor — kazanan, gelen her lead\'i daha yüksek oranda kapatan klinik.', source: 'USHAŞ / TÜİK sağlık turizmi istatistikleri' },
    { stat: '$3,02 milyar', title: '2025 toplam sağlık turizmi geliri', body: 'Aynı toplam gelir artık daha az hastaya dağılıyor — hasta başı marj her zamankinden değerli.', source: 'USHAŞ / TÜİK sağlık turizmi istatistikleri' },
  ],
  [
    { stat: '1.54M → 1.40M', title: 'Patient volume down 9% since 2023', body: "The number of health tourists arriving in Turkey has been declining since its 2023 peak.", source: 'USHAŞ / TÜİK health tourism statistics' },
    { stat: '$1,597 → $2,805', title: 'Revenue per patient up 76% (2022 → Q2 2026)', body: 'The market is shifting from volume to value — the winner is whoever closes a higher share of every incoming lead.', source: 'USHAŞ / TÜİK health tourism statistics' },
    { stat: '$3.02B', title: 'Total health-tourism revenue, 2025', body: 'The same total revenue is now spread across fewer patients — margin per patient matters more than ever.', source: 'USHAŞ / TÜİK health tourism statistics' },
  ],
);

// Visual funnel (Problem section) — same ₺40,000 budget, two outcomes.
export const problemFunnelHeading = (lang: string) => pick(lang,
  'Aynı bütçe, iki farklı sonuç',
  'Same budget, two different outcomes',
);
export const problemFunnel = (lang: string) => ({
  ...pick(lang,
    {
      budget: '₺40.000 reklam bütçesi → 100 lead',
      slow: { label: 'Yavaş / eğitimsiz ekip', patients: '1–2 hasta', cpa: 'CPA ₺20.000–40.000' },
      fast: { label: 'Hızlı / eğitimli ekip (CareNova ile)', patients: '15–20 hasta', cpa: 'CPA ₺2.000–2.700' },
    },
    {
      budget: '₺40,000 ad budget → 100 leads',
      slow: { label: 'Slow / untrained team', patients: '1–2 patients', cpa: 'CPA ₺20,000–40,000' },
      fast: { label: 'Fast / trained team (with CareNova)', patients: '15–20 patients', cpa: 'CPA ₺2,000–2,700' },
    },
  ),
  source: industryDataLabel(lang),
});

// ── Trust wounds (Bölüm 4.1 / 4.3) ───────────────────────────────────────

export const trustHeading = (lang: string) => pick(lang, 'Üç güven yarası, üç somut cevap.', 'Three trust wounds. Three concrete answers.');
export const trustSub = (lang: string) => pick(lang,
  'Rakiplerin hiçbiri bu üçünü birden çözmüyor.',
  "None of the alternatives solve all three at once.",
);
export const trustRows = (lang: string) => pick(lang,
  [
    {
      wound: '"Beni kim ameliyat edecek?"',
      answer: 'Doktor Kimlik Kartı',
      detail: 'Ameliyatı yapacak doktor isimle, tescil numarasıyla ve tanıtım videosuyla paylaşılır — WhatsApp\'tan tek tıkla görülür.',
      card: { kind: 'doctor', name: 'Dr. Emre Yıldız', meta: 'Saç Ekimi Uzmanı · Tescil No: TR-34-88213', badge: 'Onaylı' },
    },
    {
      wound: '"Fiyat gelince değişti"',
      answer: 'Kilitli Teklif',
      detail: "Versiyonlu, hash'li, süreli, kalem kalem teklif. Fiyat değişirse hasta gerekçesini görür — sessizce değişmez.",
      card: { kind: 'quote', name: 'Teklif #CN-2026-0142', meta: '3.400 greft · 21 gün geçerli', badge: '€2.100' },
    },
    {
      wound: '"Ödeme sonrası kayboldular"',
      answer: 'Bakım Hattı',
      detail: "D+1'den D+365'e otomatik takip, fotoğraf isteme, komplikasyon triyajı — dönüş sonrası terk edilme yok.",
      card: { kind: 'timeline', name: 'Bakım Hattı', meta: 'D+7 kontrol · fotoğraf istendi', badge: 'Aktif' },
    },
  ],
  [
    {
      wound: '"Who will actually operate on me?"',
      answer: 'Doctor ID Card',
      detail: "The operating doctor is shared by name, registration number and a short video — one tap away on WhatsApp.",
      card: { kind: 'doctor', name: 'Dr. Emre Yıldız', meta: 'Hair Transplant Specialist · Reg. No: TR-34-88213', badge: 'Verified' },
    },
    {
      wound: '"The price changed when I arrived"',
      answer: 'Locked Quote',
      detail: 'Versioned, hashed, time-limited, itemized. If the price changes, the patient sees exactly why — never silently.',
      card: { kind: 'quote', name: 'Quote #CN-2026-0142', meta: '3,400 grafts · valid 21 days', badge: '€2,100' },
    },
    {
      wound: '"They disappeared after payment"',
      answer: 'Aftercare Line',
      detail: 'Automatic follow-up from D+1 to D+365, photo requests, complication triage — no post-return abandonment.',
      card: { kind: 'timeline', name: 'Aftercare Line', meta: 'D+7 checkup · photo requested', badge: 'Active' },
    },
  ],
);

// ── Platform modules (Bölüm 7) ───────────────────────────────────────────

export const platformHeading = (lang: string) => pick(lang, 'Tek platform, uçtan uca vaka yönetimi.', 'One platform, end-to-end case management.');
export const platformModules = (lang: string) => pick(lang,
  [
    { title: 'Çok Dilli AI Ajanı', body: 'Ses notu ve fotoğraf anlama dahil.', example: 'Örnek: Arapça ses notu → yazıya çevrilir → branşa özel soruyla yanıtlanır.' },
    { title: 'Vaka Dosyası', body: 'Hasta, refakatçi, tıbbi dosya, teklif, seyahat, ödeme — tek kayıt.', example: 'Pasaport, uçuş, refakatçi, teklif, ödeme, 365 günlük takip — tek kayıtta.' },
    { title: 'Branş Şablonları', body: 'Saç ekimi, diş, estetik ve ötesi — branşa özel soru ve yetki matrisi.', example: 'Örnek: göz branşı etkinleştirilince AI otomatik olarak sadece nitelendirme moduna geçer.' },
    { title: 'Doktor Onay Kuyruğu', body: 'AI teklif vermeden önce doktor onayı zorunlu.', example: 'Doktor telefonundan fotoğrafı inceler, greft sayısını onaylar, teklif otomatik gider.' },
    { title: 'Seyahat Konsiyerjliği', body: 'Uçuş takibi, transfer, tercüman, gün gün program.', example: 'Uçuş rötar ederse transfer şoförü ve klinik otomatik bilgilendirilir.' },
    { title: 'Kanal ROI Panosu', body: 'Komisyonlu ve direkt kanalın gerçek net marjını görün.', example: 'Örnek: Pazaryeri kanalının %15 komisyon sonrası gerçek marjını tek ekranda görün.' },
  ],
  [
    { title: 'Multilingual AI Agent', body: 'Voice-note and photo understanding included.', example: 'Example: an Arabic voice note is transcribed and answered with the right branch-specific question.' },
    { title: 'Case File', body: 'Patient, companions, medical file, quote, travel, payments — one record.', example: 'Passport, flight, companion, quote, payment, 365-day follow-up — in one record.' },
    { title: 'Branch Templates', body: 'Hair transplant, dental, aesthetic and beyond — branch-specific questions and authority matrix.', example: 'Example: activating the eye branch automatically switches the AI to qualification-only mode.' },
    { title: 'Doctor Approval Queue', body: "Doctor sign-off required before the AI can issue a quote.", example: "The doctor reviews the photo from their phone, confirms the graft count, the quote goes out automatically." },
    { title: 'Travel Concierge', body: 'Flight tracking, transfers, interpreters, day-by-day itinerary.', example: 'If a flight is delayed, the transfer driver and clinic are notified automatically.' },
    { title: 'Channel ROI Dashboard', body: 'See the true net margin of commissioned vs. direct channels.', example: "Example: see a marketplace channel's real margin after its 15% commission, in one screen." },
  ],
);

// ── Branches & AI authority matrix (#branslar) ─────────────────────────────

export const branchesHeading = (lang: string) => pick(lang,
  "AI'ın nerede fiyat veremeyeceğini de biliyoruz.",
  "We also know where the AI can't quote a price.",
);
export const branchesSub = (lang: string) => pick(lang,
  'Rakiplerin hiçbiri sınırını söylemiyor — bu dürüstlük güven kuruyor.',
  "None of the alternatives state their limits — that honesty is what builds trust.",
);
export const branchesTable = (lang: string) => pick(lang,
  [
    { branch: 'Saç ekimi', status: 'Hazır şablon', authority: 'Fotoğraftan fiyat aralığı, kesin fiyat doktor onayıyla' },
    { branch: 'Diş', status: 'Hazır şablon', authority: 'Aralık; implantta panoramik/CBCT olmadan fiyat yok' },
    { branch: 'Estetik cerrahi', status: 'Hazır şablon', authority: 'Sadece nitelendirme — anestezi uygunluğu doktor kararı' },
    { branch: 'Göz (LASIK/SMILE)', status: 'Yapılandırılabilir', authority: 'Ön eleme; kornea uygunluğu yerinde muayene' },
    { branch: 'Obezite/bariatrik', status: 'Yapılandırılabilir', authority: 'Sadece nitelendirme — BMI ve komorbidite' },
    { branch: 'Tüp bebek (IVF)', status: 'Yapılandırılabilir', authority: "Sadece nitelendirme — donör gamet Türkiye'de yasal değil, AI bunu ilk mesajda söyler" },
    { branch: 'Ortopedi', status: 'Yapılandırılabilir', authority: 'Görüntüleme incelemesi zorunlu' },
    { branch: 'Kardiyoloji/Onkoloji', status: 'Yapılandırılabilir', authority: 'Sadece lojistik ve randevu' },
    { branch: 'Check-up', status: 'Hazır şablon', authority: 'Uçtan uca, rezervasyona kadar' },
  ],
  [
    { branch: 'Hair transplant', status: 'Ready template', authority: 'Price range from photos, firm price with doctor approval' },
    { branch: 'Dental', status: 'Ready template', authority: 'Range only; no price for implants without panoramic/CBCT imaging' },
    { branch: 'Aesthetic surgery', status: 'Ready template', authority: 'Qualification only — anesthesia fitness is a doctor decision' },
    { branch: 'Eye (LASIK/SMILE)', status: 'Configurable', authority: 'Pre-screening only; corneal fitness needs an in-person exam' },
    { branch: 'Bariatric', status: 'Configurable', authority: 'Qualification only — BMI and comorbidities' },
    { branch: 'IVF', status: 'Configurable', authority: 'Qualification only — donor gametes are not legal in Turkey, the AI states this in its first reply' },
    { branch: 'Orthopedics', status: 'Configurable', authority: 'Imaging review required' },
    { branch: 'Cardiology/Oncology', status: 'Configurable', authority: 'Logistics and scheduling only' },
    { branch: 'Check-up', status: 'Ready template', authority: 'End-to-end, through to booking' },
  ],
);

// ── Aftercare timeline (#bakim-hatti) ──────────────────────────────────────

export const aftercareHeading = (lang: string) => pick(lang, 'Bakım hattı: hasta eve döndükten sonra', 'The aftercare line: after the patient goes home');
export const aftercareSub = (lang: string) => pick(lang,
  "Şikayetlerin en yoğun kümesi \"ödeme sonrası kayboldular\". Bu bölüm o şikayetin panzehiri.",
  'The densest cluster of complaints is "they disappeared after payment." This section is the antidote.',
);
export const aftercareDays = (lang: string) => pick(lang,
  [
    { day: 'D+1', label: 'Uçuş sonrası kontrol' },
    { day: 'D+3', label: 'İlk iyileşme kontrolü' },
    { day: 'D+7', label: 'Fotoğraflı kontrol' },
    { day: 'D+15', label: 'İkinci aşama takip' },
    { day: 'D+30', label: 'Bir aylık değerlendirme' },
    { day: 'D+90', label: 'Üç aylık sonuç fotoğrafı' },
    { day: 'D+180', label: 'Altı aylık kontrol' },
    { day: 'D+365', label: 'Yıl sonu değerlendirme' },
  ],
  [
    { day: 'D+1', label: 'Post-flight check-in' },
    { day: 'D+3', label: 'First healing check' },
    { day: 'D+7', label: 'Photo-tracked check' },
    { day: 'D+15', label: 'Second-stage follow-up' },
    { day: 'D+30', label: 'One-month review' },
    { day: 'D+90', label: 'Three-month result photo' },
    { day: 'D+180', label: 'Six-month check' },
    { day: 'D+365', label: 'Year-end review' },
  ],
);
export const aftercareExample = (lang: string) => pick(lang,
  { day: 'D+7 · Saç Ekimi · Almanca', message: 'Merhaba Lukas! 7. gününüzdesiniz. İyileşme takibi için bugün 2 fotoğraf gönderir misiniz (ön ve tepe)?' },
  { day: 'D+7 · Hair Transplant · German', message: 'Hi Lukas! You\'re on day 7. Could you send 2 photos today (front and crown) for the healing check?' },
);

// ── Comparison (#karsilastirma) ────────────────────────────────────────────

export const comparisonHeading = (lang: string) => pick(lang, 'Nasıl karşılaştırılır?', 'How it compares');
export const comparisonSub = (lang: string) => pick(lang,
  'Kategori bazlı karşılaştırma — belirli bir markayı hedeflemiyoruz.',
  "A category-level comparison — not aimed at any specific brand.",
);
export const comparisonColumns = (lang: string) => pick(lang,
  ['Genel klinik CRM', 'Çeviri tabanlı chatbot', 'Pazaryeri (komisyonlu)', 'CareNova'],
  ['General clinic CRM', 'Translation-based chatbot', 'Marketplace (commissioned)', 'CareNova'],
);
type CompCell = 'no' | 'partial' | 'yes' | 'na';
export const comparisonRows = (lang: string) => pick(lang,
  [
    { label: "Hastanın dilinde doğal konuşma", cells: ['no', 'partial', 'na', 'yes'] as CompCell[] },
    { label: 'Ses notu ve fotoğraf anlama', cells: ['no', 'no', 'na', 'yes'] as CompCell[] },
    { label: 'Branşa göre AI fiyat yetkisi', cells: ['no', 'no', 'na', 'yes'] as CompCell[] },
    { label: 'Doktor onay kuyruğu', cells: ['no', 'no', 'no', 'yes'] as CompCell[] },
    { label: 'Kilitli, versiyonlu teklif', cells: ['no', 'no', 'no', 'yes'] as CompCell[] },
    { label: 'Dönüş sonrası bakım hattı', cells: ['no', 'no', 'no', 'yes'] as CompCell[] },
    { label: 'KVKK + Tanıtım Yönetmeliği koruyucusu', cells: ['no', 'no', 'na', 'yes'] as CompCell[] },
    { label: 'Hastanın kime ait olduğu', cells: ['Klinik', 'Klinik', 'Pazaryeri', 'Klinik'] },
    { label: 'Maliyet yapısı', cells: ['Abonelik', 'Abonelik', 'İşlem başı komisyon', 'Abonelik'] },
  ],
  [
    { label: "Natural conversation in the patient's language", cells: ['no', 'partial', 'na', 'yes'] as CompCell[] },
    { label: 'Voice-note and photo understanding', cells: ['no', 'no', 'na', 'yes'] as CompCell[] },
    { label: 'Branch-based AI pricing authority', cells: ['no', 'no', 'na', 'yes'] as CompCell[] },
    { label: 'Doctor approval queue', cells: ['no', 'no', 'no', 'yes'] as CompCell[] },
    { label: 'Locked, versioned quote', cells: ['no', 'no', 'no', 'yes'] as CompCell[] },
    { label: 'Post-return aftercare line', cells: ['no', 'no', 'no', 'yes'] as CompCell[] },
    { label: 'KVKK + Advertising Regulation guard', cells: ['no', 'no', 'na', 'yes'] as CompCell[] },
    { label: 'Who the patient belongs to', cells: ['Clinic', 'Clinic', 'Marketplace', 'Clinic'] },
    { label: 'Cost structure', cells: ['Subscription', 'Subscription', 'Per-transaction commission', 'Subscription'] },
  ],
);
export const comparisonNote = (lang: string) => pick(lang,
  'Pazaryerleri hasta getirir ama hastayı sahiplenir. CareNova kendi kanalınızı kurmanız için var — pazaryerlerinden gelen lead\'leri de içeri alır.',
  "Marketplaces bring patients but keep ownership of them. CareNova exists so you build your own channel — and it can still import leads from marketplaces.",
);

// ── Channel ROI example (#roi) ─────────────────────────────────────────────

export const roiHeading = (lang: string) => pick(lang, 'Kanal ROI örneği', 'Channel ROI example');
export const roiPanelLabel = (lang: string) => pick(lang, 'Örnek panel görünümü — gerçek müşteri verisi değil', 'Example panel view — not real customer data');
export const roiSub = (lang: string) => pick(lang,
  'Komisyonlu kanalın gerçek maliyetini ilk kez göreceksiniz.',
  "You'll see the real cost of your commissioned channel for the first time.",
);
export const roiColumns = (lang: string) => pick(lang,
  ['Kanal', 'Lead', 'CPL', 'Vaka', 'CAC', 'Komisyon', 'Net Marj'],
  ['Channel', 'Leads', 'CPL', 'Cases', 'CAC', 'Commission', 'Net Margin'],
);
export const roiRows = (lang: string) => pick(lang,
  [
    { channel: 'Meta reklam', leads: '220', cpl: '₺380', cases: '18', cac: '₺4.644', commission: '—', margin: 'Yüksek' },
    { channel: 'Pazaryeri', leads: '95', cpl: '₺0', cases: '14', cac: '₺0*', commission: '%15', margin: 'Orta' },
    { channel: 'Instagram organik', leads: '60', cpl: '₺0', cases: '5', cac: '₺0', commission: '—', margin: 'Yüksek' },
  ],
  [
    { channel: 'Meta ads', leads: '220', cpl: '₺380', cases: '18', cac: '₺4,644', commission: '—', margin: 'High' },
    { channel: 'Marketplace', leads: '95', cpl: '₺0', cases: '14', cac: '₺0*', commission: '15%', margin: 'Medium' },
    { channel: 'Instagram organic', leads: '60', cpl: '₺0', cases: '5', cac: '₺0', commission: '—', margin: 'High' },
  ],
);
export const roiFootnote = (lang: string) => pick(lang,
  '* Doğrudan lead maliyeti €0 görünür — gerçek maliyet vaka başına ödenen %15 komisyondur, panoda ayrıca gösterilir.',
  '* Direct lead cost shows as ₺0 — the real cost is the 15% per-case commission, shown separately on the dashboard.',
);

// ── Regulatory Shield (Bölüm 7/M7) ───────────────────────────────────────

export const complianceHeading = (lang: string) => pick(lang, 'Mevzuat Kalkanı', 'Regulatory Shield');
export const complianceSub = (lang: string) => pick(lang,
  'Uyum, ürünün içine gömülü — sonradan eklenen bir katman değil.',
  "Compliance is built into the product — not bolted on afterward.",
);
export const complianceItems = (lang: string) => pick(lang,
  [
    { title: 'KVKK Uyumu', body: 'Açık rıza, VERBİS kaydı, yurt dışı aktarım bildirimi otomatik takip edilir.', sanction: 'Bildirim yapılmazsa: 50.000–1.000.000 TL idari para cezası (KVKK m.18).' },
    { title: 'Tanıtım Yönetmeliği Koruyucusu', body: 'Yasak fiyat/kampanya paylaşımı ve onamsız öncesi/sonrası görseli sistem tarafından engellenir.', sanction: 'İhlalde: uluslararası sağlık turizmi sağlayıcıları için 1–3 ay faaliyet durdurma.' },
    { title: 'Ek-1 Onam Yönetimi', body: 'Görsel kullanım onamı dijital, imzalı, geri alınabilir ve dile göre versiyonlu.', sanction: 'Onamsız paylaşım da Tanıtım Yönetmeliği kapsamında aynı yaptırıma tabi.' },
    { title: '2025 Sağlık Turizmi Yönetmeliği Paneli', body: 'HealthTürkiye raporlama takvimi ve komplikasyon sigortası takibi tek ekranda.', sanction: 'Komplikasyon sigortası 31.12.2026\'ya kadar zorunlu hale geliyor.' },
  ],
  [
    { title: 'KVKK Compliance', body: 'Explicit consent, VERBİS registration, and cross-border transfer notices are tracked automatically.', sanction: 'Failure to notify: 50,000–1,000,000 TL administrative fine (KVKK Art. 18).' },
    { title: 'Advertising Regulation Guard', body: 'Illegal price/campaign announcements and unconsented before/after photos are blocked by the system.', sanction: 'On violation: 1–3 month suspension of activity for international health tourism providers.' },
    { title: 'Annex-1 Consent Management', body: 'Image-use consent is digital, signed, revocable, and versioned by language.', sanction: 'Unconsented sharing falls under the same Advertising Regulation sanction.' },
    { title: '2025 Health Tourism Regulation Panel', body: 'HealthTürkiye reporting calendar and complication insurance tracking in one screen.', sanction: 'Complication insurance becomes mandatory by 31 Dec 2026.' },
  ],
);

// ── Setup / onboarding (#kurulum) ──────────────────────────────────────────

export const setupHeading = (lang: string) => pick(lang, 'Kurulum süreci', 'Setup process');
export const setupSub = (lang: string) => pick(lang,
  'Klinik 45 dakika · Solo 15 dakika. Numaranız değişmiyor. Teknik ekip gerekmiyor.',
  'Clinic: 45 minutes · Solo: 15 minutes. Your number stays the same. No technical team needed.',
);
export const setupSteps = (lang: string) => pick(lang,
  [
    'Klinik bilgisi', 'Branş seçimi', 'WhatsApp bağlama', 'Doktor kartları',
    'Bilgi bankası (şablondan ön dolu)', 'Fiyat bandı ve AI yetki onayı',
    'KVKK/Ek-1 metinleri, test sohbeti, canlıya al',
  ],
  [
    'Clinic info', 'Branch selection', 'Connect WhatsApp', 'Doctor cards',
    'Knowledge base (pre-filled from template)', 'Price band and AI authority approval',
    'KVKK/Annex-1 texts, test conversation, go live',
  ],
);

// ── Pricing (Bölüm 10) ────────────────────────────────────────────────────

export const pricingHeading = (lang: string) => pick(lang, 'Fiyatlandırma', 'Pricing');
export const pricingNote = (lang: string) => pick(lang,
  'Bu, kliniğe satılan yazılım fiyatıdır — hasta tedavi fiyatı değildir.',
  'This is the software price sold to the clinic — not a patient treatment price.',
);
export const pricingToggle = (lang: string) => pick(lang, ['Yıllık', 'Aylık'], ['Annual', 'Monthly']);
export const pricingRecommendedBadge = (lang: string) => pick(lang, 'Önerilen', 'Recommended');
export const pricingTiers = (lang: string) => pick(lang,
  [
    { name: 'Solo', audience: 'Bireysel doktor / tek şube', annual: 149, monthly: 189, features: ['3 kullanıcı', '1 WhatsApp hattı', 'Ayda 300 AI konuşması', '1 branş şablonu', '5 dil', '90 gün Bakım Hattı'] },
    { name: 'Klinik', audience: '5–50 kişilik klinik', annual: 449, monthly: 549, highlight: true, features: ['15 kullanıcı', '3 WhatsApp hattı', 'Ayda 2.000 AI konuşması', 'Sınırsız branş şablonu', 'Seyahat Konsiyerjliği', '365 gün Bakım Hattı', 'Komisyon motoru'] },
    { name: 'Grup', audience: 'Çok şubeli / ajans', annual: 1190, monthly: 1450, features: ['Sınırsız kullanıcı', '10 WhatsApp hattı', 'Ayda 10.000 AI konuşması', 'HBYS entegrasyonu', 'Özel Bakım Hattı', 'Atanmış hesap yöneticisi'] },
  ],
  [
    { name: 'Solo', audience: 'Individual doctor / single branch', annual: 149, monthly: 189, features: ['3 users', '1 WhatsApp line', '300 AI conversations/mo', '1 branch template', '5 languages', '90-day Aftercare Line'] },
    { name: 'Clinic', audience: '5–50 person clinic', annual: 449, monthly: 549, highlight: true, features: ['15 users', '3 WhatsApp lines', '2,000 AI conversations/mo', 'Unlimited branch templates', 'Travel Concierge', '365-day Aftercare Line', 'Commission engine'] },
    { name: 'Group', audience: 'Multi-branch / agency', annual: 1190, monthly: 1450, features: ['Unlimited users', '10 WhatsApp lines', '10,000 AI conversations/mo', 'HBYS integration', 'Custom Aftercare Line', 'Dedicated account manager'] },
  ],
);
export const pricingRoiHook = (lang: string) => pick(lang,
  'Klinik paketi ayda €449. Tek bir saç ekimi hastası €2.000. Bir ay bir hasta fazlası, dört ay ücretsiz kullanım demek.',
  'The Clinic plan is €449/month. One hair transplant patient is €2,000. One extra patient a month means four months of free usage.',
);
export const pricingCta = (lang: string) => pick(lang, 'Demo Talep Et', 'Request a Demo');

// ── FAQ ────────────────────────────────────────────────────────────────────

export const faqHeading = (lang: string) => pick(lang, 'Sıkça Sorulan Sorular', 'Frequently Asked Questions');
export const faqItems = (lang: string) => pick(lang,
  [
    { q: 'WhatsApp numaramı değiştirmem gerekiyor mu?', a: 'Hayır. Mevcut WhatsApp Business hattınız Meta Cloud API üzerinden bağlanır, numaranız aynı kalır.' },
    { q: 'AI robot gibi mi konuşuyor?', a: 'Hayır — Claude tabanlı AI, hastanın dilini ve kültürel bağlamını anlayarak doğal, empatik cevaplar üretir.' },
    { q: 'Hasta verim güvende mi (KVKK)?', a: 'Evet. Hasta verisi hiçbir koşulda model eğitiminde kullanılmaz, VERBİS kaydı ve açık rıza akışları ürünün içinde.' },
    { q: 'Kurulum ne kadar sürer?', a: 'Klinik paketi için ~45 dakika, Solo paket için ~15 dakika — WhatsApp bağlantısı ve branş şablonu seçimiyle.' },
    { q: 'Hangi branşlarda çalışıyor?', a: 'Saç ekimi, diş ve estetik cerrahi hazır şablonlarla; göz, ortopedi, IVF, bariatrik, onkoloji, kardiyoloji ve check-up branş-bağımsız motorla yapılandırılabilir.' },
    { q: 'AI yanlış fiyat verirse ne olur?', a: 'Vermez — her branşın AI fiyat yetkisi (tam / aralık / sadece nitelendirme) sistem tarafından zorlanır, doktor onayı olmadan kesin fiyat verilemez.' },
    { q: 'Ekibim işini kaybeder mi?', a: "Hayır — AI, 60 lead'i yüzeysel kovalamak yerine ekibinizin 12 sıcak lead'i derinlemesine kapatmasını sağlar. Kapanış hâlâ insan işi." },
    { q: 'Mevcut CRM\'imle entegre olur mu?', a: 'Meta Lead Ads, Instagram DM ve pazaryeri (Bookimed, Flymedi) lead\'lerini içeri alabiliyoruz; özel entegrasyonlar için bize ulaşın.' },
  ],
  [
    { q: 'Do I need to change my WhatsApp number?', a: 'No. Your existing WhatsApp Business line connects via the Meta Cloud API — your number stays the same.' },
    { q: 'Does the AI sound like a robot?', a: "No — the Claude-based AI understands the patient's language and cultural context and replies naturally and empathetically." },
    { q: 'Is my patient data safe (KVKK)?', a: 'Yes. Patient data is never used for model training under any circumstance; VERBİS registration and explicit-consent flows are built in.' },
    { q: 'How long does setup take?', a: '~45 minutes for the Clinic plan, ~15 minutes for Solo — WhatsApp connection plus branch template selection.' },
    { q: 'Which branches does it support?', a: 'Hair transplant, dental, and aesthetic surgery ship with ready templates; eye, orthopedics, IVF, bariatric, oncology, cardiology and check-up are configurable via the branch-agnostic engine.' },
    { q: 'What if the AI gives a wrong price?', a: "It can't — each branch's AI pricing authority (full / range / qualification-only) is enforced by the system; no exact price without doctor approval." },
    { q: 'Will my team lose their jobs?', a: 'No — instead of chasing 60 leads shallowly, the AI lets your team close 12 hot leads deeply. Closing is still a human job.' },
    { q: 'Does it integrate with my existing CRM?', a: 'We can import leads from Meta Lead Ads, Instagram DM, and marketplaces (Bookimed, Flymedi); contact us for custom integrations.' },
  ],
);

// ── Trust basis band ("Neye dayanıyoruz") ──────────────────────────────────

export const trustBasisHeading = (lang: string) => pick(lang, 'Neye dayanıyoruz', 'What we build on');
export const trustBasisItems = (lang: string) => pick(lang,
  [
    { title: 'USHAŞ / TÜİK sektör verisi', body: 'Pazar büyüklüğü, hasta sayısı ve dönüşüm rakamları resmi istatistiklerden — bkz. CARENOVA-STRATEJI.md.' },
    { title: 'Sağlık Bakanlığı yönetmelikleri', body: '2025 Sağlık Turizmi Yönetmeliği ve Tanıtım Yönetmeliği, ürün kurallarının kaynağı.' },
    { title: 'KVKK', body: 'Açık rıza, VERBİS ve yurt dışı aktarım kuralları, 6698 sayılı kanuna göre uygulanır.' },
  ],
  [
    { title: 'USHAŞ / TÜİK industry data', body: 'Market size, patient volume, and conversion figures come from official statistics — see CARENOVA-STRATEJI.md.' },
    { title: 'Ministry of Health regulations', body: 'The 2025 Health Tourism Regulation and the Advertising Regulation are the source of the product\'s rules.' },
    { title: 'KVKK (Turkish DPA)', body: 'Explicit consent, VERBİS, and cross-border transfer rules are implemented per Law No. 6698.' },
  ],
);

// ── CTA / demo form ────────────────────────────────────────────────────────

export const ctaHeading = (lang: string) => pick(lang, 'Kliniğinizde 20 dakikada görün.', 'See it on your own clinic in 20 minutes.');
export const ctaSub = (lang: string) => pick(lang,
  'Gerçek bir WhatsApp numarasında, canlı bir demo. Slayt yok.',
  'A live demo on a real WhatsApp number. No slides.',
);
export const ctaFormLabels = (lang: string) => pick(lang,
  { name: 'Ad Soyad', email: 'E-posta', clinic: 'Klinik Adı', city: 'Şehir', branch: 'Branş', phone: 'Telefon (opsiyonel)', submit: 'Demo Talep Et', success: 'Teşekkürler! Ekibimiz 24 saat içinde sizinle iletişime geçecek.' },
  { name: 'Full Name', email: 'Email', clinic: 'Clinic Name', city: 'City', branch: 'Branch', phone: 'Phone (optional)', submit: 'Request a Demo', success: "Thanks! Our team will reach out within 24 hours." },
);
export const ctaBranchOptions = (lang: string) => pick(lang,
  ['Saç Ekimi', 'Diş', 'Estetik Cerrahi', 'Göz', 'Diğer'],
  ['Hair Transplant', 'Dental', 'Aesthetic Surgery', 'Eye', 'Other'],
);

// ── Footer ─────────────────────────────────────────────────────────────────

export const footerColumns = (lang: string) => pick(lang,
  {
    product: { heading: 'Ürün', links: [
      { label: 'Platform', href: '#platform' },
      { label: 'Branşlar', href: '#branslar' },
      { label: 'Fiyatlandırma', href: '#pricing' },
      { label: 'Mevzuat Kalkanı', href: '#compliance' },
    ] },
    branches: { heading: 'Branşlar', links: [
      { label: 'Saç Ekimi', href: '#branslar' },
      { label: 'Diş', href: '#branslar' },
      { label: 'Estetik Cerrahi', href: '#branslar' },
      { label: 'Diğer branşlar', href: '#branslar' },
    ] },
    company: { heading: 'Kurumsal', links: [
      { label: 'Hakkımızda', href: '/about' },
      { label: 'İletişim', href: '/contact' },
      { label: 'Kariyer', href: '/careers' },
      { label: 'Blog', href: '/blog' },
    ] },
    legal: { heading: 'Yasal', links: [
      { label: 'Gizlilik', href: '/legal/privacy' },
      { label: 'Koşullar', href: '/legal/terms' },
      { label: 'KVKK Aydınlatma', href: '/legal/gdpr' },
      { label: 'Çerezler', href: '/legal/cookies' },
    ] },
  },
  {
    product: { heading: 'Product', links: [
      { label: 'Platform', href: '#platform' },
      { label: 'Branches', href: '#branslar' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Regulatory Shield', href: '#compliance' },
    ] },
    branches: { heading: 'Branches', links: [
      { label: 'Hair Transplant', href: '#branslar' },
      { label: 'Dental', href: '#branslar' },
      { label: 'Aesthetic Surgery', href: '#branslar' },
      { label: 'Other branches', href: '#branslar' },
    ] },
    company: { heading: 'Company', links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Careers', href: '/careers' },
      { label: 'Blog', href: '/blog' },
    ] },
    legal: { heading: 'Legal', links: [
      { label: 'Privacy', href: '/legal/privacy' },
      { label: 'Terms', href: '/legal/terms' },
      { label: 'KVKK Notice', href: '/legal/gdpr' },
      { label: 'Cookies', href: '/legal/cookies' },
    ] },
  },
);
export const footerBlurb = (lang: string) => pick(lang,
  'Türkiye sağlık turizmi klinikleri için çok dilli AI hasta güven platformu.',
  'The multilingual AI patient-trust platform for Turkish health tourism clinics.',
);

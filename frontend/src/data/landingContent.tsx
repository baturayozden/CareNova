// Bilingual (TR/EN) structured content for the CareNova landing page.
// Selected by the active i18next language at render time. Kept as typed data
// here rather than flat i18next JSON because most of it is repeating
// structured content (FAQ items, pricing tiers, trust-wound rows) that reads
// far more maintainably as arrays of objects than as hundreds of flat keys.

export type Lang = 'tr' | 'en';

function pick<T>(lang: string, tr: T, en: T): T {
  return lang?.startsWith('tr') ? tr : en;
}

// ── Nav ───────────────────────────────────────────────────────────────────

export const navLinks = (lang: string) => pick(lang,
  [
    { label: 'Platform', href: '#platform' },
    { label: 'Özellikler', href: '#trust' },
    { label: 'Fiyatlandırma', href: '#pricing' },
    { label: 'SSS', href: '#faq' },
  ],
  [
    { label: 'Platform', href: '#platform' },
    { label: 'Features', href: '#trust' },
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
    { value: '10×', label: 'Dönüşüm Artışı' },
    { value: '7/24', label: 'Kesintisiz' },
  ],
  [
    { value: '<5s', label: 'Reply Time' },
    { value: '5', label: 'Languages' },
    { value: '10×', label: 'Conversion Lift' },
    { value: '24/7', label: 'Always On' },
  ],
);

// WhatsApp mock conversation — hair transplant scenario, cycles TR → EN → AR → DE → RU
type Msg = { side: 'in' | 'out'; text: string };
export const heroConversations: Record<'tr' | 'en' | 'ar' | 'de' | 'ru', Msg[]> = {
  de: [
    { side: 'in',  text: 'Hallo! Ich interessiere mich für eine Haartransplantation. Können Sie mir einen Preis nennen?' },
    { side: 'out', text: 'Hallo! 😊 Könnten Sie uns 3 Fotos schicken (Vorderansicht, Oberkopf, Spenderbereich)? So kann ich Ihnen eine erste Preisspanne nennen.' },
    { side: 'in',  text: '[3 Fotos gesendet]' },
    { side: 'out', text: 'Danke! Basierend auf den Fotos: 3200–3800 Grafts, €1900–2300. Endgültiger Preis nach Arztfreigabe. Dr. Emre Yıldız würde Ihren Fall übernehmen — hier sein Profil 👨‍⚕️' },
  ],
  en: [
    { side: 'in',  text: "Hi! I'm interested in a hair transplant. Can you give me a price?" },
    { side: 'out', text: 'Hi! 😊 Could you send 3 photos (front, crown, donor area)? I can give you an initial range from those.' },
    { side: 'in',  text: '[3 photos sent]' },
    { side: 'out', text: "Thanks! Based on the photos: 3200–3800 grafts, €1900–2300. Final price after doctor's approval. Dr. Emre Yıldız would take your case — here's his profile 👨‍⚕️" },
  ],
  tr: [
    { side: 'in',  text: 'Merhaba, saç ekimi için fiyat alabilir miyim?' },
    { side: 'out', text: 'Merhaba! 😊 3 fotoğraf gönderir misiniz (ön, tepe, donör bölge)? Fotoğraflardan bir ilk aralık verebilirim.' },
    { side: 'in',  text: '[3 fotoğraf gönderildi]' },
    { side: 'out', text: 'Teşekkürler! Fotoğraflara göre: 3200–3800 greft, €1900–2300 aralığında. Kesin fiyat doktor onayından sonra. Dr. Emre Yıldız vakanızı üstlenecek — profili burada 👨‍⚕️' },
  ],
  ar: [
    { side: 'in',  text: 'مرحباً، أرغب في معرفة سعر زراعة الشعر' },
    { side: 'out', text: 'أهلاً! 😊 هل يمكنك إرسال 3 صور (أمامية، قمة الرأس، منطقة المتبرع)؟ يمكنني إعطاؤك نطاق سعر أولي منها.' },
    { side: 'in',  text: '[تم إرسال 3 صور]' },
    { side: 'out', text: 'شكراً! بناءً على الصور: 3200-3800 بصيلة، 1900-2300 يورو. السعر النهائي بعد موافقة الطبيب. د. أمرة يلدز سيتولى حالتك — ملفه هنا 👨‍⚕️' },
  ],
  ru: [
    { side: 'in',  text: 'Здравствуйте! Интересует пересадка волос. Подскажете цену?' },
    { side: 'out', text: 'Здравствуйте! 😊 Пришлите, пожалуйста, 3 фото (спереди, макушка, донорская зона) — по ним смогу дать первичный диапазон цены.' },
    { side: 'in',  text: '[Отправлено 3 фото]' },
    { side: 'out', text: 'Спасибо! По фото: 3200–3800 графтов, €1900–2300. Точная цена после одобрения врача. Вашим случаем займётся др. Эмре Йылдыз — вот его профиль 👨‍⚕️' },
  ],
};
export const heroCycleOrder: (keyof typeof heroConversations)[] = ['tr', 'en', 'ar', 'de', 'ru'];
export const heroLangLabel: Record<keyof typeof heroConversations, string> = {
  tr: '🇹🇷 Türkçe', en: '🇬🇧 English', ar: '🇸🇦 العربية', de: '🇩🇪 Deutsch', ru: '🇷🇺 Русский',
};

// ── Problem ───────────────────────────────────────────────────────────────

export const problemHeading = (lang: string) => pick(lang, 'Kaybettiğiniz para, tam olarak burada.', "Here's exactly where you're losing money.");
export const problemSub = (lang: string) => pick(lang,
  'Aynı reklam bütçesi, cevap hızına göre 10-15 kat farklı sonuç veriyor.',
  'The same ad budget produces a 10-15× different outcome, depending on reply speed.',
);
export const problemCards = (lang: string) => pick(lang,
  [
    { stat: '₺150–900', title: 'Lead başına ödüyorsunuz', body: 'Ve gelen lead\'lerin %85–95\'i hiç hastaya dönüşmüyor.' },
    { stat: '10×', title: '5 dakikada yanıt = 10 kat dönüşüm', body: '1 saatte cevaplanan lead 7 kat, gece/hafta sonu gelen ~%35\'i hiç yanıtlanmıyor.' },
    { stat: '%1–2 vs %15–20', title: 'Eğitim farkı, dönüşümü 10 kat değiştiriyor', body: 'Eğitimsiz ekip %1–2, eğitimli ekip %15–20 dönüşüm yapıyor — aynı lead havuzunda.' },
  ],
  [
    { stat: '£120–720', title: 'You pay per lead', body: "And 85–95% of incoming leads never convert to a patient." },
    { stat: '10×', title: 'Reply in 5 minutes = 10× conversion', body: 'A lead answered within 1 hour converts 7×; ~35% arriving at night/weekend never get answered at all.' },
    { stat: '1–2% vs 15–20%', title: 'Training makes a 10× difference', body: 'An untrained team converts 1–2%; a trained team converts 15–20% — from the same lead pool.' },
  ],
);

// ── Trust wounds (Bölüm 4.1 / 4.3) ───────────────────────────────────────

export const trustHeading = (lang: string) => pick(lang, 'Üç güven yarası, üç somut cevap.', 'Three trust wounds. Three concrete answers.');
export const trustSub = (lang: string) => pick(lang,
  'Rakiplerin hiçbiri bu üçünü birden çözmüyor.',
  "None of the alternatives solve all three at once.",
);
export const trustRows = (lang: string) => pick(lang,
  [
    { wound: '"Beni kim ameliyat edecek?"', answer: 'Doktor Kimlik Kartı', detail: 'Ameliyatı yapacak doktor isimle, tescil numarasıyla ve tanıtım videosuyla paylaşılır — WhatsApp\'tan tek tıkla görülür.' },
    { wound: '"Fiyat gelince değişti"', answer: 'Kilitli Teklif', detail: 'Versiyonlu, hash\'li, süreli, kalem kalem teklif. Fiyat değişirse hasta gerekçesini görür — sessizce değişmez.' },
    { wound: '"Ödeme sonrası kayboldular"', answer: 'Bakım Hattı', detail: 'D+1\'den D+365\'e otomatik takip, fotoğraf isteme, komplikasyon triyajı — dönüş sonrası terk edilme yok.' },
  ],
  [
    { wound: '"Who will actually operate on me?"', answer: 'Doctor ID Card', detail: "The operating doctor is shared by name, registration number and a short video — one tap away on WhatsApp." },
    { wound: '"The price changed when I arrived"', answer: 'Locked Quote', detail: 'Versioned, hashed, time-limited, itemized. If the price changes, the patient sees exactly why — never silently.' },
    { wound: '"They disappeared after payment"', answer: 'Aftercare Line', detail: 'Automatic follow-up from D+1 to D+365, photo requests, complication triage — no post-return abandonment.' },
  ],
);

// ── Platform modules (Bölüm 7) ───────────────────────────────────────────

export const platformHeading = (lang: string) => pick(lang, 'Tek platform, uçtan uca vaka yönetimi.', 'One platform, end-to-end case management.');
export const platformModules = (lang: string) => pick(lang,
  [
    { title: 'Çok Dilli AI Ajanı', body: 'Ses notu ve fotoğraf anlama dahil, TR/EN/AR/DE/RU.' },
    { title: 'Vaka Dosyası', body: 'Hasta, refakatçi, tıbbi dosya, teklif, seyahat, ödeme — tek kayıt.' },
    { title: 'Branş Şablonları', body: 'Saç ekimi, diş, estetik ve ötesi — branşa özel soru ve yetki matrisi.' },
    { title: 'Doktor Onay Kuyruğu', body: 'AI teklif vermeden önce doktor onayı zorunlu.' },
    { title: 'Seyahat Konsiyerjliği', body: 'Uçuş takibi, transfer, tercüman, gün gün program.' },
    { title: 'Kanal ROI Panosu', body: 'Komisyonlu ve direkt kanalın gerçek net marjını görün.' },
  ],
  [
    { title: 'Multilingual AI Agent', body: 'Voice-note and photo understanding included, TR/EN/AR/DE/RU.' },
    { title: 'Case File', body: 'Patient, companions, medical file, quote, travel, payments — one record.' },
    { title: 'Branch Templates', body: 'Hair transplant, dental, aesthetic and beyond — branch-specific questions and authority matrix.' },
    { title: 'Doctor Approval Queue', body: "Doctor sign-off required before the AI can issue a quote." },
    { title: 'Travel Concierge', body: 'Flight tracking, transfers, interpreters, day-by-day itinerary.' },
    { title: 'Channel ROI Dashboard', body: 'See the true net margin of commissioned vs. direct channels.' },
  ],
);

// ── Regulatory Shield (Bölüm 7/M7) ───────────────────────────────────────

export const complianceHeading = (lang: string) => pick(lang, 'Mevzuat Kalkanı', 'Regulatory Shield');
export const complianceSub = (lang: string) => pick(lang,
  'Uyum, ürünün içine gömülü — sonradan eklenen bir katman değil.',
  "Compliance is built into the product — not bolted on afterward.",
);
export const complianceItems = (lang: string) => pick(lang,
  [
    { title: 'KVKK Uyumu', body: 'Açık rıza, VERBİS kaydı, yurt dışı aktarım bildirimi otomatik takip edilir.' },
    { title: 'Tanıtım Yönetmeliği Koruyucusu', body: 'Yasak fiyat/kampanya paylaşımı ve onamsız öncesi/sonrası görseli sistem tarafından engellenir.' },
    { title: 'Ek-1 Onam Yönetimi', body: 'Görsel kullanım onamı dijital, imzalı, geri alınabilir ve dile göre versiyonlu.' },
    { title: '2025 Sağlık Turizmi Yönetmeliği Paneli', body: 'HealthTürkiye raporlama takvimi ve komplikasyon sigortası takibi tek ekranda.' },
  ],
  [
    { title: 'KVKK Compliance', body: 'Explicit consent, VERBİS registration, and cross-border transfer notices are tracked automatically.' },
    { title: 'Advertising Regulation Guard', body: 'Illegal price/campaign announcements and unconsented before/after photos are blocked by the system.' },
    { title: 'Annex-1 Consent Management', body: 'Image-use consent is digital, signed, revocable, and versioned by language.' },
    { title: '2025 Health Tourism Regulation Panel', body: 'HealthTürkiye reporting calendar and complication insurance tracking in one screen.' },
  ],
);

// ── Pricing (Bölüm 10) ────────────────────────────────────────────────────

export const pricingHeading = (lang: string) => pick(lang, 'Fiyatlandırma', 'Pricing');
export const pricingNote = (lang: string) => pick(lang,
  'Bu, kliniğe satılan yazılım fiyatıdır — hasta tedavi fiyatı değildir.',
  'This is the software price sold to the clinic — not a patient treatment price.',
);
export const pricingToggle = (lang: string) => pick(lang, ['Yıllık', 'Aylık'], ['Annual', 'Monthly']);
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
    { q: 'Ekibim işini kaybeder mi?', a: 'Hayır — AI, 60 lead\'i yüzeysel kovalamak yerine ekibinizin 12 sıcak lead\'i derinlemesine kapatmasını sağlar. Kapanış hâlâ insan işi.' },
    { q: 'Mevcut CRM\'imle entegre olur mu?', a: 'Meta Lead Ads, Instagram DM ve pazaryeri (Bookimed, Flymedi) lead\'lerini içeri alabiliyoruz; özel entegrasyonlar için bize ulaşın.' },
  ],
  [
    { q: 'Do I need to change my WhatsApp number?', a: 'No. Your existing WhatsApp Business line connects via the Meta Cloud API — your number stays the same.' },
    { q: 'Does the AI sound like a robot?', a: 'No — the Claude-based AI understands the patient\'s language and cultural context and replies naturally and empathetically.' },
    { q: 'Is my patient data safe (KVKK)?', a: 'Yes. Patient data is never used for model training under any circumstance; VERBİS registration and explicit-consent flows are built in.' },
    { q: 'How long does setup take?', a: '~45 minutes for the Clinic plan, ~15 minutes for Solo — WhatsApp connection plus branch template selection.' },
    { q: 'Which branches does it support?', a: 'Hair transplant, dental, and aesthetic surgery ship with ready templates; eye, orthopedics, IVF, bariatric, oncology, cardiology and check-up are configurable via the branch-agnostic engine.' },
    { q: 'What if the AI gives a wrong price?', a: "It can't — each branch's AI pricing authority (full / range / qualification-only) is enforced by the system; no exact price without doctor approval." },
    { q: 'Will my team lose their jobs?', a: 'No — instead of chasing 60 leads shallowly, the AI lets your team close 12 hot leads deeply. Closing is still a human job.' },
    { q: 'Does it integrate with my existing CRM?', a: 'We can import leads from Meta Lead Ads, Instagram DM, and marketplaces (Bookimed, Flymedi); contact us for custom integrations.' },
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

// ── Footer ─────────────────────────────────────────────────────────────────

export const footerLinks = (lang: string) => pick(lang,
  { privacy: 'Gizlilik', terms: 'Koşullar', kvkk: 'KVKK', cookies: 'Çerezler', contact: 'İletişim' },
  { privacy: 'Privacy', terms: 'Terms', kvkk: 'KVKK', cookies: 'Cookies', contact: 'Contact' },
);

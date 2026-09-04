# Diş-spesifik temizlik envanteri (PAKET 1.3 / KOMUT 1)

Brief'in "envanteri çıkarıp durma, uygula" talimatına göre bu liste hem envanter hem de uygulanan değişikliklerin kaydıdır.

## Uygulandı

| Dosya | Ne vardı | Ne yapıldı |
|---|---|---|
| `backend/src/services/ai.js` | `"You are an expert dental practice assistant for a dental clinic."` | → generic `"You are an expert patient care assistant for a healthcare facility."` |
| `backend/src/services/ai.js` | `DENTAL EXPERTISE:` bloğu (implant/veneer/crown/Invisalign listesi) | **Tamamen kaldırıldı** — PAKET 6'da branş şablonundan gelecek |
| `backend/src/services/ai.js` | `classifyScenario` regex: `implant\|veneer\|whiten\|invisalign\|brace\|crown\|filling\|extraction\|clean\|checkup` | → generic `treatment\|procedure\|consultation\|tedavi\|işlem` |
| `backend/src/services/ai.js` | Emergency regex: `broken tooth\|knocked out` | Kaldırıldı, generic emergency terimleri (severe pain/bleeding/swollen/abscess) kaldı |
| `backend/src/services/ai.js` | `"who is the dentist"` (trust_concern objection) | → `"who is the doctor\|who is the surgeon"` |
| `backend/src/services/ai.js` | `"Always be compassionate about dental anxiety"` | → `"medical anxiety — extremely common, especially for patients traveling for treatment"` |
| `backend/src/services/ai.js` | SCENARIO_CONTEXT: "dental treatment" / "dental issue" | → "medical treatment" / "medical issue" |
| `backend/src/services/ai.js` | tool schema örneği `"teeth whitening, implant consultation"` | → `"hair transplant consultation, initial assessment"` |
| `backend/src/services/ai.js` | Varsayılan saat dilimi `Europe/London` (×3 yer) | → `Europe/Istanbul` |
| `backend/src/services/leadScoring.js` | Sabit diş işlem puanları (implant=25, veneers=20, invisalign=18, whitening=8) | → branş-bağımsız `treatment_value_weight` (0-25), `leads.treatment_value_weight` kolonu (migration 055), yoksa nötr varsayılan 15 |
| `backend/src/services/leadScoring.js` | `"Analyze this dental clinic WhatsApp conversation"` | → `"healthcare clinic"` |
| `backend/src/services/leadScoring.js` | Tag `implant_serious` | → `treatment_serious` |
| `backend/src/routes/clinics.js` | Yeni klinik varsayılanı `country='GB', timezone='Europe/London'` | → `country='TR', timezone='Europe/Istanbul'` |
| `backend/src/routes/clinics.js` | `DEFAULT_PASSWORD = 'CareDental2026!'`, `admin@{slug}.caredental.ai` | → CareNova karşılıkları |
| Genelinde (34 dosya) | `£` sembolü hardcoded | → `€` (varsayılan EUR). **Not:** tam yapılandırılabilir `tenants.currency` altyapısı henüz kurulmadı — bkz. TODO altında. |
| `frontend/.../EditClinicModal.tsx`, `SettingsPage.tsx` | Varsayılan `Europe/London` | → `Europe/Istanbul` (seçenek listesinde Europe/London hâlâ mevcut, sadece varsayılan değişti) |
| `CareDentalIcons.tsx` (×2: kök + `frontend/src/components/icons/`) | Dosya adı ve iç yorumlar | → `CareNovaIcons.tsx`. İkonların içeriği zaten generic (WhatsApp, dil, itiraz tespiti vb.) — diş-spesifik görsel yoktu. |
| `frontend/src/components/landing/*` (11 dosya) | Tüm CareDental pazarlama bölümleri (Hero, Problem, Platform, Pricing, Testimonials, FAQ, Stats, Concierge, Differentiators, CTA, NavBar, Footer) | **Silindi.** `LandingPage.tsx` boş bir placeholder'a indirgendi. NavBar/Footer, About/Blog/Contact/Careers/legal sayfalarının çökmemesi için minimal, marka-nötr halleriyle yeniden oluşturuldu — PAKET 4'te tam tasarım gelecek. |
| `frontend/src/components/HeroSection.tsx` (kök, orphan) | Kullanılmayan eski dental hero taslağı | Silindi |
| Global (71 dosya) | `CareDental` / `caredental` / `CAREDENTAL` string'leri | → `CareNova` / `carenova` / `CARENOVA` (kod, yorum, migration, seed, route, config — CARENOVA-STRATEJI.md, CLAUDE-CODE-PROMPTS.md, GECE-*.md hariç, onlar referans belgesi) |
| `frontend/src/lib/businessDetails.ts` | CareDental'ın gerçek UK tüzel kişiliği (B4MIND Ltd, Londra adresi, Companies House/ICO alanları) | Tamamen boşaltıldı, `addressCountry: 'TR'`, alanlar `taxOrCompanyNumber`/`kvkkVerbisNumber`'a yeniden adlandırıldı (KVKK/MERSİS için yer tutucu). **Gerçek TR tüzel kişilik bilgisi yok — Baturay'ın kararı bekliyor, bkz. BLOKAJLAR.md değil çünkü build'i bloklamıyor (ALLOW_PLACEHOLDERS zaten script'te sabit).** |
| `frontend/src/lib/organizationSchema.ts` | UK Companies House/ICO şeması, `areaServed: United Kingdom`, CareDental'ın gerçek sosyal medya linkleri (`sameAs`) | → TR alan adları, `areaServed: Turkey`, `sameAs: []` (CareNova'nın henüz hesabı yok — CareDental hesaplarına point etmek yanlış olurdu) |
| `frontend/src/pages/ContactPage.tsx` | Companies House/ICO satırı, Londra ofis harita linki | → TR vergi/VERBİS alanları, ofis kartı gerçek adres gelene kadar mailto'ya düşüyor |
| Favicon/logo (`frontend/src/assets/`, `frontend/public/`) | CareDental mavi/lacivert wordmark SVG'leri + PNG ikonlar | Yeni CareNova SVG wordmark'ları (teal `#0E4F52` + amber `#D99A2B`, açık/koyu/transparan varyant) yazıldı. PNG/ICO ImageMagick ile SVG'den üretildi ama **metin glifleri render olmadı (sadece düz renkli kare)** — CLI font sorunu; SVG'ler tarayıcıda doğru görünüyor. Baturay gerçek logo ile değiştirene kadar kabul edilebilir yer tutucu. |
| `tailwind.config.js`, `index.css` | Sadece `navy`/`gold` (CareDental) renk skalası | `brand`/`accent`/`surface`/`ink` semantic token'ları eklendi (Bölüm 4 paleti), `navy`/`gold` **silinmedi** — bkz. TODO |
| `frontend/public/index.html` | `lang="en"`, `theme-color=#000000`, sadece Instrument Serif/DM Sans | `lang="tr"`, `theme-color=#0E4F52`, Fraunces + Hanken Grotesk Google Fonts eklendi (Instrument Serif/DM Sans dashboard için korundu) |

## Bilinçli olarak ERTELENEN (TODO)

- **`tenants.currency` kolonu / tam para birimi yapılandırması** — brief "£ → yapılandırılabilir, varsayılan EUR" diyor; bu gece sadece görünen sembol €'ya çevrildi (34 dosyada mekanik sed). Gerçek per-tenant currency altyapısı (migration + format helper + UI) kapsamı büyük, KOMUT'larda ayrıca ele alınmadı — ayrı bir iş paketi gerektirir.
- **`navy`/`gold` renk skalasının tamamen kaldırılması** — mevcut dashboard'un ~30 sayfası bu token'ları yoğun kullanıyor. Bu gece SADECE yeni `brand`/`accent`/`surface`/`ink` token'ları eklendi (landing + yeni UI için); mevcut dashboard'un komple yeniden temalandırılması kapsam dışı bırakıldı (riskli, çok dosyalı, bu gecenin önceliği değil).
- **`clinic_ai_settings.escalation_keywords` varsayılanı** (`urgent, pain, emergency, bleeding, swelling, broken`) zaten yeterince generic bulundu, değiştirilmedi.
- **`detectLanguage`'daki Türkçe anahtar kelime listesi** (`beyazlatma, ortodonti, dolgu, çekim, kaplama, gülüş` gibi diş-spesifik Türkçe kelimeler) dil TESPİTİ için kullanılıyor, davranış hatası yaratmıyor (sadece Türkçe sinyali olarak çalışıyor) — dokunulmadı, düşük öncelik.
- **PNG/ICO favicon glifleri** — yukarıda not edildi, gerçek logo tasarımı beklemede.

## Silinmedi çünkü zaten generic

- `clinic_knowledge` tablosu için statik dental seed verisi **bulunamadı** — tamamen tenant'ın kendi girdiği runtime veri, temizlenecek bir şey yoktu.

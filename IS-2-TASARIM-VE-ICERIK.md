# CareNova — İş Paketi 2: Tema, Admin Erişimi ve Landing İçeriği

**Bu belge Claude Code için yazılmıştır.** Üç işi kapsar:
1. Renk sisteminin "Klinik Beyazı" yönüne geçirilmesi (açık tema varsayılan)
2. `app.carenova.ai` admin erişiminin yapılandırılması
3. Landing sayfasının tam kapsamlı hale getirilmesi

Önce `CARENOVA-STRATEJI.md`'yi oku — tüm içerik kararlarının kaynağı orası.
`GECE-LOG.md` ve `BLOKAJLAR.md`'yi de oku, gece nerede kalındığını bil.

---

## BÖLÜM A — RENK SİSTEMİ: "Klinik Beyazı"

### A.0 Neden değişiyor

Mevcut palet (koyu petrol-teal `#0E4F52` + amber `#D99A2B`) onaylanmadı. Ayrıca kod
tabanında **iki ayrı renk sistemi** yan yana duruyor ve birbirini tutmuyor:
- Landing: `brand` (teal) + `accent` (amber), koyu zemin
- Dashboard: `navy-*` + `gold` (ki `gold.DEFAULT` aslında `#2563EB` — mavi)

Yeni yön: **tek, birleşik, açık tema varsayılan sistem.**

### A.1 İyi haber — işin yarısı zaten hazır

`frontend/src/index.css` içinde `[data-theme="light"]` bloğu zaten var ve `navy-*`
değişkenlerinin açık tema karşılıkları tanımlı (`#f8fafc`, `#ffffff`, `#f1f5f9`,
`#e2e8f0`, `#cbd5e1`). Bu tam olarak istediğimiz nötr skala. `gold` de zaten mavi.

Yani **tüm dashboard'u yeniden temalamana gerek yok** — açık temayı varsayılan yapıp
token değerlerini hizalamak yeterli.

### A.2 Yeni palet

```
─ Nötr (yüzeyler) ────────────────────────────────
--surface-0     #FFFFFF   kart, panel, modal, sidebar
--surface-1     #F6F8FA   sayfa zemini
--surface-2     #EDF1F5   input, tablo satırı, hover
--border        #DDE3EA   kenar, ayırıcı
--border-strong #C3CCD6   vurgulu kenar

─ Metin ──────────────────────────────────────────
--ink           #0B1F33   başlık, ana metin (derin lacivert)
--ink-muted     #5A6B7C   ikincil metin
--ink-subtle    #8A98A6   etiket, placeholder

─ Aksan ──────────────────────────────────────────
--accent        #1B6FEA   birincil aksiyon, link, vurgu
--accent-hover  #1559C4
--accent-soft   #E8F1FE   aksan zemin (rozet, seçili satır)

─ Semantik ───────────────────────────────────────
--success       #0EA47A   onay, tamamlandı
--success-soft  #E3F7F1
--warning       #C77A0A   bekliyor, dikkat
--warning-soft  #FDF3E3
--danger        #E0483B   hata, iptal, kırmızı bayrak
--danger-soft   #FDECEA

─ Koyu tema (opsiyonel, ikincil) ─────────────────
--surface-0     #0F1626
--surface-1     #070B14
--surface-2     #1A2437
--border        #24314A
--ink           #E8EDF5
--ink-muted     #94A3B8
--accent        #3B82F6
```

### A.3 Yapılacaklar

1. **`index.css`'i yeniden yaz.** Yukarıdaki paleti CSS değişkeni olarak tanımla.
   `:root` = **açık tema** (varsayılan artık bu). `[data-theme="dark"]` = koyu tema.
   Şu anda tam tersi — çevir.

2. **`tailwind.config.js`'i sadeleştir.** İki paralel sistemi TEK sisteme indir:
   ```js
   colors: {
     surface: { DEFAULT: 'rgb(var(--surface-0)/<alpha-value>)',
                page:    'rgb(var(--surface-1)/<alpha-value>)',
                sunken:  'rgb(var(--surface-2)/<alpha-value>)' },
     line:    { DEFAULT: 'rgb(var(--border)/<alpha-value>)',
                strong:  'rgb(var(--border-strong)/<alpha-value>)' },
     ink:     { DEFAULT: 'rgb(var(--ink)/<alpha-value>)',
                muted:   'rgb(var(--ink-muted)/<alpha-value>)',
                subtle:  'rgb(var(--ink-subtle)/<alpha-value>)' },
     accent:  { DEFAULT: 'rgb(var(--accent)/<alpha-value>)',
                hover:   'rgb(var(--accent-hover)/<alpha-value>)',
                soft:    'rgb(var(--accent-soft)/<alpha-value>)' },
     success: { ... }, warning: { ... }, danger: { ... },
   }
   ```
   `brand`, `navy` ve `gold` skalalarını **kaldır.**

3. **Eski token kullanımlarını taşı.** Codemod yaklaşımı:
   ```
   navy-950 → surface-page      navy-900 → surface
   navy-800 → surface-sunken    navy-700 → surface-sunken
   navy-600 → line              gold     → accent
   brand-*  → accent-* / ink    accent-* (amber) → accent (mavi)
   text-white → text-ink        text-gray-400 → text-ink-muted
   ```
   ⚠️ Mekanik `sed` yeterli değil — açık temada `text-white` okunmaz olur.
   Her dosyayı değiştirdikten sonra **görsel kontrol et.**

4. **Kontrast doğrula.** Tüm metin/zemin çiftleri WCAG AA (normal metin 4.5:1,
   büyük metin 3:1) geçmeli. `--ink-subtle` üzerine `--surface-2` en riskli çift,
   özellikle kontrol et. Bir kontrast hesaplama script'i yaz
   (`scripts/check-contrast.js`) ve sonucu `docs/contrast-report.md`'ye yaz.

5. **Tipografi.** Fraunces + Hanken Grotesk kalıyor ama açık temada Fraunces'in
   ağırlığını düşür (light zeminde koyu serif çok ağır durur):
   başlıklarda `font-weight: 400–500`, `letter-spacing: -0.02em`.

6. **Tema değiştirici.** `ThemeContext.tsx` zaten var. Varsayılanı `light` yap,
   kullanıcı tercihi localStorage'da kalsın, header'a bir toggle koy.

7. **Gölge ve derinlik.** Açık temada kartlar sınırla değil, yumuşak gölgeyle ayrışır:
   ```
   --shadow-sm: 0 1px 2px rgba(11,31,51,.06)
   --shadow-md: 0 4px 12px rgba(11,31,51,.08)
   --shadow-lg: 0 12px 32px rgba(11,31,51,.10)
   ```
   Koyu temada gölgeleri kapat, sınıra dön.

**Kabul kriteri:** Landing ve dashboard'un tamamı açık temada tutarlı görünüyor;
hiçbir ekranda okunmayan metin veya görünmez sınır yok; koyu temaya geçiş çalışıyor.

**Commit:** `refactor(theme): unify color system to light-first Clinical White palette`

---

## BÖLÜM B — `app.carenova.ai` ADMIN ERİŞİMİ

### B.1 Mevcut durum

`frontend/src/App.tsx` satır 42–47'de zaten hostname tabanlı yönlendirme var:
`REACT_APP_APP_URL` veya `REACT_APP_ADMIN_URL` ile eşleşen bir hostname'de
`/` otomatik `/login`'e gidiyor. Yani **kod hazır**, sadece yapılandırma eksik.

Şu an admin paneline erişim: canlı URL'in sonuna `/login` ekleyerek.
Demo modunda herhangi bir e-posta/şifre kabul ediliyor.

### B.2 Claude Code'un yapacakları

1. `frontend/.env.example`'a ekle (yorumla birlikte):
   ```
   REACT_APP_APP_URL=https://app.carenova.ai
   REACT_APP_ADMIN_URL=https://admin.carenova.ai
   ```
2. `App.tsx`'teki yönlendirme mantığını gözden geçir — `app.` ile başlayan
   herhangi bir hostname'de de çalışsın (env değişkeni set edilmemişse fallback):
   ```ts
   const isAppHost = hostname.startsWith('app.') || hostname.startsWith('admin.')
                     || (appHost && hostname === appHost)
                     || (adminHost && hostname === adminHost);
   ```
   Bu, env değişkeni unutulsa bile doğru davranmasını sağlar.
3. Login ekranına, demo modundayken görünür bir **"Demo Modu — herhangi bir e-posta
   ve şifreyle girebilirsiniz"** bilgi kutusu koy (varsa güçlendir).
4. `docs/domain-setup.md` yaz — B.3'teki adımları Baturay için belgelendir.

### B.3 Baturay'ın manuel yapacakları (Claude Code yapamaz)

`docs/domain-setup.md`'ye şunu yaz:

```
1. Vercel → carenova projesi → Settings → Domains → Add
   → app.carenova.ai  (Add butonuna bas)

2. Vercel bir DNS kaydı gösterecek. Domain sağlayıcında (carenova.ai'ın
   DNS'ini nerede yönetiyorsan) şu kaydı ekle:
      Tip:   CNAME
      Ad:    app
      Değer: cname.vercel-dns.com
   (Vercel farklı bir değer gösterirse onu kullan.)

3. Vercel → Settings → Environment Variables → Add:
      REACT_APP_APP_URL = https://app.carenova.ai
      Ortamlar: Production + Preview
   Not: CRA env değişkenleri BUILD sırasında gömülür — eklendikten sonra
   MUTLAKA yeniden deploy et, yoksa etkisi olmaz.

4. Deployments → en son deployment → ⋯ → Redeploy

5. DNS yayılması 5 dk – 1 saat sürebilir. Sonra app.carenova.ai açıldığında
   doğrudan giriş ekranına düşer.

⚠️ carenova.ai kök domaini şu an WordPress'te. Ona DOKUNMA — sadece app
   alt alan adını ekliyoruz. Kök domain geçişi ayrı bir karar.
```

---

## BÖLÜM C — LANDING SAYFASI: TAM KAPSAM

### C.0 Sorun tespiti

İçerik verisi (`data/landingContent.tsx`, 263 satır) fena değil — asıl sorun
**bileşenlerin yüzeysel olması.** Kanıt: 6 modülü render eden `PlatformSection`
32 satır, `ComplianceSection` 37, `Footer` 27 satır. Sonuç: emoji ikonlar, görsel
derinlik yok, çok fazla boşluk, "yarım kalmış" hissi.

### C.1 🔴 DÜRÜSTLÜK KURALLARI — istisnasız

CareNova'nın henüz müşterisi yok. Bu yüzden:

- ❌ **Sahte müşteri referansı, hasta yorumu, "X kliniği şunu dedi" YAZMA.**
  Ayrıca Tanıtım Yönetmeliği hasta yorumunu zaten yasaklıyor.
- ❌ **Sahte müşteri logosu bandı KOYMA.** ("500+ klinik güveniyor" gibi)
- ❌ **CareNova'nın kendi sonucuymuş gibi metrik gösterme.**
  "%40 dönüşüm artışı sağladık" YASAK — böyle bir veri yok.
- ✅ Sektör verisi göstermek **serbest ve doğru** — ama **kaynağıyla ve
  sektör verisi olduğu belirtilerek.** Örn:
  > "5 dakikada yanıtlanan lead 10 kat daha yüksek dönüşüyor.
  > *Kaynak: Peganom, sağlık turizmi sektör verisi, 2026*"
- ✅ Sosyal kanıt yerine **"Neye dayanıyoruz"** bandı koy: USHAŞ/TÜİK, Sağlık
  Bakanlığı yönetmelikleri, KVKK — verinin ve uyumun kaynaklarını göster.
  Bu, müşteri yokken güven kurmanın dürüst yolu ve marka konumuyla tutarlı.

### C.2 İkonlar

Tüm emoji ikonları (🌍 📋 🩺 ✅ ✈️ 📊 🛡️) kaldır. `lucide-react` **zaten kurulu** —
onu kullan. Tutarlı stroke genişliği (1.5), tutarlı boyut (20 veya 24), aksan renginde.

### C.3 Mevcut bölümlerin zenginleştirilmesi

| Bölüm | Ne eklenecek |
|---|---|
| **Hero** | Açık temaya uyarla. WhatsApp animasyonu açık zeminde gerçek WhatsApp gibi görünsün (yeşil balonlar, gri zemin). Dil döngüsü göstergesi daha belirgin. Altına ince bir "Neye dayanıyoruz" kaynak şeridi. |
| **Problem** | 3 stat kartının altına **görsel huni**: aynı ₺40.000 reklam bütçesi → yavaş ekip 1–2 hasta / hızlı ekip 15–20 hasta. İki kollu karşılaştırma grafiği (inline SVG, kütüphane kurma). Her sayının altına kaynak notu. |
| **Trust (3 yara)** | Şu an düz 3 satır. Her yarayı **kendi görsel bloğuna** çevir: solda hasta ifadesi (gerçek şikayet alıntısı üslubunda ama anonim ve genel), sağda CareNova'nın cevabı + mini ürün görseli (teklif kartı / doktor kartı / zaman çizelgesi). Sayfanın en iyi tasarlanan bölümü bu olsun. |
| **Platform** | 6 modül → lucide ikonlar, her karta 1 satır somut örnek. Örn. Vaka Dosyası altında: "Pasaport, uçuş, refakatçi, teklif, ödeme, 365 günlük takip — tek kayıtta." |
| **Mevzuat Kalkanı** | 4 madde kalsın ama her birine **somut yaptırım bilgisi** ekle: "Tanıtım Yönetmeliği ihlalinde uluslararası sağlık turizmi sağlayıcıları için 1–3 ay faaliyet durdurma." Bu bölüm korku değil, yetkinlik satmalı. |
| **Fiyatlandırma** | Kartlara "en çok tercih edilen" yerine **"Önerilen"** rozeti (müşteri yokken tercih iddiası yalan olur). ROI kancasını kartların altına büyük ve net yaz. |
| **SSS** | 8 soru iyi. Accordion'a düzgün animasyon, ilk soru açık başlasın. |
| **CTA** | Form alanlarına branş seçici ekle (strateji Bölüm 7/M2'deki branş listesi). Demo modunda submit → başarı ekranı. |

### C.4 Yeni bölümler

**1. Nasıl Çalışır (5 adım)** — Hero'dan hemen sonra, `#nasil-calisir`

Yatay/dikey adım akışı, her adımda ikon + başlık + 1-2 cümle:

| # | Başlık (TR / EN) | Metin |
|---|---|---|
| 1 | Hasta yazar / Patient messages | WhatsApp, Instagram DM veya reklam formundan gelen her mesaj tek gelen kutusuna düşer. Metin, ses notu ve fotoğraf — hepsi anlaşılır. |
| 2 | AI 5 saniyede karşılar / AI replies in 5 seconds | Hastanın dilini tanır, branşa özel ön değerlendirme sorularını sorar, gerekli fotoğrafları çekim talimatıyla ister. |
| 3 | Doktor onaylar / Doctor approves | Vaka doktor kuyruğuna düşer. Doktor uygunluk kararını ve fiyat bandını onaylamadan AI kesin fiyat veremez. |
| 4 | Kilitli teklif gider / Locked quote is issued | Kalem kalem, versiyonlu, süreli teklif — ameliyatı yapacak doktorun adıyla. Depozito linki içinde. |
| 5 | Bakım hattı devralır / Aftercare takes over | Hasta uçağa bindiği anda D+1'den D+365'e otomatik takip, fotoğraflı iyileşme kaydı, komplikasyon triyajı. |

**2. Branşlar ve AI Yetki Matrisi** — `#branslar`

Bu bölüm **dürüstlüğü satış argümanına çeviriyor** — rakiplerin hiçbiri
"AI'ımız burada fiyat veremez" demiyor. Tablo:

| Branş | Durum | AI yetkisi |
|---|---|---|
| Saç ekimi | Hazır şablon | Fotoğraftan fiyat aralığı · kesin fiyat doktor onayıyla |
| Diş | Hazır şablon | Aralık · implantta panoramik/CBCT olmadan fiyat yok |
| Estetik cerrahi | Hazır şablon | Sadece nitelendirme — anestezi uygunluğu doktor kararı |
| Göz (LASIK/SMILE) | Yapılandırılabilir | Ön eleme · kornea uygunluğu yerinde muayene ister |
| Obezite / bariatrik | Yapılandırılabilir | Sadece nitelendirme — BMI ve komorbidite taraması |
| Tüp bebek (IVF) | Yapılandırılabilir | Sadece nitelendirme — donör gamet Türkiye'de yasal değil, AI bunu ilk mesajda söyler |
| Ortopedi | Yapılandırılabilir | Görüntüleme incelemesi zorunlu |
| Kardiyoloji / Onkoloji | Yapılandırılabilir | Sadece lojistik ve randevu — satış çerçevesi kurmaz |
| Check-up | Hazır şablon | Uçtan uca — standart paket, rezervasyona kadar |

Başlık önerisi: *"AI'ın nerede fiyat veremeyeceğini de biliyoruz."*

**3. Karşılaştırma** — `#karsilastirma`

🔴 **Rakip markası İSİMLE YAZMA.** Kategori kullan — hem hukuken güvenli hem dürüst.

| | Genel klinik CRM | Çeviri tabanlı chatbot | Pazaryeri (komisyonlu) | **CareNova** |
|---|---|---|---|---|
| Hastanın dilinde doğal konuşma | Hayır | Kısmen (çeviri API) | Evet | **Evet (native LLM)** |
| Ses notu ve fotoğraf anlama | Hayır | Hayır | — | **Evet** |
| Branşa göre AI fiyat yetkisi | Hayır | Hayır | — | **Evet** |
| Doktor onay kuyruğu | Hayır | Hayır | Hayır | **Evet** |
| Kilitli, versiyonlu teklif | Hayır | Hayır | Hayır | **Evet** |
| Dönüş sonrası bakım hattı | Hayır | Hayır | Hayır | **Evet** |
| KVKK + Tanıtım Yönetmeliği koruyucusu | Hayır | Hayır | — | **Evet** |
| Hastanın kime ait olduğu | Klinik | Klinik | **Pazaryeri** | **Klinik** |
| Maliyet yapısı | Abonelik | Abonelik | İşlem başı komisyon | Abonelik |

Altına bir cümle: *"Pazaryerleri hasta getirir ama hastayı sahiplenir. CareNova
kendi kanalınızı kurmanız için var — pazaryerlerinden gelen lead'leri de içeri alır."*

**4. Bakım Hattı zaman çizelgesi** — `#bakim-hatti`

Yatay zaman çizelgesi (inline SVG veya CSS): D+1 · D+3 · D+7 · D+15 · D+30 · D+90 ·
D+180 · D+365. Her noktaya hover/tap → o gün ne olduğu.
Yanına gerçek bir örnek mesaj balonu (saç ekimi, D+7, Almanca).
Altına: *"Şikayetlerin en yoğun kümesi 'ödeme sonrası kayboldular'. Bu bölüm o
şikayetin panzehiri."*

**5. Kanal ROI örneği** — `#roi`

Örnek tablo (açıkça "örnek" etiketiyle, gerçek müşteri verisi değil):

| Kanal | Lead | CPL | Vaka | CAC | Komisyon | Net marj |
|---|---|---|---|---|---|---|
| Meta reklam | 220 | ₺380 | 18 | ₺4.644 | — | ... |
| Pazaryeri | 95 | ₺0 | 14 | ₺0 | %15 | ... |
| Instagram organik | 60 | ₺0 | 5 | ₺0 | — | ... |

Sayıları tutarlı ve gerçekçi doldur, tablonun üstüne **"Örnek panel görünümü"**
etiketi koy. Mesaj: *"Komisyonlu kanalın gerçek maliyetini ilk kez göreceksiniz."*

**6. Kurulum süreci** — `#kurulum`

7 adım (strateji M11), toplam süre vurgusu: **Klinik 45 dakika · Solo 15 dakika.**
Klinik bilgisi → branş seçimi → WhatsApp bağlama → doktor kartları →
bilgi bankası (şablondan ön dolu) → fiyat bandı ve AI yetki onayı →
KVKK/Ek-1 metinleri → test sohbeti → canlıya al.
Vurgu: *"Numaranız değişmiyor. Teknik ekip gerekmiyor."*

**7. Genişletilmiş footer**

4 kolon: **Ürün** (modül linkleri) · **Branşlar** · **Kurumsal** (Hakkımızda,
İletişim, Blog) · **Yasal** (Gizlilik, Koşullar, KVKK Aydınlatma, Çerezler).
Altında: kısa şirket tanımı, dil değiştirici, telif satırı.

⚠️ `frontend/src/lib/businessDetails.ts` **bilerek boş** (CareNova'nın TR tüzel
kişiliği henüz yok). Footer'da şirket unvanı, adres, vergi no gibi alanları
**uydurma** — dosya boşken o alanları render etme. `BLOKAJLAR.md`'ye
"tüzel kişilik bilgileri bekleniyor" notu düş.

### C.5 Bölüm sırası (final)

```
Nav → Hero → Nasıl Çalışır → Problem → Üç Güven Yarası → Platform →
Branşlar & Yetki Matrisi → Bakım Hattı → Karşılaştırma → Kanal ROI →
Mevzuat Kalkanı → Kurulum → Fiyatlandırma → SSS → CTA → Footer
```
Nav linklerini bu yapıya göre güncelle (5–6 link, hepsini koyma):
Nasıl Çalışır · Platform · Branşlar · Fiyatlandırma · SSS

### C.6 Teknik standartlar

- Tüm yeni içerik `data/landingContent.tsx`'e, **TR ve EN olarak birlikte**
- Görseller: harici kütüphane KURMA. Inline SVG + CSS + Framer Motion (kurulu)
- Scroll-reveal animasyonları, `prefers-reduced-motion` desteği zorunlu
- Mobil: 360px genişlikte test et, tablolar `overflow-x: auto` içinde
- Erişilebilirlik: `<section>` + `aria-labelledby`, focus state'leri görünür,
  accordion'da `aria-expanded`, tablolarda `<th scope>`
- Performans: Lighthouse'da Performance ve Accessibility **≥ 90** hedefle
- SEO: her bölüm için doğru başlık hiyerarşisi (tek `<h1>`), `SEOMeta` güncelle,
  TR/EN için `hreflang`, FAQ bölümüne `FAQPage` JSON-LD şeması

**Commit'ler:** bölüm bazında ayrı ayrı, `feat(landing): ...` formatında.

---

## SIRA VE KABUL

1. **Bölüm A** (tema) — önce bu, çünkü landing'i açık temada tasarlayacaksın
2. **Bölüm B** (admin erişimi) — küçük, hızlı
3. **Bölüm C** (landing) — en büyük parça, bölüm bölüm commit et

Her adımdan sonra `npm run build` temiz olmalı ve push et (Vercel otomatik deploy eder).
İş bitince `GECE-LOG.md`'ye yeni bir bölüm ekle: ne yapıldı, hangi kararlar verildi,
neler eksik kaldı.

**Son kontrol listesi:**
- [ ] Açık temada hiçbir ekranda okunmayan metin yok (kontrast raporu üretildi)
- [ ] Emoji ikon kalmadı, hepsi lucide-react
- [ ] Sahte referans / sahte logo / sahte metrik yok
- [ ] Sektör verisi kaynağıyla birlikte gösteriliyor
- [ ] Rakip markası isimle geçmiyor
- [ ] TR ve EN'de tüm bölümler tam
- [ ] Mobilde 360px'te bozulma yok
- [ ] `app.carenova.ai` yapılandırması ve `docs/domain-setup.md` hazır

# CareNova — Gece Çalışması 2: Çok-Host Mimarisi ve Admin Panelleri

**Gözetimsiz çalışma brifingi.** Baturay uyuyor, soru soramazsın.
Belirsizlikte: **durma, en makul kararı ver, `GECE-LOG.md`'ye gerekçesiyle yaz, devam et.**

---

## 0. ÖNCE OKU

Çalışma klasörü: `/Users/baturayozden/projects/CareNova`

1. `CARENOVA-STRATEJI.md` — ürünün anayasası. Özellikle **Bölüm 7 (modüller)**,
   **M2 (branş şablonları + AI yetki matrisi)**, **M3 (doktor onay kuyruğu)**,
   **M7 (mevzuat kalkanı)**, **M8 (roller)**.
2. `GECE-LOG.md` + `BLOKAJLAR.md` — nerede kalındı.
3. `CLAUDE.md` — proje kuralları.

Referans kod: `/Users/baturayozden/projects/caredental` — **SALT OKUNUR.**
Admin/panel mantığı için oradan öğren, ama körü körüne kopyalama: CareDental'ın
admin'i çok ince (`backend/src/routes/admin.js` sadece platform-users yönetiyor).
CareNova'nın admin ihtiyacı çok daha geniş — Bölüm C'de tanımlı.

---

## 1. MUTLAK YASAKLAR

| # | Yasak |
|---|---|
| 1 | `caredental` klasöründe hiçbir dosyayı değiştirme/silme. Sadece OKU. |
| 2 | `carenova.ai`, `caredental.ai` DNS/domain ayarlarına dokunma |
| 3 | Vercel'de yeni proje oluşturma. Deploy = `git push`, başka yol yok. |
| 4 | `.env` veya gerçek anahtar commit etme |
| 5 | Gerçek API çağrısı yapma (Anthropic, Meta, ödeme) — hepsi mock/demo |
| 6 | Backend'i deploy etme — bu gece sadece frontend, demo modunda |
| 7 | Prod veritabanına yazma |
| 8 | `git push --force`, `git reset --hard` (commit'lenmemiş iş varken) |
| 9 | Sahte müşteri referansı/logo/metrik üretme |
| 10 | Aynı hatayı 3 kez deneme — 3'ten sonra BIRAK, `BLOKAJLAR.md`'ye yaz, devam et |

🔴 **11. OTOMASYON TARAYICISIYLA GÖRSEL DOĞRULAMA YAPMA.**
Ölçüldü: bu ortamda `requestAnimationFrame` tamamen askıda (1 saniyede sıfır tick,
çağrı 45 sn'de zaman aşımı). Framer Motion animasyonları başlamıyor, sayfa BOŞ
görünüyor. **Bu bir hata değil, ölçüm artefaktı.** Ekran görüntüsüne bakıp
"içerik görünmüyor" deme, düzeltmeye kalkma.
✅ Buna karşılık `getComputedStyle` tabanlı ölçüm GÜVENİLİR — kontrast, renk,
font, boyut, layout bu yolla doğrulanabilir. Görsel teyit gerekiyorsa
`BLOKAJLAR.md`'ye "Baturay'ın gözüyle bakması gerekiyor" diye yaz.

---

## 2. ÖNCEDEN VERİLMİŞ KARARLAR

- Mimari: CareDental fork'u, React+TS (CRA) frontend, Node+Express backend
- Bu gece **her şey demo modunda** (`REACT_APP_DEMO_MODE=true`), gerçek backend yok
- Deploy: `git push` → Vercel otomatik. Proje: `carenova`, tek proje, çok host.
- Arayüz varsayılan dili **Türkçe**, tüm yeni string i18n üzerinden
- Kod/commit/yorum İngilizce; `GECE-LOG.md` ve `BLOKAJLAR.md` Türkçe
- Renk sistemi: Klinik Beyazı (açık tema varsayılan) — değiştirme
- Yeni ekranlarda emoji ikon YOK, `lucide-react` kullan (kurulu)

---

## BÖLÜM A — NAV: LOGO VE GİRİŞ BUTONU 🔴 (~45 dk)

### A.1 Logo boyutu

**Sorun:** CareNova nav'ında logo metin wordmark ve çok küçük:
`<Link className="font-display text-xl text-ink">Care<span className="text-accent">Nova</span></Link>`

CareDental referansı (`caredental/frontend/src/components/landing/NavBar.tsx:59`):
```jsx
<img src={logoSrc} alt="CareDental AI" className="h-9 w-auto transition-opacity duration-300" />
```
Yani **36px yükseklikte SVG görsel**, tema/scroll durumuna göre açık/koyu varyant.

**YAP:**
1. `frontend/src/assets/` altında CareNova SVG wordmark'ları oluştur (veya mevcutları düzelt):
   `carenova-logo-light.svg` (açık zeminde koyu metin) ve
   `carenova-logo-dark.svg` (koyu zeminde açık metin), ayrıca `favicon.svg`.
   Tipografi: Fraunces/display ailesi, "Care" ink renginde + "Nova" accent (#1B6FEA).
   SVG'de metni **path'e çevir** ki font yüklenmese de doğru görünsün.
   ViewBox oranı ~4:1, yani h-9'da genişlik ~144px olsun.
2. NavBar'daki metin wordmark'ı `<img className="h-9 w-auto">` ile değiştir.
   Tema ve scroll durumuna göre varyant seçimini CareDental'daki mantıkla kur.
3. Mobil menüde ve footer'da da aynı logoyu tutarlı kullan (footer'da `h-7` uygun).
4. `alt="CareNova"` ver.
5. **Doğrula:** `getComputedStyle` ile logo `<img>`'in render yüksekliğinin
   36px olduğunu ölç, `GECE-LOG.md`'ye yaz.

### A.2 Nav'a Giriş butonu

Sağ üstte şu an sadece "Demo Talep Et" var. **Yanına "Giriş" ekle.**

Hiyerarşi: Giriş = ikincil (ghost/outline), Demo Talep Et = birincil (dolu accent).
Sıralama: `[TR|EN] [Giriş] [Demo Talep Et]`

```jsx
<a href={APP_LOGIN_URL}
   className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold
              text-ink hover:bg-surface-sunken transition-colors">
  {t('nav.login')}   {/* TR: "Giriş" · EN: "Log in" */}
</a>
```

`APP_LOGIN_URL` sabit yazılmayacak — `frontend/src/config/hosts.ts`'den gelecek (Bölüm B):
- marketing host'unda → app host'unun `/login` adresine tam URL
- app/admin host'unda → nav zaten görünmez (landing yok)

Mobil menüye de ekle. i18n anahtarları: `nav.login`, `nav.requestDemo`.

**Commit:** `feat(nav): add CareNova logo image at CareDental scale and a Log in action`

---

## BÖLÜM B — ÜÇ-HOST MİMARİSİ 🔴 (~2 sa)

### B.1 Hedef

Tek Vercel projesi, üç mod:

| Mod | Üretim domaini | Test URL'i | Ne yapar |
|---|---|---|---|
| `marketing` | carenova.ai | carenova-two.vercel.app | Landing, blog, yasal sayfalar |
| `app` | app.carenova.ai | carenova-app.vercel.app | **Klinik kullanıcıları** girer |
| `admin` | admin.carenova.ai | carenova-admin.vercel.app | **Süper admin** girer |

### B.2 Host çözümleme modülü

`frontend/src/config/hosts.ts` oluştur — tek doğruluk kaynağı:

```ts
export type HostMode = 'marketing' | 'app' | 'admin';

export function resolveHostMode(): HostMode {
  // 1) Açık env eşleşmesi (üretim)
  //    REACT_APP_APP_URL, REACT_APP_ADMIN_URL, REACT_APP_MARKETING_URL
  // 2) Hostname öneki (env unutulursa güvenli fallback)
  //    admin. → admin ; app. → app
  // 3) Vercel test URL'leri: carenova-admin* → admin ; carenova-app* → app
  // 4) SADECE demo modunda: ?host=app|admin|marketing query parametresi
  //    (localStorage'a yazılsın ki gezinirken kaybolmasın; ?host=reset temizlesin)
  // 5) Varsayılan: marketing
}

export const hostUrls = { marketing: string, app: string, admin: string };
// Env'den okur; env yoksa mevcut origin + ?host= fallback üretir ki
// domainler eklenmeden önce de test edilebilsin.
```

🔴 **4. maddedeki query override YALNIZCA `REACT_APP_DEMO_MODE === 'true'` iken
çalışacak.** Üretimde hostname dışında hiçbir şey mod belirleyemez.

### B.3 Route ağacını üçe ayır

`App.tsx`'i mod bazlı **ayrı route ağaçlarına** böl — koşullu link gizleme DEĞİL,
gerçekten ayrı ağaçlar:

```
marketing → /  /blog  /blog/:slug  /about  /contact  /careers
             /legal/*  /payment-*  → 404 fallback landing'e
app       → /login  /forgot-password  /reset-password
             /  → /dashboard'a yönlendir
             ProtectedRoute + AppLayout altında klinik ekranları (Bölüm D)
admin     → /login  (ayrı, admin görünümlü)
             /  → /admin/overview'a yönlendir
             ProtectedRoute + AdminLayout altında admin ekranları (Bölüm C)
```

🔴 **Güvenlik kuralları — hem UI'da hem route seviyesinde zorla:**
1. `admin` modunda **sadece** `super_admin` / platform rolleri girebilir.
   Klinik rolüyle giriş denenirse: oturum açılmaz, net bir mesaj gösterilir
   ("Bu panel platform yöneticileri içindir. Klinik hesabınızla app.carenova.ai
   adresinden giriş yapın." + o adrese link). Admin arayüzü **hiçbir koşulda**
   render edilmez.
2. `app` modunda klinik rolleri girer. Süper admin app host'una girerse:
   sadece **impersonation** akışıyla (Bölüm C.10), normal kullanıcı gibi değil.
3. Admin route'ları `app` bundle'ında **hiç mount edilmesin** — lazy import ile
   mod bazlı yükle (`React.lazy`), böylece admin ekranları app host'unda
   indirilmez bile.
4. `ConsentBanner` sadece marketing modunda.
5. Her modun kendi `<title>` ve favicon'u olsun:
   marketing "CareNova", app "CareNova | Klinik Paneli", admin "CareNova | Platform".

### B.4 Test URL'lerini kullanılabilir yap

Claude Code Vercel'e domain ekleyemez (panel erişimi yok). Bu yüzden:

1. **Kod tarafı hazır olsun** — B.2'deki 3. madde `carenova-app.vercel.app` ve
   `carenova-admin.vercel.app` hostname'lerini zaten tanısın.
2. **Domain eklenene kadar** `?host=app` / `?host=admin` ile test edilebilsin.
3. `docs/host-setup.md` yaz — Baturay'ın yapacakları:

```
Vercel → carenova projesi → Settings → Domains → Add:
  carenova-app.vercel.app
  carenova-admin.vercel.app
(Bunlar *.vercel.app alt alanları, DNS gerektirmez, müsaitse anında bağlanır.
 İsim alınmışsa carenova-app-tr.vercel.app gibi bir varyant dene ve bana bildir.)

Settings → Environment Variables (Production + Preview):
  REACT_APP_MARKETING_URL = https://carenova-two.vercel.app
  REACT_APP_APP_URL       = https://carenova-app.vercel.app
  REACT_APP_ADMIN_URL     = https://carenova-admin.vercel.app
  REACT_APP_DEMO_MODE     = true

Sonra Deployments → son deployment → ⋯ → Redeploy
(CRA env'leri build sırasında gömülür, redeploy şart.)

ÜRETİME GEÇERKEN bu değerler app.carenova.ai / admin.carenova.ai olacak;
DNS adımları docs/domain-setup.md'de.
```

4. `GECE-LOG.md`'nin en üstüne **üç test linkini** yaz:
   - Landing: `https://carenova-two.vercel.app`
   - Klinik paneli: `https://carenova-two.vercel.app/?host=app` (domain eklenince `carenova-app.vercel.app`)
   - Admin: `https://carenova-two.vercel.app/?host=admin` (domain eklenince `carenova-admin.vercel.app`)

**Commit:** `feat(routing): three-host architecture with marketing/app/admin route trees`

---

## BÖLÜM C — SÜPER ADMIN KONSOLU 🔴 (~4 sa)

`admin.carenova.ai` — platform yöneticisi (Baturay) için. CareDental'ın admin'i
sadece kullanıcı yönetiyor; CareNova'nın ihtiyacı çok daha geniş.

**Tasarım dili:** yoğun bilgi, tablo ağırlıklı, hızlı tarama. Landing'in cömert
boşluğunu buraya taşıma. Sol sidebar + üst breadcrumb + içerik. Açık tema.

**Veri:** hepsi demo modunda `frontend/src/data/adminDemoData.ts`'ten.
**Gerçekçi Türkiye sağlık turizmi verisi üret** — 8-12 klinik, farklı şehirler
(İstanbul, Antalya, İzmir, Ankara), farklı branşlar, farklı planlar, farklı
onboarding aşamaları. İsimler jenerik-gerçekçi olsun ("Nova Hair Clinic",
"Ege Estetik", "Anadolu Dental") — **gerçek klinik adı kullanma.**

### C.1 Genel Bakış (`/admin/overview`)
KPI kartları: aktif klinik, bu ay yeni klinik, toplam vaka, aktif WhatsApp hattı,
bu ay AI konuşması, MRR (demo), ortalama ilk yanıt süresi.
Altında: son 30 gün trend (inline SVG sparkline, kütüphane kurma), dikkat gerektirenler
listesi (kotası dolmak üzere olan klinik, onboarding'de takılan, ödemesi geciken).

### C.2 Klinikler (`/admin/clinics`)
Tablo: ad, şehir, branşlar, plan, durum, kullanıcı sayısı, aktif vaka, son aktivite.
Filtre: durum, plan, branş, şehir. Arama. Sıralama.
Satır → detay sayfası `/admin/clinics/:id`:
- Künye: unvan, yetki belgesi no, iletişim, saat dilimi, para birimi
- Sekmeler: Genel · Kullanıcılar · WhatsApp · AI Kullanım · Faturalama · Uyum · Denetim
- Aksiyonlar: onayla, askıya al, plan değiştir, kota ekle, **klinik olarak görüntüle**
  (impersonation — C.10)

### C.3 Onboarding Takibi (`/admin/onboarding`)
7 adımlı huni (strateji M11): klinik bilgisi → branş → WhatsApp → doktor kartları →
bilgi bankası → fiyat/yetki onayı → KVKK metinleri → test → canlı.
Her kliniğin hangi adımda olduğu, adımda geçen süre, takılanlar kırmızı.
Hedef metriği görünsün: klinik 45 dk, solo 15 dk.

### C.4 WhatsApp Hatları (`/admin/whatsapp`)
Tablo: klinik, görünen numara, `phone_number_id`, bağlantı durumu, webhook son
başarı zamanı, son 24s mesaj sayısı, hata sayısı.
Sorunlu hatlar üstte. Her satırda "webhook testi" butonu (demo modunda mock sonuç).

### C.5 AI Kullanım ve Kota (`/admin/ai-usage`)
Klinik bazında: plan kotası, kullanılan konuşma, aşım, tahmini token maliyeti,
aşım politikası (`block` / `allow`). Kota dolmak üzere olanlar uyarı rengiyle.
Toplam platform maliyeti kartı.

### C.6 Branş Şablonları (`/admin/branches`) — CareNova'ya özel, önemli
Sistem şablonlarını yönet (migration 056-058'de seed edilenler).
Liste: branş, durum (hazır/yapılandırılabilir), **AI fiyat yetkisi**, kaç klinik kullanıyor.
Detay: ön-değerlendirme soruları, gerekli görseller ve çekim talimatları (5 dil),
kırmızı bayraklar, branş itirazları, bakım hattı takvimi.
🔴 **AI yetki matrisi burada değiştirilebilir olmalı ama değişiklik
`ai_pricing_authority` enum'unun dışına çıkamamalı** — dropdown, serbest metin değil.
IVF şablonunda donör gamet kuralının görünür ve silinemez olduğundan emin ol.

### C.7 Uyum Paneli (`/admin/compliance`) — CareNova'ya özel, en farklılaştırıcı
Klinik bazında uyum durumu tablosu:
- Uluslararası Sağlık Turizmi Yetki Belgesi: var/yok, geçerlilik tarihi, kalan gün
- **Komplikasyon sigortası: 31.12.2026 son tarih** — geri sayım, yaklaşanlar uyarı rengiyle
- VERBİS kaydı: var/yok
- %20 yabancı dil personel oranı: mevcut oran
- Ek-1 görsel onamı: toplam onam, geri alınan, onamsız görsel var mı (varsa kırmızı)
- Yurt dışı aktarım standart sözleşmesi: KVKK'ya bildirildi mi, tarih
Üstte platform geneli özet: kaç klinik tam uyumlu, kaçında eksik var.
Her satır → o kliniğin uyum detayına gider.

### C.8 Demo Talepleri (`/admin/demo-requests`)
Landing formundan gelenler: ad, e-posta, klinik, şehir, **branş**, telefon, tarih, durum
(yeni/iletişime geçildi/demo yapıldı/kazanıldı/kaybedildi). Not alanı. CSV dışa aktar.
CareDental'daki `DemoRequestsPage` mantığını referans al, branş alanını ekle.

### C.9 Faturalama (`/admin/billing`)
Abonelikler: klinik, plan, dönem, tutar, para birimi, durum, sonraki tahsilat.
Gecikenler üstte. Basit MRR/ARR özeti. Demo verisiyle.

### C.10 Kullanıcılar, Roller ve Impersonation (`/admin/users`)
Platform kullanıcıları (süper admin) + klinik kullanıcıları ayrı sekmelerde.
Rol atama. CareNova rolleri (strateji M8):
`klinik_sahibi · operasyon_muduru · hasta_danismani · doktor · koordinator · tercuman · muhasebe`

🔴 **Impersonation ("klinik olarak görüntüle"):**
- Sadece `super_admin` başlatabilir
- Başlarken **gerekçe girilmesi zorunlu**
- Aktifken ekranın üstünde **sürekli görünür turuncu bir şerit**:
  "X kliniği olarak görüntülüyorsunuz — [Çık]"
- Denetim kaydına yazılır: kim, hangi klinik, ne zaman başladı/bitti, gerekçe
- Impersonation sırasında **yazma işlemleri engellenir** (salt okunur) —
  bu bir destek aracı, müdahale aracı değil

### C.11 Denetim Kaydı (`/admin/audit`)
Append-only olay akışı: kim, ne zaman, hangi klinik, ne yaptı.
Filtre: klinik, kullanıcı, olay tipi, tarih aralığı. CSV dışa aktar.
KVKK açısından kritik — silinemez olduğunu UI'da belirt.

### C.12 Platform Sağlığı (`/admin/health`)
Webhook başarı oranı, ortalama ilk yanıt süresi (platform geneli), AI hata oranı,
son hatalar listesi. Demo verisiyle, ama yapı gerçek metriklere bağlanmaya hazır.

**Commit'ler:** her modül ayrı — `feat(admin): clinics list and detail`, vb.

---

## BÖLÜM D — KLİNİK PANELİ 🟡 (~3 sa)

`app.carenova.ai` — klinik kullanıcıları. Şu an nav'da "Yakında" placeholder'ları var.
Bu gece **en farklılaştırıcı iki ekranı** gerçekten yap, gerisi dürüst placeholder kalsın.

### D.1 Panel (`/dashboard`)
Rol bazlı. Kartlar: bugün gelen mesaj, yanıt bekleyen, doktor onayı bekleyen,
depozito bekleyen teklif, bugünkü program, bakım hattı yanıt bekleyenler.
Ortalama ilk yanıt süresi (kliniğin kendi metriği) — ürünün ana vaadi bu, öne çıkar.

### D.2 Vakalar (`/cases`, `/cases/:id`) 🔴
**CareNova'nın merkezi kavramı.** Migration 056-058'deki `cases` şemasına birebir uy.

Liste: vaka no, hasta, ülke/dil (bayrak), branş, durum, atanan danışman/doktor,
tahmini değer, son aktivite. Filtre: durum, branş, ülke, atanan, tarih.
Durum enum'u tam olarak şemadaki gibi:
`new · qualified · pre_assessment · awaiting_doctor · quoted · awaiting_deposit ·
reserved · travel_planned · arrived · treated · returned · in_aftercare · completed ·
lost · medically_ineligible`

Detay sayfası sekmeleri:
- **Özet** — hasta künyesi, refakatçi, durum zaman çizelgesi
- **Sohbet** — WhatsApp konuşması, hastanın dilinde + Türkçe çeviri yan yana;
  ses notu varsa oynatıcı + transkript; fotoğraflar galeri
- **Tıbbi dosya** — ön-değerlendirme yanıtları, yüklenen görseller, doktor kararı
- **Teklif** — versiyonlar, kilitli teklif kartı, değişiklik gerekçeleri
- **Seyahat** — uçuş, otel, transfer, tercüman, gün gün program
- **Bakım hattı** — D+1…D+365 temas noktaları, yanıtlar, fotoğraflı iyileşme
- **Denetim** — bu vakada ne olmuş

### D.3 Doktor Onay Kuyruğu (`/doctor-queue`) 🔴 — mobil öncelikli
Strateji M3.2. Doktor rolünün varsayılan açılış sayfası.
Kart: hasta ülkesi/yaşı, branş, yüklenen görseller (galeri), AI'ın yapılandırdığı
ön-veri özeti, ön-değerlendirme yanıtları, kırmızı bayrak uyarıları, bekleme süresi.
Aksiyon: **uygun / şartlı / uygun değil** + not + onaylanan kapsam (greft sayısı,
implant sayısı) + onaylanan fiyat bandı.
🔴 Onay olmadan teklif üretilemeyeceğini UI'da açıkça göster.
🔴 AI'ın görsel çıkarımı (Norwood tahmini vb.) **sadece burada** görünür,
hastaya giden hiçbir yüzeyde değil.

### D.4 Diğer ekranlar
Sohbetler, Teklifler, Seyahat, Bakım Hattı, Hastalar, Raporlar, Ayarlar →
şimdilik **dürüst "Yakında" ekranı** kalsın ama boş sayfa değil: o modülün ne
yapacağını anlatan kısa bir açıklama + strateji belgesindeki modül adı olsun.
Sahte veriyle doldurup çalışıyormuş gibi gösterme.

### D.5 Demo veri
`frontend/src/data/demoData.ts`'i genişlet. Mevcut 4 vaka korunsun, üstüne
ekle: farklı durumlarda 12-15 vaka, 5 doktor, 4 danışman, 3 tercüman,
gerçekçi WhatsApp konuşmaları (DE/AR/EN/RU/TR), 6 teklif (farklı versiyonlarda),
8 bakım hattı temas noktası.

**Commit'ler:** ekran bazında ayrı.

---

## BÖLÜM E — BACKEND: PAKET 6'NIN KALANI ⚪ (~2 sa, vakit kalırsa)

Migration'lar yazıldı ama uygulama katmanı yok. Sırayla:
1. `backend/src/services/caseStore.js` — genişlet: case CRUD, media, assessment, timeline
2. `backend/src/routes/cases.js` — liste/detay/durum güncelleme, tenant scoping zorunlu
3. `backend/src/routes/branchTemplates.js` — şablon CRUD (sadece super_admin sistem şablonlarını değiştirebilir)
4. `backend/src/routes/adminPlatform.js` — Bölüm C'nin ihtiyaç duyduğu okuma uçları
5. Her uçta **tenant izolasyonu testi** yaz: bir tenant başkasının vakasını GÖREMEMELİ

⚠️ DB yok, migration çalıştıramazsın. Kodu yaz, birim testleri yaz,
`BLOKAJLAR.md`'ye "DB'ye karşı doğrulanmadı" notu düş, devam et.

---

## BÖLÜM F — DEVREDEN İŞ ⚪ (~30 dk)

Önceki turdan kalan, henüz yapılmadıysa:

1. `.surface-inverted` içinde `--accent` çevrilmemiş. Ölçüldü (canlı site,
   hesaplanmış stil): `#compliance` "Regulatory Shield" etiketi ve `#pricing`
   "Recommended" rozeti — `rgb(46,110,224)` üzerine `rgb(15,22,38)` = **3.80:1**,
   11-12px punto, gereken 4.5:1. Koyu zeminde accent'in açık varyantı olmalı.
2. `docs/contrast-report.md`'deki 35 bulgu **35 ayrı hata değil, iki token ailesi**:
   `--ink-subtle` altyazılar ve accent-on-accent-soft rozetler. Bu iki token
   değerini en küçük kullanıldıkları puntoda 4.5:1 verecek şekilde koyulaştır,
   sonra raporu yeniden çalıştır ve kaç bulgunun kendiliğinden kapandığını say.
   Kalan gerçek artıkları tek tek ele al.
3. Yeni palet değerlerini `CLAUDE.md` ve `CARENOVA-STRATEJI.md`'ye işle.

---

## 3. SIRA VE ZAMAN BÜTÇESİ

| Sıra | Bölüm | Öncelik | Süre |
|---|---|---|---|
| 1 | A — Nav (logo + giriş) | 🔴 | 45 dk |
| 2 | B — Üç-host mimarisi | 🔴 | 2 sa |
| 3 | F — Devreden kontrast | ⚪ | 30 dk |
| 4 | C — Süper admin konsolu | 🔴 | 4 sa |
| 5 | D — Klinik paneli | 🟡 | 3 sa |
| 6 | E — Backend | ⚪ | 2 sa |
| 7 | Kapanış | 🔴 | 40 dk |

**A ve B bitmeden C'ye geçme** — admin konsolu host mimarisi olmadan test edilemez.
**Duracağın zamandan 40 dk önce kapanışa geç.** Bu adımı asla atlama.

---

## 4. HER BÖLÜM SONUNDA

1. `cd frontend && npm run build` temiz mi?
2. Yeni kullanıcıya görünen string'ler i18n üzerinden mi? (TR+EN ikisi de dolu mu)
3. Yeni endpoint eklediysen tenant scoping var mı?
4. Admin route'ları app bundle'ında mount olmuyor mu?
5. Emoji ikon kalmadı mı? (lucide-react)
6. Sahte referans/logo/metrik yok mu?
7. `.env` veya anahtar commit'lendi mi? (olmamalı)
8. Commit atıldı, push edildi, `GECE-LOG.md` güncellendi mi?

**Doğrulama yöntemi:** `getComputedStyle` ölçümü ve birim testi kullan.
Ekran görüntüsüyle görsel doğrulama YAPMA (yasak #11).

---

## 5. KAPANIŞ 🔴 (40 dk)

1. `npm run build` temiz, `npm test` sonucu raporlanmış
2. Her şey commit'li ve push'lu, uncommitted dosya yok
3. `GECE-LOG.md`'nin **en üstüne** sabah raporu:

```markdown
# SABAH RAPORU — 2026-09-07

## 🔗 Test linkleri
- Landing: ...
- Klinik paneli: ...  (?host=app ile veya domain eklendiyse gerçek URL)
- Admin konsolu: ... (?host=admin ile veya domain eklendiyse gerçek URL)

## ⚠️ Baturay'ın yapması gerekenler (öncelik sırasıyla)
1. Vercel'de iki domain ekle + env değişkenleri + redeploy (docs/host-setup.md)
2. ...

## ✅ Tamamlananlar
## ⏸️ Yarım kalanlar
## 🚧 Blokajlar
## 🤔 Verdiğim önemli kararlar (ve neden)
## 👁️ Görsel teyit bekleyenler
   (otomasyonla doğrulayamadığım, Baturay'ın gözüyle bakması gereken ekranlar)
## ▶️ Sıradaki 3 adım
## ⏱️ Süre
```

4. `BLOKAJLAR.md` güncel

**Doğrulayamadığın hiçbir şey için "doğruladım" deme.** Neyi doğrulayamadığını yaz.

Başla.

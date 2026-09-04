# CareNova — Gece Çalışma Brifingi

**Bu belge Claude Code'un gözetimsiz (unattended) çalışması için yazılmıştır.**
Baturay uyuyor. Sana soru soramaz. Bu yüzden bu belgede tüm kararlar önceden verilmiştir.
Bir şey belirsizse: **durma, en makul kararı ver, `GECE-LOG.md`'ye gerekçesiyle yaz, devam et.**

---

## 1. GÖREV

Sabaha kadar CareNova'yı çalışır hale getir ve **`*.vercel.app` uzantılı canlı bir linkte yayınla.**

Sabah Baturay şunu görmek istiyor:
1. **Tıklanabilir canlı bir URL** — CareNova landing sayfası, Türkçe ve İngilizce
2. Aynı URL'den girilebilen, **demo verisiyle gezilebilen bir yönetim paneli**
3. `GECE-LOG.md` — ne yapıldığı, hangi kararların neden verildiği
4. `BLOKAJLAR.md` — takıldığın ve onun müdahalesi gereken her şey
5. Temiz git geçmişi — her iş paketi ayrı commit

**En kritik kural: canlı URL en geç 3. iş paketinde çıkmalı.** Gece yarısı bir şey ters giderse bile sabah bakılacak bir link olsun. Sonra her paket sonunda yeniden deploy et.

---

## 2. BAĞLAM — önce bunları oku

Çalışma klasörün: `/Users/baturayozden/projects/CareNova`

Bu klasörde iki belge var. **Kod yazmadan önce ikisini de baştan sona oku:**

- **`CARENOVA-STRATEJI.md`** — ürünün ne olduğu, pazar analizi, tüm modüller (Bölüm 7),
  CareDental'dan neyin taşınıp neyin değişeceği (Bölüm 8), fiyatlandırma (Bölüm 10).
  Bu belge ürünün anayasasıdır. Bir tasarım kararı vereceksen önce buraya bak.
- **`CLAUDE-CODE-PROMPTS.md`** — 16 adımlık detaylı yapım komutları.
  Bu gece bunların bir kısmını uygulayacaksın (aşağıda hangileri yazıyor).

Referans kaynak kod: `/Users/baturayozden/projects/caredental`
Bu, CareNova'nın fork'lanacağı çalışan CareDental kod tabanı (~47.000 satır).

---

## 3. YAPMAYACAKLARIN — mutlak yasaklar

Bunlar gözetimsiz çalışmanın güvenlik sınırlarıdır. İhlal etme.

| # | Yasak | Neden |
|---|---|---|
| 1 | **`caredental` klasöründe HİÇBİR dosyayı değiştirme, silme veya taşıma** | Canlı, gelir üreten bir ürün. Sadece OKU. Kopyala, dokunma. |
| 2 | `carenova.ai` veya `caredental.ai` DNS/domain ayarlarına dokunma | Production domain'e geçiş Baturay'ın kararı |
| 3 | carenova.ai'daki mevcut WordPress sitesine dokunma | Şu an canlı, kesme planı yapılmadı |
| 4 | CareDental'ın Vercel/Render/Supabase projelerine dokunma | Yanlış projeye deploy = production kesintisi |
| 5 | Gerçek `.env` dosyasını git'e commit etme | Sadece `.env.example` commit edilir |
| 6 | `caredental/backend/.env` içindeki gerçek anahtarları CareNova'ya kopyalama | Aynı WhatsApp hattı/DB paylaşılmamalı |
| 7 | Herhangi bir production veritabanına yazma | Demo modu kullan (Paket 5) |
| 8 | `git push --force`, `git reset --hard` (commit'lenmemiş iş varken) | Geri dönülemez |
| 9 | Ücretli servis satın alma, plan yükseltme, kredi kartı kullanma | — |
| 10 | Anthropic/OpenAI/Meta API'lerine gerçek çağrı yapma | Anahtar yok, maliyet üretme. Mock kullan. |
| 11 | Sonsuz döngüye girme — aynı hatayı 3 kez denedin ve olmuyorsa BIRAK | Gece boyu tek hataya takılma |

---

## 4. ÖNCEDEN VERİLMİŞ KARARLAR — bunları sorgulama, uygula

Gözetimsiz çalışıyorsun, o yüzden aşağıdaki kararlar senin adına verildi:

**Mimari**
- Kod tabanı: CareDental fork'u. Sıfırdan Next.js yazma.
- Backend: Node + Express (CommonJS), mevcut yapı korunur
- Frontend: React + TypeScript (CRA), mevcut yapı korunur
- Bu gece Next.js'e migrasyon YAPILMAYACAK — ayrı bir karar

**Deploy**
- Hedef: Vercel, **frontend'i** deploy et. Root directory: `frontend`
- Backend bu gece deploy EDİLMEYECEK (secret'lar yok). Demo modu ile çalış.
- Production domain'e bağlama YOK. Sadece `*.vercel.app` preview/production URL'i.

**Marka ve tasarım**
- Renk paleti (strateji belgesi Bölüm 8 / KOMUT 2):
  - Ana (brand): derin petrol/teal — `#0E4F52` ailesi
  - Aksan (accent): sıcak amber — `#D99A2B` ailesi
  - Açık zemin (surface): kemik beyazı — `#F7F4EF`
  - Koyu zemin: `#0A1A1C`
  - Metin (ink): `#12211F` açık temada, `#F2EFE9` koyu temada
- Tipografi: başlıklar için serif (Fraunces veya benzeri), gövde için grotesk
  (Hanken Grotesk / Inter). Google Fonts kullanabilirsin.
- Tailwind'de **semantic token** tanımla (`brand`, `accent`, `surface`, `ink`, `muted`).
  Hardcoded hex kullanma.
- Logo: geçici bir SVG wordmark üret (metin tabanlı, "CareNova"). Baturay sonra değiştirecek.

**Dil**
- Arayüz varsayılan dili **TÜRKÇE**. İngilizce ikinci dil.
- Kod, değişken adları, commit mesajları, yorum satırları **İngilizce**.
- `GECE-LOG.md` ve `BLOKAJLAR.md` **Türkçe** (Baturay okuyacak).

**Kapsam**
- Bu gece **AI'ın gerçek çağrı yapması beklenmiyor.** Prompt derleyicisini yaz,
  testlerini yaz, ama gerçek Anthropic çağrısı yapma — mock'la.

---

## 5. İŞ PAKETLERİ

Sırayla git. Her paketin sonunda: **commit at + `GECE-LOG.md`'yi güncelle.**

Öncelik seviyeleri:
- 🔴 **ZORUNLU** — bunlar bitmeden diğerlerine geçme
- 🟡 **ÖNEMLİ** — vakit varsa mutlaka
- ⚪ **BONUS** — sadece her şey bittiyse

---

### PAKET 0 — Hazırlık 🔴 (~20 dk)

1. `CARENOVA-STRATEJI.md` ve `CLAUDE-CODE-PROMPTS.md`'yi tamamen oku.
2. `caredental` klasörünün yapısını incele (değiştirme, sadece oku):
   - `backend/src/` — routes, services, migrations, middleware
   - `frontend/src/` — pages, components, context, lib
   - `backend/.env.example` — hangi env değişkenleri var
3. CareNova klasöründe şu iki dosyayı oluştur ve boyunca güncel tut:

**`GECE-LOG.md`** formatı:
```markdown
# CareNova Gece Çalışma Logu — 2026-09-04/05

## Özet
(sabah en üstte okunacak 5 satır)

## Canlı URL
(deploy edildiğinde buraya yaz)

---
## [HH:MM] PAKET N — Başlık
**Yapıldı:** ...
**Karar:** ... çünkü ...
**Not:** ...
**Commit:** <hash> <mesaj>
```

**`BLOKAJLAR.md`** formatı:
```markdown
# Blokajlar — Baturay'ın müdahalesi gerekiyor

## B1 — [Başlık]
**Ne oldu:** ...
**Ne denedim:** ...
**Ne gerekiyor:** (tam olarak ne yapması gerektiği, adım adım)
**Etkisi:** (bu çözülmeden ne yapılamıyor)
**Aciliyet:** yüksek / orta / düşük
```

4. Ortam kontrolü yap ve loga yaz: `node -v`, `npm -v`, `git --version`,
   `gh auth status`, `npx vercel --version`. Vercel CLI yoksa `npm i -g vercel` ile kur.

---

### PAKET 1 — Fork, temizlik, marka 🔴 (~2 sa)

**1.1 Kopyalama**
`caredental` içeriğini `CareNova`'ya kopyala. **Hariç tut:**
`.git`, `node_modules`, `.vercel`, `.playwright-mcp`, `.codex`, `.DS_Store`,
`caredental-handoff-*.md`, `caredental-marketing-handoff*.md`, `Marketing/`,
`patient-profile-tasarim-v2.md`, `docs/` (CareDental'a özel), `.env`, `.env.production`

`.env.example` dosyalarını KOPYALA (şablon olarak lazım).
Mevcut `CARENOVA-STRATEJI.md` ve `CLAUDE-CODE-PROMPTS.md` dosyalarının üzerine YAZMA.

**1.2 Git — ⚠️ UZAK REPO ZATEN VAR**

Baturay GitHub'da **`baturayozden/carenova`** reposunu kendisi oluşturdu ve Vercel'e
bağladı. Lokal klasör ise henüz git reposu DEĞİL. Bağlantıyı sen kuracaksın:

```
cd /Users/baturayozden/projects/CareNova
git init
git branch -M main
git remote add origin https://github.com/baturayozden/carenova.git
```

`.gitignore`'u kontrol et — şunlar mutlaka olmalı:
`.env`, `.env.*`, `!.env.example`, `node_modules`, `build`, `.vercel`, `.DS_Store`

İlk commit: `chore: fork CareDental codebase as CareNova baseline`

**Push ederken:** uzak repo boş olmayabilir (README ile oluşturulmuş olabilir).
Reddedilirse şu sırayla dene:
```
git pull --rebase origin main
git push -u origin main
```
Rebase çakışırsa (README çakışması gibi) uzaktakini kabul et, birleştir, devam et.
Son çare: `git pull origin main --allow-unrelated-histories`
🔴 `git push --force` KULLANMA.

**1.3 Diş-spesifik envanter ve temizlik**
`CLAUDE-CODE-PROMPTS.md` KOMUT 1'i uygula ama **bu sefer envanteri çıkarıp DURMA — uygula.**
`docs/dental-cleanup-inventory.md`'ye ne yaptığını yaz, sonra temizliği gerçekleştir:

- `backend/src/services/ai.js` — sistem prompt'undaki diş terminolojisini generic
  "sağlık kuruluşu asistanı" diline çevir. `DENTAL EXPERTISE` bloğunu tamamen kaldır
  (Paket 7'de branş şablonundan gelecek).
- `backend/src/services/leadScoring.js` — diş işlem değerlerini (implant=25, veneers=20…)
  kaldır, yerine branş-bağımsız `treatment_value_weight` parametresi koy.
- `clinic_ai_settings` escalation_keywords varsayılanını genelleştir
- `clinic_knowledge` seed verilerindeki diş içeriğini temizle
- Para birimi varsayımı: `£` → yapılandırılabilir (`tenants.currency`, varsayılan `EUR`)
- Varsayılan saat dilimi: `Europe/London` → `Europe/Istanbul`
- `CareDentalIcons.tsx` → `CareNovaIcons.tsx`, diş ikonlarını generic sağlık ikonlarıyla değiştir

**1.4 Marka**
- Tüm `CareDental` string'lerini `CareNova` yap (kod, yorum, meta, package.json, README)
- `frontend/src/assets/` altındaki logoları CareNova SVG wordmark'larıyla değiştir
  (açık/koyu/transparan varyantlar + favicon)
- `tailwind.config.js`'de semantic renk token'larını tanımla (Bölüm 4'teki palet)
- Google Fonts'u `index.html`'e ekle
- `frontend/src/components/landing/` altındaki TÜM bölümleri **sil**
  (Paket 4'te CareNova için yeniden yazılacak). Yerine geçici boş bir `LandingPage` koy.
- Kök `CLAUDE.md`'yi CareNova için sıfırdan yaz:
  ürün tanımı, workspace yapısı, komutlar, mimari, ve şu 4 zorunlu kural:
  1. Diş hekimliğine özel hiçbir varsayım kalmamalı
  2. Arayüz varsayılan dili Türkçe; kullanıcıya görünen her string i18n üzerinden
  3. AI yetki matrisi kuralı (branşa göre AI fiyat verebilir/veremez) asla bypass edilmez
  4. Hasta verisi hiçbir koşulda model eğitiminde kullanılmaz
- `README.md`'yi CareNova için yeniden yaz

**Kabul kriteri:** `cd frontend && npm install && npm run build` HATASIZ çalışıyor.
Bu geçmeden Paket 2'ye geçme. Build hatası varsa çöz.

**Commit:** `chore: rebrand to CareNova and strip dental-specific assumptions`

---

### PAKET 2 — İLK DEPLOY 🔴 (~45 dk) ← EN KRİTİK MİLESTONE

**Amaç: sabaha bakılacak canlı bir link olsun. Ne olursa olsun bu paketi bitir.**

**2.1 Vercel yapılandırması — 🔴 KÖK DİZİN SHIM'İ ZORUNLU**

Vercel projesi import edilirken repo boştu, bu yüzden **Root Directory `./` olarak kaldı**
(`frontend` klasörü o an mevcut değildi, seçilemedi). Framework Preset: Create React App.

Bu demek ki Vercel build'i **repo kökünde** çalıştıracak — ama kökte `package.json` yok,
`backend/` ve `frontend/` var. Baturay'ın sabah ayar değiştirmesini beklemeden çalışması için
**kök dizine bir shim koy.**

**Kökte `package.json` oluştur:**
```json
{
  "name": "carenova",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "build": "cd frontend && npm install --legacy-peer-deps && npm run build",
    "vercel-build": "npm run build"
  }
}
```

**Kökte `vercel.json` oluştur:**
```json
{
  "buildCommand": "npm run build",
  "installCommand": "echo skip-root-install",
  "outputDirectory": "frontend/build",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Ayrıca `frontend/vercel.json` de oluştur** — Baturay ileride Root Directory'yi
`frontend` yaparsa o zaman bu devreye girer:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": "create-react-app",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

⚠️ **Kritik kontroller:**
1. `frontend/package.json`'daki build script'i `node scripts/generate-sitemap.js && react-scripts build`.
   `generate-sitemap.js` Vercel ortamında patlarsa TÜM build çöker. Hata yutacak şekilde
   düzelt — sitemap üretilemezse uyarı bas, build'i durdurma (`process.exit(0)`).
2. CRA build'i uyarıları hata sayar (`CI=true` ortamında). Vercel'de `CI` set edilir.
   Build uyarı yüzünden çökerse `frontend/.env` yerine kök `vercel.json`'a
   `"build": { "env": { "CI": "false" } }` ekle veya build script'inde `CI=false` ver.
3. **Kök `package.json`'ı yerelde test et:** `npm run build` çalıştır, `frontend/build/`
   klasörünün oluştuğunu doğrula. Bu geçmeden push etme.

📌 **Not:** Proje adı Vercel'de `carenova` veya `care-nova` olabilir. URL'i tahmin etme —
push sonrası gerçek URL'i doğrula (bkz. 2.4). İkisini de dene.

**2.2 🔴 EN ÖNEMLİ — Vercel projesi ZATEN OLUŞTURULDU**

Baturay `carenova` projesini Vercel'de kendisi oluşturdu ve GitHub reposuna
**Git entegrasyonu** ile bağladı. Yani:

- ✅ **Deploy etmek için tek yapman gereken `git push`.** Vercel otomatik build alır.
- 🔴 **`vercel` CLI ile YENİ PROJE OLUŞTURMA.** `vercel link`, `vercel deploy`,
  `vercel --prod` çalıştırma. İkinci bir `carenova-1` projesi yaratırsın, karışıklık olur.
- CLI'yi sadece **okuma** için kullanabilirsin (`vercel ls`, `vercel inspect`) —
  giriş yapılmışsa. Yapılmamışsa hiç uğraşma, gerek yok.

**Deploy akışın bu kadar basit:**
```
git add -A
git commit -m "..."
git push
```
Sonra deployment'ın durumunu kontrol et (`gh` varsa):
```
gh api repos/baturayozden/carenova/deployments --jq '.[0]' 2>/dev/null
```
veya build loglarına erişemiyorsan sadece push'un başarılı olduğunu doğrula ve devam et.

**Bilinen proje ayarları:**
- Vercel Team: **Baturay Ozden's projects (Hobby)** — kişisel hesap.
  CareDental farklı bir takımda, o yüzden çakışma riski yok.
- Project Name: `carenova` (veya `care-nova`)
- Framework Preset: **Create React App** ✅ ayarlandı
- Root Directory: **`./`** ⚠️ — `frontend` seçilemedi çünkü import anında repo boştu.
  Bu yüzden 2.1'deki **kök shim'i zorunlu.**
- Environment Variable: `REACT_APP_DEMO_MODE=true` ✅ eklendi

İlk deployment (senden önce yapılan) **başarısız** — repo boştu, normal.
Senin push'un ilk gerçek build'i tetikleyecek.

Build yine başarısız olursa: **3 kez dene, olmuyorsa BIRAK.** Logları oku,
`BLOKAJLAR.md`'ye tam hata mesajıyla yaz, koda devam et. Aşağıdaki hazır çözümü öner:

> **B0 — Vercel build başarısız (aciliyet: yüksek, 30 saniye)**
> Kök shim çalışmadıysa en temiz çözüm ayarı değiştirmek:
> vercel.com → carenova → Settings → Build and Deployment → Root Directory: `frontend` → Save
> Sonra Deployments → en son deployment → ⋯ → Redeploy
> (Bu yapılırsa kökteki `package.json` ve `vercel.json` shim'leri silinebilir.)
> Hata mesajı: [buraya tam log]

**2.2b ⚠️ CareDental projesine dokunma**

Baturay'ın Vercel hesabında **zaten bir `caredental` projesi var** ve bir **takım (team)**
altında duruyor:
```
orgId    : team_71vQmAg7t8fDpd93BteWyHY3
project  : caredental
rootDir  : frontend
```
🔴 **`caredental` projesine ASLA deploy etme.** Canlı, gelir üreten bir ürün.
Yeni ve ayrı bir proje oluştur: adı **`carenova`**.

Deploy öncesi mutlaka doğrula:
- `vercel whoami` → hangi hesap
- `vercel teams ls` → hangi takımlar var, aktif scope hangisi
- Link kurduktan sonra `cat .vercel/project.json` → `"name"` alanı **`carenova`** olmalı.
  `caredental` yazıyorsa **DERHAL DUR**, `.vercel` klasörünü sil, `BLOKAJLAR.md`'ye yaz.

**2.3 Deploy et**

```
cd /Users/baturayozden/projects/CareNova
git add -A
git commit -m "chore: add Vercel deployment config"
git push
```

Vercel otomatik build alır. Beklenen URL formatı: `https://carenova-<hash>.vercel.app`
veya `https://carenova.vercel.app`.

**2.4 Doğrulama — gerçek URL'i BUL, tahmin etme**

Push'tan sonra Vercel'in build alması 1–3 dakika sürer. Bekle, sonra sırayla dene:
```
sleep 120
curl -sI https://carenova.vercel.app        | head -1
curl -sI https://care-nova.vercel.app       | head -1
```
`gh` varsa gerçek deployment URL'ini oradan al:
```
gh api repos/baturayozden/carenova/deployments --jq '.[0].id' 2>/dev/null
```
`vercel` CLI'de giriş varsa en kesin yol:
```
vercel ls carenova 2>/dev/null || vercel ls 2>/dev/null | head -20
```

200 veya 3xx dönen URL'i bul. **Sadece HTTP kodu yetmez — içeriği de kontrol et:**
```
curl -s https://<bulduğun-url> | grep -io "carenova" | head -1
```
Boş dönerse build eski/başarısız demektir.

Hiçbiri çalışmıyorsa B0'ı `BLOKAJLAR.md`'ye yaz ve **devam et, bekleme.**

Bulduğun URL'i `GECE-LOG.md`'nin en üstüne yaz ve her deploy sonrası doğrula.
Bu andan sonra **her paket sonunda commit + push et** — deploy kendiliğinden olur.

**Commit:** `chore: add Vercel deployment config`

---

### PAKET 3 — i18n altyapısı (TR/EN) 🔴 (~1,5 sa)

`CLAUDE-CODE-PROMPTS.md` KOMUT 4'ü uygula.

- `react-i18next` + `i18next-browser-languagedetector` kur
- `frontend/src/i18n/locales/tr/*.json` ve `en/*.json`, namespace'ler:
  `common`, `auth`, `nav`, `landing`, `cases`, `patients`, `settings`, `billing`
- Dil tespiti: localStorage → tarayıcı → **`tr` fallback**
- `frontend/src/utils/format.ts` — `Intl` tabanlı tarih/saat/sayı/para yardımcıları.
  Mevcut `utils/date.ts`'i buna göre güncelle.
- Header'a dil değiştirici (TR / EN) koy
- `Layout`, `Sidebar`, `LoginPage`'i i18n'e geçir (örnek olarak)
- ESLint kuralı ekle: JSX içinde hardcoded string uyarısı

**Karar:** Mevcut tüm dashboard ekranlarını bu gece çevirme — çok uzun sürer.
Sadece altyapı + landing + navigasyon + login. Kalanı `TODO-i18n.md`'ye listele.

**Commit:** `feat: add TR/EN i18n infrastructure with Turkish as default`

**→ Yeniden deploy et.**

---

### PAKET 4 — Landing sayfası 🔴 (~2,5 sa) ← Sabah görülecek şey bu

`CARENOVA-STRATEJI.md` şu bölümleri temel al:
- Bölüm 3.3 (kayıp hesabı huni) — problem bölümü için
- Bölüm 4.3 (hastanın istediği 5 şey) — çözüm bölümü için
- Bölüm 6.2 (konumlandırma ifadesi) — hero için
- Bölüm 7 (modüller) — platform bölümü için
- Bölüm 10 (fiyat tablosu) — fiyatlandırma bölümü için

**Bölümler (sırayla):**

1. **Nav** — logo, Platform / Özellikler / Fiyatlandırma / SSS, dil değiştirici, "Demo Talep Et" CTA
2. **Hero**
   - Başlık: konumlandırma ifadesinden türet. Türkçe ana, İngilizce çeviri.
     Öneri: *"Gelen her hastaya 5 saniyede, kendi dilinde cevap verin."*
     Alt başlık: fiyatı kilitleyen, doktoru isimle taahhüt eden, hasta eve döndükten
     sonra bir yıl peşini bırakmayan AI platformu.
   - Görsel: WhatsApp sohbet animasyonu. **5 dilde döngü: TR → EN → AR → DE → RU.**
     Arapça için RTL doğru olsun. CareDental'ın eski HeroSection'ındaki animasyon
     mantığını referans alabilirsin (`caredental/frontend/src/components/landing/HeroSection.tsx`)
     ama kopyala-yapıştır yapma — CareNova için yeniden yaz, sağlık turizmi senaryosu kullan
     (saç ekimi randevusu soran Alman hasta gibi).
   - Framer Motion zaten kurulu, kullan.
3. **Problem** — kayıp hesabı. Üç kart:
   - "Lead başına ₺150–900 ödüyorsunuz" → "%85–95'i kayboluyor"
   - "1 saatte cevaplanan lead 7 kat, 5 dakikada cevaplanan 10 kat dönüşüyor"
   - "Eğitimli ekip %15–20, eğitimsiz ekip %1–2 dönüşüm yapıyor"
   Altında görsel huni: aynı reklam bütçesi → 1-2 hasta vs 15-20 hasta
4. **Üç güven yarası ve cevabı** — bu bölüm ürünün kalbi, en iyi tasarlanan bölüm olsun:
   | Yara | CareNova cevabı |
   |---|---|
   | "Beni kim ameliyat edecek?" | **Doktor Kimlik Kartı** — ameliyatı yapacak doktor isimle, tescil numarasıyla, videoyla |
   | "Fiyat gelince değişti" | **Kilitli Teklif** — versiyonlu, hash'li, süreli, kalem kalem |
   | "Ödeme sonrası kayboldular" | **Bakım Hattı** — D+1'den D+365'e otomatik takip, komplikasyon triyajı |
5. **Platform** — modül kartları: Çok dilli AI ajanı (ses notu + fotoğraf anlama),
   Vaka Dosyası, Branş Şablonları, Doktor Onay Kuyruğu, Seyahat Konsiyerj, Kanal ROI panosu
6. **Mevzuat Kalkanı** — ayrı bölüm, satış argümanı olarak:
   KVKK uyumu, Tanıtım Yönetmeliği koruyucusu, Ek-1 onam yönetimi,
   2025 Sağlık Turizmi Yönetmeliği paneli
7. **Fiyatlandırma** — Solo €149 / Klinik €449 / Grup €1.190 (yıllık ödeme),
   aylık/yıllık toggle. ⚠️ **Bunlar kliniğe satılan YAZILIM fiyatı** — sayfada
   bunu netleştiren bir not koy, hasta tedavi fiyatı sanılmasın.
8. **SSS** — en az 8 soru. Öneriler: WhatsApp numaramı değiştirmem gerekiyor mu?
   AI robot gibi mi konuşuyor? Hasta verim güvende mi (KVKK)? Kurulum ne kadar sürer?
   Hangi branşlarda çalışıyor? AI yanlış fiyat verirse ne olur? Ekibim işini kaybeder mi?
   Mevcut CRM'imle entegre olur mu?
9. **CTA / Demo talep formu** — ad, e-posta, klinik adı, şehir, branş, telefon (ops.)
   Demo modunda submit → başarı ekranı göster, backend'e gitme.
10. **Footer** — linkler, KVKK/gizlilik, iletişim

**Tasarım standardı:** Bu Baturay'ın sabah göreceği tek şey. Özensiz olmasın.
Koyu tema ana. Cömert boşluk. Framer Motion ile scroll-reveal. Mobil uyumlu.
Erişilebilirlik: kontrast oranları, focus state'leri, `prefers-reduced-motion` desteği.

**Kabul kriteri:** TR ve EN'de sayfa tam çalışıyor, mobilde bozulmuyor, build temiz.

**Commit:** `feat: build CareNova landing page (TR/EN)`

**→ Yeniden deploy et. URL'i `GECE-LOG.md`'ye güncelle.**

---

### PAKET 5 — Demo modu + gezilebilir panel 🟡 (~2 sa)

Backend deploy edilmedi, ama panelin gezilebilir olması lazım.

1. `REACT_APP_DEMO_MODE` ortam değişkeni ekle (Vercel'de `true`)
2. `frontend/src/lib/api.ts`'e mock adaptör katmanı ekle:
   demo modunda HTTP çağrısı yapmaz, `frontend/src/data/demoData.ts`'ten
   gerçekçi seed veri döner (gecikme simülasyonu ile, 200-400ms)
3. `frontend/src/data/demoData.ts` — **gerçekçi Türkiye sağlık turizmi verisi:**
   - 4 vaka: Alman saç ekimi hastası (Norwood 4, fotoğraflar yüklü, doktor onayı bekliyor),
     Iraklı diş hastası (panoramik bekleniyor), İngiliz estetik hastası (teklif verildi,
     depozito bekliyor), Rus göz hastası (bakım hattında, D+30)
   - Her vaka için gerçekçi WhatsApp konuşma geçmişi (kendi dillerinde + Türkçe çeviri)
   - 3 doktor kartı, 2 hasta danışmanı, seed teklif, seed program
   - Dashboard metrikleri: ilk yanıt süresi, dönüşüm hunisi, kanal ROI
4. Demo modunda login: herhangi bir e-posta/şifre kabul edilsin, demo kullanıcı olarak girsin.
   Login ekranında görünür bir "Demo Modu" rozeti olsun.
5. Sidebar'ı CareNova navigasyonuna güncelle:
   Panel · Vakalar · Sohbetler · Doktor Onayı · Teklifler · Seyahat · Bakım Hattı ·
   Hastalar · Raporlar · Ayarlar
   (Henüz yazılmamış sayfalar için "Yakında" placeholder'ı göster, 404 verme)

**Commit:** `feat: add demo mode with seeded Turkish health tourism data`

**→ Yeniden deploy et.**

---

### PAKET 6 — Vaka Dosyası modeli + branş şablon motoru 🟡 (~2 sa)

`CLAUDE-CODE-PROMPTS.md` KOMUT 5 ve KOMUT 6'yı uygula.

- `cases` ve ilgili tabloların migration'larını yaz (054'ten devam)
- `case_companions`, `case_media`, `case_assessments`, `case_timeline`, `case_events`
- `branch_templates` tablosu + 3 sistem şablonu seed'i
  (hair_transplant, dental, aesthetic_surgery) — **AI yetki matrisine birebir uy**
- Diğer 7 branş için iskelet kayıt
- IVF şablonuna donör gamet yasağı kuralını yaz
- `leads.language` CHECK constraint'ini genişlet
- Rollback yollarını yaz

⚠️ **Veritabanı yoksa migration'ları çalıştıramazsın.** O zaman:
migration dosyalarını yaz, SQL sözdizimini `psql --dry-run` benzeri bir yolla veya
lokal bir postgres/docker ile doğrula. Doğrulayamıyorsan `BLOKAJLAR.md`'ye yaz,
migration'ları commit et, devam et. **Blokaj yüzünden durma.**

**Commit:** `feat: add case file model and branch template engine`

---

### PAKET 7 — AI prompt derleyici + yetki matrisi 🟡 (~1,5 sa)

`CLAUDE-CODE-PROMPTS.md` KOMUT 7'yi uygula.

- `buildSystemPrompt`'u katmanlı derleyiciye dönüştür
- `ai_pricing_authority` enum'una göre zorlayıcı kural enjeksiyonu:
  `full` / `range_from_photo` / `range_after_imaging` / `qualification_only` / `logistics_only`
- Mevzuat kalkanı için yer tutucu fonksiyon (`services/complianceGuard.js`, iskelet)
- Çok saat dilimli tarih referansı (klinik TZ + hasta TZ)
- **Unit test yaz:** her yetki seviyesinde doğru kuralın prompt'a girdiğini doğrula.
  `qualification_only`'de fiyat verme yasağının prompt'ta olduğunu test et.
- **Gerçek Anthropic çağrısı YAPMA.** Prompt üretimini test et, çağrıyı mock'la.

**Commit:** `feat: layered AI prompt compiler with branch pricing authority matrix`

---

### PAKET 8 — Kullanıcıları PostgreSQL'e taşı ⚪ (~1 sa)

`CLAUDE-CODE-PROMPTS.md` KOMUT 3'ü uygula. Sadece Paket 7 bittiyse başla.

Bu güvenlik açısından kritik ama gözetimsiz yapılması riskli. **Yaklaşım:**
kodu yaz, testleri yaz, ama migration'ı çalıştırma. Sabah Baturay gözden geçirsin.
`BLOKAJLAR.md`'ye "Paket 8 kodu yazıldı, gözden geçirme bekliyor" notu düş.

**Commit:** `refactor: move users and refresh tokens to PostgreSQL (needs review)`

---

### PAKET 9 — Kapanış 🔴 (~40 dk) ← Bunu MUTLAKA yap

Ne kadar ilerlemiş olursan ol, **duracağın zamandan 40 dakika önce buraya geç.**

1. `npm run build` frontend'de hatasız çalışıyor mu — doğrula
2. Backend'de `npm test` — geçen/kalan testleri raporla
3. Son bir kez deploy et, URL'in canlı olduğunu `curl -I` ile doğrula
4. Tüm değişiklikleri commit et, hiçbir şey uncommitted kalmasın
5. `gh` varsa GitHub'a push et
6. **`GECE-LOG.md`'nin en üstüne SABAH RAPORU yaz:**

```markdown
# SABAH RAPORU

## 🔗 Canlı URL
https://______.vercel.app

## ✅ Tamamlanan paketler
- Paket 0-N: ...

## ⏸️ Yarım kalanlar
- ...

## 🚧 Blokajlar (BLOKAJLAR.md'de detay)
- B1: ... (aciliyet: yüksek)

## 🤔 Verdiğim önemli kararlar
- ... çünkü ...

## ▶️ Sıradaki 3 adım
1. ...
2. ...
3. ...

## ⏱️ Süre
Başlangıç: HH:MM · Bitiş: HH:MM
```

---

## 6. ÇALIŞMA DİSİPLİNİ

**Her paket sonunda bu 6 kontrolü yap ve loga yaz:**
1. `cd frontend && npm run build` temiz mi?
2. Diş hekimliğine özel yeni bir varsayım sızdı mı?
3. Kullanıcıya görünen yeni string'ler i18n üzerinden mi geçiyor?
4. Yeni endpoint eklediysen tenant scoping var mı?
5. `.env` veya gerçek anahtar commit'lendi mi? (olmamalı)
6. Commit atıldı mı, log güncellendi mi?

**Takıldığında protokol:**
1. Hatayı oku, en makul çözümü dene
2. Olmadıysa alternatif yaklaşım dene
3. O da olmadıysa **DUR.** `BLOKAJLAR.md`'ye yaz, o parçayı atla, sıradaki işe geç.
4. **Aynı şeyi üçüncü kez deneme.** Gece boyunca tek hataya harcanan saat, tamamlanmamış
   üç paket demektir.

**Commit disiplini:**
- Her paket en az bir commit
- Mesaj formatı: `feat:` / `fix:` / `chore:` / `refactor:` / `docs:` + kısa İngilizce açıklama
- Commit mesajlarının sonuna şunları ekle:
```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

**Zaman yönetimi:**
Paket 0→2 en geç ilk 3 saatte bitmeli (canlı URL çıkmalı).
Paket 3→5 sonraki 5 saat.
Paket 6→8 kalan zamanda.
Paket 9 için 40 dakika ayır ve bunu asla atlama.

---

## 7. BAŞLARKEN

Şu sırayla başla:
1. İki strateji belgesini oku
2. `GECE-LOG.md` ve `BLOKAJLAR.md`'yi oluştur
3. Ortam kontrolü yap, loga yaz
4. Paket 1'e başla

Ve **canlı URL'i geciktirme.** Sabah Baturay'ın tıklayacağı bir link olmalı.

Başla.

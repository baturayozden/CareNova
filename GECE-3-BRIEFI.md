# CareNova — Gece Çalışması 3

**Gözetimsiz brifing.** Baturay uyuyor. Belirsizlikte: durma, karar ver,
`GECE-LOG.md`'ye gerekçesiyle yaz, devam et.

---

## 0. ÖNCE OKU

Klasör: `/Users/baturayozden/projects/CareNova`

1. `GECE-LOG.md` — Gece 2 SABAH RAPORU (en üstte)
2. `BLOKAJLAR.md` — B2, B4, B5, B6, B7 açık
3. `CARENOVA-STRATEJI.md` — Bölüm 7 (modüller), M1 (Vaka Dosyası), M3 (doktor onayı), M8 (roller)
4. `CLAUDE.md`

`/Users/baturayozden/projects/caredental` — **SALT OKUNUR.**
⚠️ Gece 2'de bir `preview_start` çağrısı yanlışlıkla CareDental'ın dev
sunucusunu başlattı. Bu gece **hiçbir koşulda** o klasörde dev sunucu başlatma,
komut çalıştırma veya dosya açma. Sadece `grep`/`cat` ile referans oku.

---

## 1. GECE 2'DEN SONRA DOĞRULANANLAR

Baturay'ın Cowork oturumunda **canlı sitede kendi gözüyle** yapılan inceleme:

✅ **Vercel deploy CANLI ve güncel.** `961aba6`/`4ae7cbd` yayında. Admin konsolu
`?host=admin` ile açılıyor, 12 modül sidebar'da, Genel Bakış dolu ve doğru
çalışıyor. Gece 2'nin 1 numaralı açık maddesi kapandı.

🔴 **KURAL #11 DÜZELTİLDİ — ekran görüntüsü yasağı ÇOK GENİŞTİ.**
Ölçüldü: `whileInView`/reveal animasyonu **sadece** landing/marketing
sayfalarında var (`components/landing/`, About/Contact/Blog/Careers).
**Admin konsolu ve klinik paneli ekranlarında HİÇ reveal animasyonu yok.**
Yani:
- ❌ Landing/marketing sayfalarında ekran görüntüsü hâlâ güvenilmez (rAF donuyor)
- ✅ **`/admin/*` ve klinik paneli (`/dashboard`, `/cases`, `/doctor-queue` …)
  ekranlarında ekran görüntüsü ÇALIŞIYOR ve KULLANILMALI.**
Bu gece yaptığın her admin/app ekranını **gerçekten ekran görüntüsüyle gör.**
Gece 2'de "hiç insan gözüyle görülmedi" boşluğunun sebebi bu fazla geniş kuraldı.

---

## 2. GÖRSEL İNCELEMEDE BULUNAN GERÇEK HATALAR

Bunlar tahmin değil, canlı sitede görüldü. Bu gecenin iş listesinin çekirdeği.

### Bulgu 1 — Arayüz dili karmakarışık 🔴
Uygulama kabuğu **İngilizce**, içerik **Türkçe**, bazı yerler **Almanca**.
Aynı ekranda:
- Sidebar: "Dashboard, Cases, Conversations, Doctor Approval, Quotes, Travel,
  Aftercare, Patients, Reports" — İngilizce
- Sayfa başlığı: "Doctor Queue", "Cases with completed pre-assessment…" — İngilizce
- İçerik: "Panoramikte kemik yoğunluğu yeterli görünüyor, implant adayı",
  "Eksik diş sayısı", "52 yaş · Diş", "8 sa", "1 görsel" — Türkçe
- AI Activity: "Danke! Basierend auf den Fotos…" — Almanca (bu doğru, hasta dili)
- Alt sol: "Demo mode", "Sign out", "Dark mode" — İngilizce

Dil seçici **EN'de açılıyor** — brief'in "varsayılan Türkçe" kuralı tutmuyor.

### Bulgu 2 — CareDental'ın onboarding sihirbazı klinik panelini kilitliyor 🔴
`/dashboard` açılır açılmaz modal geliyor:
> **"Get Your AI Ready — Step 1 of 3 · Availability"**
> "When can patients be booked? The AI offers slots only inside these hours…"

Tamamen İngilizce, CareDental'dan miras, ekranı kapatıyor. "Later" ile
kapatılınca sağ altta kalıcı bir "Finish setting up your AI / Continue"
bildirimi kalıyor. Klinik panelini açan birinin gördüğü **ilk şey** bu.

### Bulgu 3 — Dashboard hâlâ CareDental'ın lead panosu 🔴
`/dashboard` şunları gösteriyor: "Total Leads 4", "Booked 2", "AI Messages Sent 5",
"Recovery Rate 68%", ve bir **Leads** tablosu (Name / Clinic / Status / Language /
Last Contact / Messages) + "Hot Leads" + "AI Activity".

Sorunlar:
- CareNova'nın birimi **lead değil, vaka**. Dashboard "4 lead" derken `/cases`
  ekranında 15 vaka var — iki ekran birbirini yalanlıyor.
- **"Clinic" kolonu her satırda "Nova Hair & Aesthetics Clinic" yazıyor.**
  Tek klinik kendi panelinde kendi adını her satırda görmez — bu CareDental'ın
  çok-klinikli yapısından kalma anlamsız bir kolon.
- Ürünün ana vaadi olan **ortalama ilk yanıt süresi** dashboard'da yok
  (admin konsolunda var: 4.2sn).

Gece 2'de D.1 bilinçli olarak atlanmıştı; artık atlanamaz — klinik kullanıcısının
gördüğü ilk ekran bu.

### Bulgu 4 — Doktor Onay Kuyruğu doğru ama çok sığ 🟡
İskelet doğru: hasta, ülke bayrağı, yaş, branş, bekleme süresi, "AI STRUCTURED
SUMMARY — INTERNAL ONLY" uyarısı (bu çok iyi, aynen kalsın), ön-değerlendirme
yanıtları, Eligible/Conditional/Ineligible, not alanı, "No quote may be issued
to the patient without doctor approval".

Eksikler:
- Kuyrukta **tek bir vaka** var. 15 demo vakadan birkaçı `awaiting_doctor`
  durumunda olmalı — kuyruk gerçekçi dolulukta görünmeli.
- "1 görsel" yazıyor ama **görsel galerisi yok** — brief galeri istiyordu.
- **Kırmızı bayrak uyarıları görünmüyor.**
- **Onaylanan kapsam alanları yok** — greft sayısı / implant sayısı / fiyat bandı.
  Brief bunları açıkça istemişti; doktor onayının teklife bağlanması bu alanlara
  bağlı.
- Sidebar'da "Doctor Approval", sayfa başlığında "Doctor Queue" — isim tutarsız.

### Bulgu 5 — Admin sidebar'ında logo altındaki "PLATFORM" etiketi çok soluk 🟡
Küçük punto, açık gri. Kontrast ölçülmeli (muhtemelen B6'yla aynı aile:
ham Tailwind gri, token değil).

---

## 3. MUTLAK YASAKLAR

| # | Yasak |
|---|---|
| 1 | `caredental` klasöründe hiçbir dosyayı değiştirme, **dev sunucu başlatma**, komut çalıştırma. Sadece `grep`/`cat` ile oku. |
| 2 | DNS/domain ayarlarına dokunma |
| 3 | Vercel'de yeni proje oluşturma. Deploy = `git push`. |
| 4 | `.env` veya gerçek anahtar commit etme |
| 5 | Gerçek API çağrısı (Anthropic, Meta, ödeme) — hepsi mock |
| 6 | Backend'i deploy etme |
| 7 | **Sistem paketi kurma** (`brew install postgresql`, docker vb.) — Baturay'ın makinesine izinsiz kurulum yapma. Postgres gerekiyorsa `BLOKAJLAR.md`'ye yaz. |
| 8 | `git push --force`, `git reset --hard` (commit'lenmemiş iş varken) |
| 9 | Sahte müşteri referansı/logo/metrik |
| 10 | Aynı hatayı 3 kez deneme — bırak, logla, devam et |
| 11 | **Landing/marketing sayfalarında** ekran görüntüsüyle görsel teşhis yapma (rAF donuyor). **Admin ve klinik paneli ekranlarında ekran görüntüsü GEÇERLİ — kullan.** |

---

## 4. İŞ BÖLÜMLERİ

### BÖLÜM A — i18n tutarlılığı 🔴 (~1,5 sa)

1. **Varsayılan dil TÜRKÇE olsun.** Tespit sırası: kullanıcı tercihi (localStorage)
   → tarayıcı → **`tr`**. Şu an EN'e düşüyor, sebebini bul (dedektör sırası mı,
   fallback mı, `supportedLngs` mi) ve düzelt. Temiz bir profilde (localStorage
   boş) TR açıldığını doğrula.
2. **Klinik panelinin tüm kabuğunu i18n'le:** Sidebar öğeleri, sayfa başlıkları,
   tablo kolon başlıkları, buton etiketleri, "Demo mode", "Sign out", "Dark mode",
   durum rozetleri (Qualified/Contacted/Booked/Attended → Nitelendi/İletişime
   geçildi/Rezerve/Geldi).
3. **Admin konsolunun kabuğunu da i18n'le.** Gece 2'de "admin tek kullanıcılı,
   TR bıraktım" kararı verilmiş ama sonuç tutarsız: sidebar İngilizce, içerik
   Türkçe. İkisinden birini seç — **öneri: admin de TR+EN olsun**, app ile aynı
   altyapıyı zaten paylaşıyor, maliyeti düşük.
4. **Terminoloji sözlüğü oluştur:** `docs/terminoloji.md`. CareNova'nın çekirdek
   kavramlarının TR/EN karşılıkları sabitlensin ve her yerde aynı kullanılsın:
   ```
   case → Vaka          case file → Vaka Dosyası
   lead → Aday hasta    quote → Teklif        locked quote → Kilitli Teklif
   doctor queue → Doktor Onay Kuyruğu (sidebar'da da AYNI, "Doctor Approval" değil)
   aftercare → Bakım Hattı              branch → Branş
   pre-assessment → Ön Değerlendirme    eligibility → Uygunluk
   companion → Refakatçi                concierge → Konsiyerj
   ```
5. `scripts/check-i18n-leaks.js`'i klinik paneli ve admin ekranlarını da
   tarayacak şekilde genişlet (şu an sadece landing'e bakıyor). TR modunda
   İngilizce kabuk metni, EN modunda Türkçe metin kalmışsa yakalasın.

**Doğrulama:** TR ve EN'de `/dashboard`, `/cases`, `/doctor-queue`, `/admin/overview`
**ekran görüntüsü al ve gerçekten bak.** Karışık dil kalmamalı.

**Commit:** `fix(i18n): Turkish default and full shell localisation for app and admin`

---

### BÖLÜM B — Onboarding sihirbazını temizle 🔴 (~45 dk)

1. CareDental'ın `OnboardingWizard`'ı klinik panelinde otomatik açılıyor.
   **Otomatik açılmayı kapat.**
2. Yerine CareNova'nın kendi onboarding'i (strateji M11, 7 adım) için bir
   **giriş noktası** koy: dashboard'da kapatılabilir bir kart —
   "Kurulumu tamamla · 7 adımın 3'ü bitti" + ilerleme çubuğu + "Devam et".
   Sihirbazın kendisi bu gece yapılmayacak; kart `/settings/onboarding`'e
   götürsün, orası "Yakında" olsun (dürüst).
3. Sağ alttaki kalıcı "Finish setting up your AI" bildirimini kaldır.
4. CareDental'ın sihirbaz adımları (Availability / AI ayarları) CareNova'nın
   7 adımıyla uyuşmuyor — bileşeni silme, ama klinik panelinden bağlantısını kes
   ve `docs/` altına neden devre dışı olduğunu not düş.

**Commit:** `fix(app): remove inherited CareDental onboarding wizard from clinic panel`

---

### BÖLÜM C — Dashboard'u vaka-merkezli yeniden kur 🔴 (~2 sa)

Gece 2'de atlanan D.1. Klinik kullanıcısının gördüğü ilk ekran.

**Sil:** "Total Leads / Booked / AI Messages Sent / Recovery Rate" kartları,
Leads tablosu, "Clinic" kolonu.

**Yeni KPI kartları (rol bağımsız üst şerit):**
| Kart | Neden |
|---|---|
| **Ortalama ilk yanıt süresi** | Ürünün ana vaadi — en solda, en büyük |
| Bugün gelen mesaj | Hacim |
| Yanıt bekleyen | Aksiyon |
| Doktor onayı bekleyen | Darboğaz |
| Depozito bekleyen teklif | Para |
| Bu ay tamamlanan vaka | Sonuç |

**Altında üç kolon:**
1. **Aksiyon gerektirenler** — vaka bazlı, önceliklendirilmiş liste:
   yanıtlanmamış mesaj, doktor kuyruğunda bekleyen, süresi dolmak üzere olan
   teklif, bakım hattında yanıt vermeyen hasta. Her satır ilgili vakaya gitsin.
2. **Bugünün programı** — `case_timeline`'dan: varış, konsültasyon, işlem,
   kontrol, dönüş. Saat + hasta + tip.
3. **Son AI etkinliği** — hastanın kendi dilinde mesaj + Türkçe çeviri,
   vakaya link. (Mevcut "AI Activity" bileşenini bu forma getir.)

**Rol bazlı farklılaştırma:**
- `doktor` → doğrudan `/doctor-queue`'ya yönlendir (dashboard'a hiç uğramasın)
- `koordinator` → Bugünün programı en üstte
- `muhasebe` → teklif/ödeme kartları öne
- `hasta_danismani` → Aksiyon gerektirenler en üstte
- `klinik_sahibi` / `operasyon_muduru` → tam görünüm

**Commit:** `feat(app): case-centric clinic dashboard replacing inherited lead board`

---

### BÖLÜM D — Doktor Onay Kuyruğunu derinleştir 🔴 (~1,5 sa)

1. **Demo veriyi düzelt:** 15 vakadan **en az 4-5 tanesi** `awaiting_doctor`
   durumunda olsun, farklı branşlarda (saç ekimi, diş, estetik, göz), farklı
   bekleme sürelerinde (12 dk … 3 gün). Kuyruk gerçekçi dolulukta görünsün.
2. **Görsel galerisi ekle:** "1 görsel" yazısı yerine gerçek küçük resim ızgarası,
   tıklayınca büyüyen. Branş şablonundaki slot adlarıyla etiketli
   (ön görünüm / tepe / donör / panoramik).
3. **Kırmızı bayrakları göster:** branş şablonundaki `red_flags` ile eşleşen
   bir durum varsa kartın üstünde uyarı şeridi (örn. "24 yaş altı",
   "kontrolsüz diyabet beyanı", "yetersiz donör şüphesi").
4. **Onaylanan kapsam alanları — brief'te vardı, eksik:**
   - Greft sayısı aralığı (saç ekimi) / implant sayısı (diş) / işlem listesi (estetik)
   - **Onaylanan fiyat bandı** (alt–üst, para birimi)
   - Bunlar `Eligible` veya `Conditional` seçilince zorunlu alan olsun
   - `Ineligible` seçilince gerekçe zorunlu olsun
5. **"Save decision" sonrası:** vaka durumu `awaiting_doctor` → `quoted`
   geçişine hazır hale gelsin, kartta "Teklif oluşturulabilir" rozeti belirsin.
6. **İsim tutarlılığı:** sidebar ve sayfa başlığı ikisi de
   **"Doktor Onay Kuyruğu" / "Doctor Approval Queue"** olsun.
7. `AI STRUCTURED SUMMARY — INTERNAL ONLY` uyarısı **aynen kalsın**, iyi yapılmış.
   Sadece i18n'le ve "Bu özet hastaya gösterilmez" açıklamasını Türkçeleştir.

**Doğrulama:** ekran görüntüsü al, masaüstü + 390px mobil.

**Commit:** `feat(doctor-queue): image gallery, red flags, approved scope and price band`

---

### BÖLÜM E — B7: CareNova rol sistemi 🔴 (~2,5 sa) — en büyük yapısal boşluk

`BLOKAJLAR.md` B7. Şu an backend'de hâlâ CareDental rolleri var
(`director`, `clinic_admin`, `receptionist`, `dentist`, `treatment_coordinator`, `sales`),
CareNova'nın 7 rolü sadece frontend demo verisinde.

1. **Migration yaz** (059): CareNova rolleri
   ```
   klinik_sahibi · operasyon_muduru · hasta_danismani · doktor ·
   koordinator · tercuman · muhasebe
   ```
   Eski rollerden yeni rollere eşleme tablosu da yaz (mevcut kullanıcı verisi için):
   `director→operasyon_muduru`, `clinic_admin→klinik_sahibi`,
   `treatment_coordinator→hasta_danismani`, `dentist→doktor`,
   `receptionist→koordinator`, `sales→hasta_danismani`
   Migration geri alınabilir (rollback) olsun.
2. `backend/src/routes/clinics.js` içindeki `ROLE_IDS` haritasını güncelle.
3. **Tüm `requireRole(...)` çağrılarını tara** ve yeni rollere taşı.
   Kaç dosyada kaç çağrı olduğunu önce say, `GECE-LOG.md`'ye yaz, sonra değiştir.
4. **Rol-bazlı yetkilendirmeyi gerçekten uygula** — `routes/caseFiles.js`:
   | Aksiyon | İzinli roller |
   |---|---|
   | Vaka görüntüleme | hepsi (tercüman: tıbbi dosya hariç) |
   | Uygunluk kararı verme | **sadece `doktor`** |
   | `awaiting_doctor` → ileri durum geçişi | **sadece `doktor`** |
   | Teklif oluşturma/gönderme | `hasta_danismani`, `operasyon_muduru`, `klinik_sahibi` |
   | Seyahat/program düzenleme | `koordinator`, `operasyon_muduru`, `klinik_sahibi` |
   | Fatura/ödeme | `muhasebe`, `klinik_sahibi` |
   | Kullanıcı/rol yönetimi | `klinik_sahibi` |
   | Tıbbi dosya okuma | `doktor`, `hasta_danismani`, `operasyon_muduru`, `klinik_sahibi` (**`tercuman` HAYIR**) |
5. **Test yaz:** her rol için izinli/izinsiz en az bir uç. Özellikle
   "doktor olmayan biri uygunluk kararı veremez" ve "tercüman tıbbi dosyayı
   okuyamaz" testleri.
6. Frontend'de rol adlarını i18n'le (kullanıcıya "klinik_sahibi" değil
   "Klinik Sahibi" görünsün).

⚠️ DB yok — migration'ı çalıştıramazsın (B2). Kodu ve testleri yaz,
`BLOKAJLAR.md`'yi güncelle.

**Commit:** `feat(auth): CareNova clinic roles and role-based authorisation`

---

### BÖLÜM F — B5: Impersonation salt-okunur zorlaması 🟡 (~30 dk)

Bölüm E'nin middleware'i geldiğine göre artık uygulanabilir:
impersonation token'ı taşıyan isteklerde `POST/PUT/PATCH/DELETE` → **403**,
sadece `GET` geçsin. Test yaz. `BLOKAJLAR.md` B5'i kapat.

---

### BÖLÜM G — Küçük açıklar ⚪ (~45 dk)

1. **B6:** `Sidebar.tsx:322` "Management" başlığı `text-gray-600`, 10px,
   koyu zeminde 2.56:1. Token sistemine taşı, 4.5:1'e çıkar.
2. **Bulgu 5:** Admin sidebar'da logo altındaki "PLATFORM" etiketinin
   kontrastını ölç, gerekiyorsa düzelt.
3. **Tüm kabukta ham Tailwind gri kalıntısı tara:**
   `grep -rn "text-gray-\|bg-gray-\|border-gray-" frontend/src --include=*.tsx`
   Hepsini token sistemine taşı. Bu, B6 gibi hataların tekrarını önler.
4. **B4** (çift `<title>`): 3 deneme kuralı gereği bırakılmıştı. Bu sefer
   farklı bir yol dene: her app/admin sayfasına kendi `AppMeta`'sını ekle
   (daha çok dosya ama kesin çözüm). Yine olmazsa bırak, kozmetik.

---

### BÖLÜM H — Sohbetler ve Teklifler ekranları ⚪ (~2 sa, vakit kalırsa)

`D.4`'ün "Yakında" listesinden en değerli iki tanesi:

**Sohbetler (`/conversations`)** — gelen kutusu: vaka, hasta, dil, son mesaj,
yanıt bekleme süresi. Detayda WhatsApp konuşması: hastanın dilinde + Türkçe
çeviri yan yana, ses notu oynatıcı + transkript, fotoğraflar. "AI'ı durdur /
devral" butonu (demo modunda durum değişikliği).

**Teklifler (`/quotes`)** — liste: vaka, hasta, versiyon, tutar, para birimi,
durum, geçerlilik bitişi (geri sayım). Detayda kilitli teklif kartı: kalem kalem,
"dahil DEĞİLDİR" listesi, uygulayacak doktor adı+tescil no, versiyon geçmişi ve
değişiklik gerekçeleri, doğrulama hash'i.

Diğerleri (Seyahat, Bakım Hattı, Hastalar, Raporlar, Ayarlar) dürüst
"Yakında" kalsın — modülün ne yapacağını anlatan kısa açıklamayla.

---

## 5. SIRA VE BÜTÇE

| # | Bölüm | Öncelik |
|---|---|---|
| 1 | A — i18n tutarlılığı | 🔴 |
| 2 | B — Onboarding sihirbazı temizliği | 🔴 |
| 3 | C — Vaka-merkezli dashboard | 🔴 |
| 4 | D — Doktor kuyruğu derinliği | 🔴 |
| 5 | E — Rol sistemi (B7) | 🔴 |
| 6 | F — Impersonation salt-okunur (B5) | 🟡 |
| 7 | G — Küçük açıklar | ⚪ |
| 8 | H — Sohbetler + Teklifler | ⚪ |

Gece 2 tahmin edilenin çok altında sürdü (12sa tahmin → 1sa 7dk gerçek).
Bu yüzden bu gece **süre tahmini vermiyorum** — sıraya göre git, ne kadar
ilerlersen o kadar. **Duracağın zamandan 40 dk önce kapanışa geç.**

---

## 6. HER BÖLÜM SONUNDA

1. `cd frontend && npm run build` temiz mi?
2. Yeni string'ler TR+EN ikisinde de dolu mu?
3. `scripts/check-i18n-leaks.js` temiz mi?
4. Yeni endpoint'te tenant scoping **ve artık rol kontrolü** var mı?
5. Ham Tailwind gri (`text-gray-*`) eklemedim mi?
6. **Değiştirdiğim admin/app ekranının ekran görüntüsünü aldım ve BAKTIM mı?**
   (Landing hariç — orada hâlâ yasak)
7. Commit + push + `GECE-LOG.md` güncel

---

## 7. KAPANIŞ 🔴 (40 dk)

1. Build temiz, testler raporlanmış
2. Her şey commit'li ve push'lu
3. **Push'tan sonra 3 dk bekle ve deploy'un canlıya çıktığını DOĞRULA** —
   `curl -sI https://carenova-baturay-ozden-s-projects.vercel.app | head -1` +
   sayfa içeriğinde bu gece eklediğin bir metnin varlığını kontrol et.
   Gece 2'de bu adım atlanmıştı.
4. `GECE-LOG.md`'nin en üstüne yeni SABAH RAPORU:

```markdown
# SABAH RAPORU — Gece 3

## 🔗 Test linkleri (deploy doğrulandı mı: EVET/HAYIR + nasıl)
## ⚠️ Baturay'ın yapması gerekenler (öncelik sırasıyla)
## ✅ Tamamlananlar
## ⏸️ Yarım kalanlar
## 🚧 Blokajlar (hangileri kapandı, hangileri açık)
## 🤔 Verdiğim önemli kararlar (ve neden)
## 📸 Ekran görüntüsüyle gördüklerim
   (bu gece hangi ekranlara gerçekten baktın, ne gördün — landing hariç)
## 👁️ Hâlâ Baturay'ın gözü gereken
## ▶️ Sıradaki 3 adım
```

5. `BLOKAJLAR.md` güncel — kapananları ✅ işaretle, yenileri ekle

**Doğrulayamadığın hiçbir şey için "doğruladım" deme.**

Başla.

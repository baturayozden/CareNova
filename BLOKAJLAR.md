# Blokajlar — Baturay'ın müdahalesi gerekiyor

## ✅ B1 — Vercel SSO duvarı — ÇÖZÜLDÜ (kullanıcı isteğiyle canlı oturumda)

Kullanıcı canlı linkin çalışmadığını bildirince, doğrudan onayıyla
`vercel project protection disable carenova --sso` çalıştırıldı (bu artık
salt-okunur CLI sınırının dışında, kullanıcının açık isteğiyle yapıldı).
SSO/Deployment Protection tamamen kapatıldı. Doğrulandı: proje artık
`"ssoProtection": null`.

## ✅ B3 (eski) — carenova-two.vercel.app 404 + stray "frontend"/"backend" projeleri — ÇÖZÜLDÜ

**Gerçek kök neden bulundu:** SSO koruması kapatılınca ASIL sorun ortaya çıktı —
`frontend/scripts/prerender.js` build'in son adımında `build/index.html`'i
`build/_hosts/app-shell.html`'e taşıyor ("root is now empty"). Kök dizindeki
`vercel.json`'ın basit SPA rewrite kuralı hâlâ artık var olmayan `/index.html`'e
yönlendiriyordu → gerçek bir 404. **SSO koruması bunu gece boyu gizlemiş** —
her istek routing katmanına hiç ulaşmadan Vercel'in login ekranına
yönlendiriliyordu, ben de bunu "sadece SSO engeli" sanıp geçmiştim.

**Düzeltme (commit `583d300`):** Kök `vercel.json`'a `frontend/vercel.json`'daki
aynı host-aware rewrite/redirect/header kuralları kopyalandı — catch-all artık
`/_hosts/app-shell.html`'e düşüyor. Yerelde `_hosts/app-shell.html`'in build
çıktısında gerçekten var olduğu doğrulandı, sonra canlı deploy ile teyit edildi.

**Ayrıca:** Kullanıcının kendi troubleshooting'i sırasında oluşturduğu, aynı
repo'yu farklı Root Directory'lerle (`frontend`, `backend`) tekrar import eden
iki gereksiz proje kullanıcının onayıyla silindi (`vercel project rm frontend`,
`vercel project rm backend`). `carenova` projesinin "Latest Production URL"
alanı bu temizlikten sonra doğru şekilde `carenova-baturay-ozden-s-projects.vercel.app`'e döndü.

**Doğrulanmış çalışan URL (HTTP 200, içerik doğru):**
👉 **https://carenova-baturay-ozden-s-projects.vercel.app**

---

## B2 — Yeni migration'lar (056-058) gerçek bir veritabanına karşı hiç çalıştırılmadı (aciliyet: orta)

**Ne oldu:** PAKET 6'da `cases`/`case_*`/`branch_templates` tabloları için 3 yeni
migration yazıldı (`backend/src/migrations/056-058`). Bu makinede `psql` veya
`docker` kurulu değil, backend'in bağlanacağı bir Postgres de yok — dolayısıyla
migration'lar sadece elle satır satır gözden geçirilerek doğrulandı, gerçek bir
veritabanına karşı **hiç çalıştırılmadı**.

**Ne denedim:** SQL'i elle okudum, bir gerçek sözdizimi hatası buldum ve
düzelttim (058'de yanlış apostrof escape'i). Ama elle okuma, migration'ı
gerçekten çalıştırmanın yerini tutmaz — FK sırası, tip uyumsuzluğu gibi
hatalar sadece gerçek `node migrate.js` çalıştırıldığında ortaya çıkar.

**Ne gerekiyor:** Bir Postgres'e (yerel/Supabase) bağlandığında ilk iş olarak
`cd backend && node migrate.js` çalıştır ve çıktıyı kontrol et. 056-058 en son
eklenenler, hata verirlerse önce onlara bak.

**Etkisi:** Şu an backend zaten deploy edilmedi, bu yüzden gece boyu hiçbir
şeyi bloklamıyor — ama migration'lar ilk gerçek DB bağlantısında sürpriz
çıkarabilir.

**Aciliyet:** Orta — backend deploy edilene kadar acil değil.

**Güncelleme (Bölüm E):** Bölüm E'de bu 3 migration'ın üzerine gerçek
servis/route kodu yazıldı (`caseFileStore.js`, `routes/caseFiles.js`,
`routes/branchTemplates.js`, `routes/adminPlatform.js`) — hepsi mock
`pool.query` ile birim testlerle doğrulandı (13+5 test, hepsi geçti),
ama HİÇBİRİ gerçek bir Postgres'e karşı çalıştırılmadı. `npm test` ayrıca
DB'ye gerçekten bağlanmaya çalışan (`ECONNREFUSED`) önceden var olan
`invoiceNumber.test.js`'i içeriyor — bu benim eklediğim bir şey değil,
ama "npm test temiz geçti" derken bunu atladığımı açıkça belirtiyorum:
`npx jest --testPathIgnorePatterns=invoiceNumber` → 4 suite, 122 test,
hepsi yeşil. Migration'lar çalıştırıldığında ilk iş bu 4 yeni dosyayı
gerçek verilerle (özellikle tenant izolasyonunu) elle bir kez daha
doğrulamak.

---

## ✅ B7 — CareNova'nın 7 klinik rolü backend'de yoktu — Gece 3'te ÇÖZÜLDÜ (kod+test; DB'ye karşı doğrulanmadı)

**Neydi:** `klinik_sahibi`/`operasyon_muduru`/`hasta_danismani`/`doktor`/
`koordinator`/`tercuman`/`muhasebe` sadece frontend demo verisinde vardı;
backend hâlâ CareDental'ın eski rolleriyle (`director`, `clinic_admin`,
`receptionist`, `dentist`, `treatment_coordinator`, `sales`) çalışıyordu.

**Ne yapıldı (GECE-3-BRIEFI.md Bölüm E, tam detay GECE-LOG.md'de):**
- `backend/src/migrations/059_carenova_clinic_roles.sql` — 7 yeni rol +
  eski→yeni kullanıcı taşıma. **Çalıştırılmadı** (DB yok, bkz. B2) — bu
  yüzden başlıktaki ✅ SADECE kod/test seviyesinde, gerçek bir veritabanına
  karşı henüz doğrulanmadı.
- 18 backend + 17 frontend dosyasında (~45 referans) rol string'leri
  mekanik olarak yeni isimlere taşındı; `treatment_coordinator`/`sales`
  çakışması (ikisi de `hasta_danismani`'ye toplanıyor) her yerde DAHA
  KISITLAYICI davranış uygulanarak çözüldü (gerekçe: M8'in "kendi
  vakaları" tanımı + 'sales'in zaten hiç gerçek kullanıcısı olmadığının
  keşfedilmesi — bkz. aşağıdaki yeni bulgu).
- `routes/caseFiles.js`'e gerçek bir rol-yetkilendirme matrisi eklendi
  (brief'in E.4 tablosu): tıbbi dosya okuma (tercümana kapalı), uygunluk
  kararı (sadece doktor), `awaiting_doctor`'dan çıkış (sadece doktor),
  seyahat/program düzenleme (koordinator/operasyon_muduru/klinik_sahibi).
  "Teklif oluşturma" ve "Fatura/ödeme" satırları bağlanamadı — bu router'da
  hiç teklif/fatura modeli yok, not düşüldü.
- `routes/clinics.js`'e personel/rol yönetimini `requireClinicAdmin`'den
  ayıran daha dar bir `requireKlinikSahibi` guard'ı eklendi (brief: "sadece
  klinik_sahibi").
- 6+ yeni birim test (`caseFiles.test.js`), toplam 128/128 yeşil.
- Frontend: `DEMO_USER.role` gerçekten `operasyon_muduru`'ya çevrildi (yeni
  sistemi bu gece bizzat sergiliyor), rol adları artık `roleLabel()` ile
  çevriliyor ("klinik_sahibi" değil "Klinik Sahibi" görünüyor).

**Yeni bulgu — 'sales' rolü zaten kırıktı:** `ROLE_IDS.sales = 9` hiçbir
migration/seed'de karşılığı olmayan bir id'ydi — gerçek bir 'sales'
kullanıcısı oluşturma denemesi muhtemelen hep FK hatasıyla patlardı. Bu,
Gece 3'ten önce vardı, migration 059 onu (sales kavramını kaldırarak)
konu dışı bırakıyor.

**Hâlâ eksik / doğrulanmamış:**
- Migration 059 gerçek bir Postgres'e karşı hiç çalıştırılmadı (B2).
- `backend/src/db/seed-full.js` / `seed-demo-riverside.js` (dev seed
  script'leri) hâlâ eski rol isimleri kullanıyor — request path dışında,
  ayrı bir iş.
- `commissions.js`'in bazı rol sabitlerine `muhasebe`'yi M8'in tanımına
  dayanarak ekledim (mekanik rename'in ötesinde bir karar) — Baturay'ın
  gözden geçirmesi iyi olur.
- `appointments.js`'teki hayalet `'manager'` rolü (seed edilmemiş)
  `operasyon_muduru`'ya katlandı — aynı şekilde bir karar, onay bekliyor.

**Aciliyet:** Düşük-orta — kod ve testler hazır, gerçek DB bağlantısı
kurulduğunda ilk iş `node migrate.js` + bu rol matrisini gerçek
kullanıcılarla elle bir kez doğrulamak.

---

## B4 — Kendi AppMeta'sını render etmeyen sayfalarda host-bazlı varsayılan sekme başlığı çalışmıyor (kozmetik, düşük öncelik)

**Ne oldu:** GECE-2-BRIEFI.md Bölüm B.3 madde 5, her host'un kendi varsayılan
`<title>`'ına sahip olmasını istiyor ("CareNova | Klinik Paneli" app için,
"CareNova | Platform" admin için). `AppMeta` render eden sayfalarda (Login,
ComingSoon, vb.) sorun yok. Ama Dashboard gibi hiç `AppMeta` render etmeyen
sayfalarda, host-bazlı varsayılanı ayarlamak için `document.title = ...`
sonra daha açık bir `setDefaultTitle()` yardımcı fonksiyonu (mevcut
`<title>` elemanını bulup güncelleme, fazlalıkları temizleme) denedim — her
ikisinde de `<head>`'de İKİ `<title>` elemanı oluşuyor
(`frontend/src/lib/setDefaultTitle.ts`'te tam açıklama var), ve
`document.title` getter'ı (spec gereği ilk elemanı döndürür) boş kalan
"CareNova" değerini gösteriyor.

**Kök neden bulunamadı** — React 19'un native head-yönetimi (title/meta/link
hoisting) ile ilgili bir etkileşim olabilir ama tam izini süremedim. 3
deneme kuralı gereği bıraktım.

**Etkisi:** SADECE kozmetik — tarayıcı sekmesi/geçmişinde host'a özel bir
varsayılan başlık yerine boş "CareNova" görünüyor, kendi AppMeta'sı olan
sayfalarda (çoğu kritik ekran) hiçbir etkisi yok. Güvenlik/işlevsellik
etkilenmiyor.

**Ne gerekiyor:** React 19'un `<title>`/head-hoisting mekanizmasının bu
projedeki (CRA + react-router + iki ayrı `useEffect` kaynağı) tam
davranışının araştırılması, ya da her app/admin sayfasına kendi `AppMeta`'sını
eklemek (daha kesin ama daha çok dosya değişikliği gerektirir).

**Aciliyet:** Düşük — kozmetik, işlevsel hiçbir şeyi engellemiyor.

---

## ✅ B5 — Impersonation'ın "yazma işlemleri engellenir" kuralı — Gece 3'te ÇÖZÜLDÜ

**Neydi:** GECE-2-BRIEFI.md Bölüm C.10, impersonation aktifken tüm yazma
işlemlerinin salt-okunura dönmesini istiyordu; `admin/ImpersonationContext.tsx`
bu kuralı belgeliyordu ama hiçbir yerde ZORLAMIYORDU.

**Ne yapıldı (GECE-3-BRIEFI.md Bölüm F):** `backend/src/middleware/
auth.js`'e `blockWritesDuringImpersonation` eklendi — `X-Impersonation-
Session` header'ı taşıyan bir istekte method GET/HEAD/OPTIONS dışındaysa
403 döner. `index.js`'de TÜM route'lardan önce global olarak takıldı
(auth'suz bile çalışıyor — impersonation kontrolü kimlik doğrulamadan
önce, en dış katmanda). Canlı `curl` ile doğrulandı: header'lı POST → 403,
header'lı GET → normal auth akışına devam (401, token yok çünkü), header'sız
POST → normal auth akışına devam (403 DEĞİL). 8 birim test (mock req/res,
DB gerekmiyor) — tüm yazma metodları (POST/PUT/PATCH/DELETE) kapsandı.

**Hâlâ eksik:** Frontend'in `ImpersonationContext.tsx`'i bu header'ı HİÇBİR
gerçek isteğe eklemiyor — çünkü demo modunda zaten hiçbir gerçek API
çağrısı yok (admin konsolu tamamen `adminDemoData.ts` üzerinde çalışıyor).
Bu yüzden kural bu gece UÇTAN UCA sergilenemedi — sadece middleware'in
kendisi izole test edildi ve gerçek bir Express sunucusuna karşı `curl`
ile doğrulandı. Admin konsolu gerçek backend'e bağlanınca
(`ImpersonationContext`'in `start()`'ı gerçek bir API istemcisi
kullanmaya başlayınca), o istemciye bu header'ı otomatik eklemesi
gerekecek — ayrı, küçük bir iş.

**Aciliyet:** Düşük — güvenlik kuralının kendisi artık kodda ve testte var
ve doğru çalıştığı gösterildi; kalan iş sadece frontend'in bunu
kullanmaya başlaması.

---

## B6 — Sidebar "Management" bölüm başlığı WCAG AA'yı geçemiyor (kozmetik, düşük öncelik, kapsam dışı)

**Ne oldu:** Bölüm D doğrulaması sırasında çalıştırdığım genel bir
kontrast taraması (`getComputedStyle` tabanlı, ekran görüntüsü değil),
`/doctor-queue` sayfasında SIFIR ihlal buldu ama Sidebar'ın kendisinde
1 ihlal yakaladı: `src/components/Sidebar.tsx:322`'deki "Management"
bölüm başlığı `text-gray-600` (token sistemine değil, ham Tailwind gri
paletine bağlı) kullanıyor, 10px punto, koyu sidebar zeminine karşı
2.56:1 — gereken 4.5:1'in çok altında.

**Neden düzeltmedim:** Bu, Gece 2'nin kapsamındaki (nav/host/admin/vaka)
hiçbir dosyaya ait değil — muhtemelen Gece 1 öncesinden kalma bir hata,
`docs/contrast-report.md`'in 35 bulgusuna da dahil değildi çünkü o rapor
sadece landing sayfasını tarıyor, Sidebar'ı değil. Kapsam dışı bir hatayı
düzeltmeye başlamak yerine not düşüp devam ettim (MUTLAK YASAK #10'un
ruhu: bilinmeyen bir hataya dalıp zaman kaybetme).

**Ne gerekiyor:** `text-gray-600`'ü token sistemine (`text-ink-subtle`
veya benzeri, sidebar'ın koyu zeminine göre ayrıca ölçülmeli) çevirmek —
tek satırlık bir düzeltme, muhtemelen 10-15 dakika sürer.

**Aciliyet:** Düşük — kozmetik, tek bir bölüm başlığı, okunabilirlik
tamamen imkansız değil (sadece AA eşiğinin altında).

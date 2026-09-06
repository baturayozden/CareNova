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

## B2 — Yeni migration'lar (056-059) gerçek bir veritabanına karşı hiç çalıştırılmadı (aciliyet: orta)

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

**Güncelleme (Gece 2 Bölüm E):** Bu 3 migration'ın üzerine gerçek
servis/route kodu yazıldı (`caseFileStore.js`, `routes/caseFiles.js`,
`routes/branchTemplates.js`, `routes/adminPlatform.js`) — hepsi mock
`pool.query` ile birim testlerle doğrulandı, ama HİÇBİRİ gerçek bir
Postgres'e karşı çalıştırılmadı.

**Güncelleme (Gece 3 Bölüm E):** Dördüncü bir migration eklendi —
`059_carenova_clinic_roles.sql` (CareNova'nın 7 rolü + kullanıcı taşıma,
bkz. B7). O da aynı durumda: yazıldı, gözden geçirildi, test edildi
(mock DB), ama çalıştırılmadı. `npm test` ayrıca DB'ye gerçekten
bağlanmaya çalışan (`ECONNREFUSED`) önceden var olan
`invoiceNumber.test.js`'i içeriyor — bu benim eklediğim bir şey değil,
ama "npm test temiz geçti" derken bunu atladığımı açıkça belirtiyorum:
`npx jest --testPathIgnorePatterns=invoiceNumber` → **6 suite, 136 test,
hepsi yeşil** (Gece 3 sonu itibarıyla).

**Ne gerekiyor:** Bir Postgres'e bağlandığında sırayla `056 → 057 → 058
→ 059` çalıştır, sonra Bölüm E'nin (Gece 2+3) tüm route'larını
(`caseFiles.js`'in rol matrisi dahil) gerçek verilerle bir kez elle
doğrula.

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

## ✅ B4 — Host-bazlı varsayılan sekme başlığı — Gece 3'te ÇÖZÜLDÜ (kök neden bulundu)

**Neydi:** Kendi `AppMeta`'sını render etmeyen sayfalarda (`/leads`,
`/settings`, vb.) sekme başlığı host-bazlı varsayılan yerine boş
"CareNova" gösteriyordu.

**Gerçek kök neden (Gece 2'de bulunamamıştı):** `components/Layout.tsx`
HER app-host sayfasında (Dashboard dahil) koşulsuz `<AppMeta
title="CareNova">` render ediyordu. Layout, sayfa içeriğinden ÖNCE mount
olduğu için bu, `<head>`'deki İLK `<title>` elemanı oluyordu. React 19
bunu deklaratif, reconcile edilen bir node olarak yönetiyor — `AppRoutes`'un
`setDefaultTitle()`'ı bu SAME DOM node'un `textContent`'ini emperatif
olarak değiştirmeye çalışınca, React'in bir sonraki render'ı bunu geri
"CareNova"ya döndürüyordu. Yani sorun React 19'un genel head-yönetimi
DEĞİLDİ — Layout'un gereksiz, koşulsuz kendi AppMeta'sıydı.

**Düzeltme:** `Layout.tsx`'ten `<AppMeta title="CareNova">` tamamen
kaldırıldı. Artık `setDefaultTitle()`'ın React tarafından yönetilen
rakip bir node'u yok, sahayı kontrolsüz kullanıyor.

**Canlı doğrulandı (fresh load + SPA içi navigasyon, ekran görüntüsü
gerekmedi — `document.title` doğrudan okunabilir):**
- `/leads` (kendi AppMeta'sı yok) → tek `<title>`, doğru değer:
  "CareNova | Klinik Paneli"
- `/dashboard` → "Dashboard | CareNova" (kendi AppMeta'sı)
- `/dashboard`'dan SPA ile `/cases`'e geçiş → "Cases | CareNova" (doğru,
  anında güncelleniyor)
- `/cases`'ten SPA ile `/settings`'e geçiş (kendi AppMeta'sı yok) →
  tek `<title>`, doğru varsayılan

**Kalan küçük not:** Fresh-load DEĞİL, SPA-içi geçişlerde ara sırada
(örn. Dashboard'un kendi AppMeta'sı unmount olurken) `<head>`'de görünmez,
`document.title`'ı ETKİLEMEYEN bir fazladan `<title>` node'u bir sonraki
geçişe kadar kalabiliyor — kullanıcı hiçbir zaman yanlış bir sekme başlığı
GÖRMÜYOR (test edilen her senaryoda `document.title` her zaman doğruydu),
sadece DOM'da temizlenmemiş, görünmez bir kalıntı var. Orijinal hatanın
(kullanıcıya yanlış başlık gösterme) kendisi giderildi.

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

## ✅ B6 — Sidebar "Management" bölüm başlığı — Gece 3'te ÇÖZÜLDÜ (kök token hatasıydı)

**Neydi:** `Sidebar.tsx`'teki "Management"/"Super Admin" bölüm başlıkları
`text-gray-600` (ham Tailwind, token değil) kullanıyordu, koyu zeminde
2.56:1 — 4.5:1'in altında.

**Gerçek kök neden (beklenenden daha derindi):** `text-gray-600`'ü
`text-ink-subtle`'a çevirmek TEK BAŞINA yetmiyordu, çünkü `--ink-subtle`
token'ının KENDİSİ `[data-theme="dark"]` bloğunda hâlâ eski
(Gece 2'de düzeltilmemiş) bir değer taşıyordu: `100 116 139` (slate-500),
en zor yüzeye (`--surface-2`) karşı sadece 3.79:1. Gece 2'nin kontrast
düzeltmesi `:root` (açık tema) ve `.surface-inverted`'ı (landing'in her
zaman koyu bloğu) düzeltmişti ama gerçek KOYU TEMANIN kendi
`--ink-subtle`'ını atlamıştı — bu token uygulamanın HER yerinde
kullanıldığı için sadece Sidebar değil, koyu temadaki her `text-ink-subtle`
kullanımı etkileniyordu.

**Düzeltme:** `index.css`'te `[data-theme="dark"]`'ın `--ink-subtle`'ı
`123 142 167`'ye çıkarıldı (`--surface-2`'ye karşı 4.64:1, `--surface-0`'a
karşı 5.39:1, `--surface-1`'e karşı 5.88:1 — hepsi ~4.55+ güvenlik payıyla).
`Sidebar.tsx`'teki TÜM ham gri sınıfları (`text-gray-400/500/600`,
`hover:text-white`, ternary'lerdeki `text-white`/`text-gray-200/300`)
token karşılıklarına taşındı (sadece renkli chip'ler üzerindeki —
bildirim rozeti, kullanıcı avatarı — sabit beyaz metin dokunulmadan
bırakıldı, onlar zaten her temada doğru).

**Canlı doğrulandı (`getComputedStyle`, koyu tema):** "Management" etiketi
artık 5.39:1. Bulgu 5'in admin sidebar "PLATFORM" etiketi de AYNI kök
token'ı kullandığı için (zaten `text-ink-subtle` idi, ham gri değildi)
bu düzeltmeyle bedavaya çözüldü — ayrıca doğrulandı: 5.39:1 koyu temada,
5.19:1 açık temada (zaten Gece 2'de düzgündü).

**Hâlâ kapsam dışı bırakılan (yeni not):** Uygulama genelinde 35 dosyada
hâlâ ham `text-gray-*`/`bg-gray-*`/`border-gray-*` kullanımı var (brief'in
Bölüm G.3 taraması bunları buldu) — çoğu bu gece hiç dokunulmayan, eski
CareDental sayfaları (modal'lar, yasal sayfalar, ödeme sayfaları vb.).
Kör bir mekanik değiştirme riskli (her dosyanın kendi zemin bağlamı
doğrulanmadan) — ayrı, dosya listesi hazır bir iş olarak bırakıldı.

---

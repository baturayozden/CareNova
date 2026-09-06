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

## B7 — CareNova'nın 7 klinik rolü (klinik_sahibi/operasyon_muduru/...) backend'de hiç yok

**Ne oldu:** Bölüm E'ye başlarken fark ettim: `klinik_sahibi`,
`operasyon_muduru`, `hasta_danismani`, `doktor`, `koordinator`, `tercuman`,
`muhasebe` — CARENOVA-STRATEJI.md'nin ve Bölüm C.10'un (admin konsolu
Kullanıcılar sekmesi) tanımladığı 7 klinik rolü — backend'in HİÇBİR
yerinde yok. `backend/src/routes/clinics.js`'teki `ROLE_IDS` hâlâ
CareDental'ın eski rolleri (`director`, `clinic_admin`, `receptionist`,
`dentist`, `treatment_coordinator`, `sales`). Bu 7 rol şu ana kadar SADECE
frontend'de, admin konsolunun demo verisinde (`adminDemoData.ts`) var —
gerçek bir backend karşılığı yok.

**Neden düzeltmedim:** Rol sistemini değiştirmek (yeni migration, `ROLE_IDS`
haritası, ~20 route dosyasındaki `requireRole(...)` çağrılarının hepsinin
güncellenmesi, mevcut kullanıcı verisinin taşınması) tek başına bir gecelik
iş — Bölüm E'nin "vakit kalırsa" bütçesine sığdırmak yerine, `caseFiles.js`/
`branchTemplates.js`'i tenant_id üzerinden (rol adından bağımsız) izole
ettim; rol-özel yetkilendirme (örn. "sadece doktor uygunluk kararı verebilir")
şu an HİÇBİR route'ta zorlanmıyor.

**Ne gerekiyor:** Ayrı bir migration + `ROLE_IDS` güncellemesi + ilgili
route'ların rol kontrollerinin CareNova'nın 7 rolüne taşınması. Şimdilik
`req.user.tenantId` üzerinden izolasyon güvenli, ama rol-bazlı yetki
(örn. sadece `doktor` case durumunu `awaiting_doctor`'dan ileri taşıyabilir)
YOK.

**Aciliyet:** Orta — tenant izolasyonu (asıl güvenlik sınırı) sağlam, ama
rol-bazlı yetkilendirme backend'e gerçek endpoint'ler eklendikçe (Bölüm E'nin
devamı) mutlaka gelmeli.

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

## B5 — Impersonation'ın "yazma işlemleri engellenir" kuralı doğrulanamadı

**Ne oldu:** GECE-2-BRIEFI.md Bölüm C.10, impersonation aktifken tüm yazma
işlemlerinin salt-okunura dönmesini istiyor. `admin/ImpersonationContext.tsx`
bu kuralı belgeliyor ama ZORLAMIYOR — çünkü demo modunda zaten HİÇBİR
gerçek API çağrısı yok (hepsi `demoAdapter.ts` üzerinden mock). Test
edilecek bağımsız bir "gerçek yazma" yolu yok, bu yüzden "engellendiğini"
göstermenin bir anlamı da yok (zaten hiçbir şey yazılmıyor).

**Ne gerekiyor:** Bölüm E'nin backend'i (gerçek `/api/admin/*` uçları)
geldiğinde, bu kural gerçek middleware seviyesinde uygulanmalı — bir
impersonation session token'ı taşıyan isteklerde POST/PUT/PATCH/DELETE
uçlarını 403 ile reddet, sadece GET'e izin ver.

**Aciliyet:** Orta — backend olmadan test edilemez, ama backend geldiğinde
gerçek bir güvenlik kuralı, atlanmamalı.

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

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

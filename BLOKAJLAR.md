# Blokajlar — Baturay'ın müdahalesi gerekiyor

## B1 — Canlı URL Vercel SSO duvarının arkasında (aciliyet: yüksek, 30 saniye)

**Ne oldu:** Build başarılı, deployment "Ready" durumunda, içerik doğru (CareNova
markası, doğru title). Ama URL'e giden HERKES (ben dahil, giriş yapmamış tarayıcı)
`https://vercel.com/sso-api?...` adresine 302 ile yönlendiriliyor — yani proje
**Vercel Deployment Protection / Vercel Authentication** ile korunuyor. Sadece
Vercel hesabına giriş yapmış ve bu projeye yetkili biri (örn. sen, tarayıcında
zaten giriş yapmışken) sayfayı görebiliyor. Sabah "tıklanabilir canlı bir URL"
kriteri teknik olarak build/deploy açısından karşılandı ama link, giriş yapmamış
biri için (örn. bir yatırımcıya paylaşmak) çalışmayacak.

**Ne denedim:**
- `https://carenova-owfx5aiu6-baturay-ozden-s-projects.vercel.app` (production deployment) → 302 → `vercel.com/sso-api`
- `https://carenova-baturay-ozden-s-projects.vercel.app` (proje alias'ı) → aynı 302
- Brief'in kesin kuralı gereği (bkz. GECE-CALISMA-BRIEFI.md §2.2: "CLI'yi sadece
  OKUMA için kullanabilirsin") bu bir proje AYARI değişikliği olduğu için
  `vercel` CLI veya API ile bunu kendim KAPATMADIM — salt-okunur sınırın dışına
  çıkardı.

**Ne gerekiyor (30 saniyelik tek tık):**
1. https://vercel.com/baturay-ozden-s-projects/carenova/settings/deployment-protection
2. "Vercel Authentication" (veya "Deployment Protection") → **Disabled** / "Only Preview Deployments" yap (Production'ı herkese açık bırak)
3. Kaydet — mevcut deployment'ı yeniden build etmeye gerek yok, ayar anında etkili olur.

**Etkisi:** Şu an sadece Baturay'ın kendi Vercel oturumu üzerinden linke
girenler görebiliyor. Herkese açık paylaşım (yatırımcı, ekip, telefon üzerinden
giriş yapılmamış tarayıcı) şu an ÇALIŞMIYOR.

**Aciliyet:** Yüksek — brief'in #1 önceliği ("canlı URL en geç 3. iş paketinde
çıkmalı") teknik olarak karşılandı ama "tıklanabilir" kriteri tam karşılanmıyor.

**Güncel URL:** `https://carenova-owfx5aiu6-baturay-ozden-s-projects.vercel.app`
(her yeni push sonrası değişebilir — `GECE-LOG.md`'nin en üstünde güncel tutulacak)

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

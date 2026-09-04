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

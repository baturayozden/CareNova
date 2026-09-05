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

## B3 — carenova-two.vercel.app 404 veriyor + hesapta beklenmedik "frontend"/"backend" projeleri (aciliyet: yüksek)

**Ne oldu:** İlk canlı link paylaşıldıktan sonra kullanıcı `carenova-two.vercel.app`
adresinde `404: NOT_FOUND` (`x-vercel-error: NOT_FOUND`) aldı. Aynı anda Vercel'den
"Production deployment failed" e-postası geldi (commit 3f51e31 / sonra 6583b93
için — kök dizin `install`/`build` komutlarını tek bir zincirlenmiş script'te
birleştirmemden kaynaklanan kırılgan bir yapılandırma; `343ef40` commit'inde
Vercel'in kendi ayrı installCommand/buildCommand fazlarına geçirilerek
düzeltildi ve doğrulandı — yeni deploy `Ready`).

Ayrı bir bulgu: `vercel alias ls` çıktısında, projeler listesinde **9 dakika önce
oluşturulmuş** `frontend` ve `backend` adında, `carenova`dan bağımsız iki YENİ
proje görüldü. Ben bu oturumda hiçbir zaman `vercel deploy`/`vercel link`/
`vercel --prod` çalıştırmadım (brief §2.2 yasağına uyuldu) — bu projelerin nasıl
oluştuğunu bilmiyorum, muhtemelen kullanıcının kendi troubleshooting denemesi.

`vercel alias ls` çıktısı `carenova-two.vercel.app`'in doğru deployment'a
(`carenova-eeprusvu6-...`, Ready) işaret ettiğini gösteriyor ama gerçek HTTP
yanıtı 404 — yani alias tablosu ile edge routing arasında bir tutarsızlık var.
Bu tutarsızlığın yeni "frontend"/"backend" projeleriyle ilişkili olup olmadığı
belirsiz.

**Ne denedim:** `vercel domains inspect` (yetki hatası — bu araç top-level custom
domain'ler için, `.vercel.app` alt-domain'leri için değil), `vercel alias ls`
(salt-okunur, çalıştı), tekrar tekrar `curl` ile 3 kez doğrulama (hep 404).
Domain/alias ayarlarını DEĞİŞTİRMEDİM — bu benim salt-okunur CLI sınırımın dışında.

**Ne gerekiyor:**
1. `vercel.com/baturay-ozden-s-projects/carenova/settings/domains` → `carenova-two.vercel.app`'in gerçekten `carenova` projesine bağlı olduğunu doğrula.
2. Eğer kasıtlı oluşturulmadıysa `frontend` ve `backend` projelerini incele/sil.
3. Şimdilik çalışan linkler: `https://carenova-baturay-ozden-s-projects.vercel.app` veya `https://carenova-git-main-baturay-ozden-s-projects.vercel.app` (ikisi de B1'deki SSO duvarına takılıyor, ayrı konu).

**Etkisi:** Kullanıcının ilk denediği kısa link çalışmıyor; alternatif linkler çalışıyor (B1 çözülünce herkese açık olacaklar).
**Aciliyet:** Yüksek — canlı URL'in "tıklanabilir" olması gece brifinginin #1 önceliği.

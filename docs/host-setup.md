# Üç-host kurulumu — Baturay'ın yapması gerekenler

CareNova tek bir Vercel projesi (`carenova`), tek bundle, üç mod: `marketing`
(carenova.ai), `app` (app.carenova.ai — klinik kullanıcıları), `admin`
(admin.carenova.ai — süper admin). Hangi modun aktif olduğu
`frontend/src/config/hosts.ts`'te çözümlenir; Claude Code'un Vercel panelinde
domain ekleme/env değişkeni ayarlama erişimi yok, bu adımlar elle yapılmalı.

## 1. Test URL'lerini bağla (gerçek domain beklemeden)

Vercel → `carenova` projesi → **Settings → Domains → Add**:

```
carenova-app.vercel.app
carenova-admin.vercel.app
```

Bunlar `*.vercel.app` alt alanlarıdır, DNS gerektirmez — müsaitse anında
bağlanır. İsim alınmışsa `carenova-app-tr.vercel.app` gibi bir varyant dene
ve hangisini seçtiğini not al (kodun host-prefix fallback'i `carenova-app*`/
`carenova-admin*` desenini tanır, tam adı önemli değil, `app`/`admin` ile
başlaması yeterli).

## 2. Environment Variables (Production + Preview)

Vercel → **Settings → Environment Variables**:

```
REACT_APP_MARKETING_URL = https://carenova-two.vercel.app
REACT_APP_APP_URL       = https://carenova-app.vercel.app
REACT_APP_ADMIN_URL     = https://carenova-admin.vercel.app
REACT_APP_DEMO_MODE     = true
```

(Yukarıdaki `carenova-two` mevcut ana proje URL'in — `vercel ls carenova` ile
teyit et, değişmiş olabilir.)

## 3. Redeploy — ZORUNLU

**Deployments → son deployment → ⋯ → Redeploy.**

CRA'nın environment variable'ları BUILD SIRASINDA gömülür — yukarıdaki
değişkenleri kaydetmek tek başına hiçbir şeyi değiştirmez, bir sonraki
build'e kadar. Redeploy etmeden test edersen eski (boş) değerlerle
çalışmaya devam eder.

## 4. Test et

Redeploy sonrası üç URL de kendi modunda açılmalı:
- `https://carenova-two.vercel.app` → landing sayfası
- `https://carenova-app.vercel.app` → doğrudan `/login`'e yönlenir (klinik girişi)
- `https://carenova-admin.vercel.app` → doğrudan `/login`'e yönlenir (platform girişi)

## 5. Domain'ler eklenene kadar (veya env unutulursa) — demo modu fallback'i

`hosts.ts`, `REACT_APP_DEMO_MODE=true` iken `?host=app` / `?host=admin` /
`?host=marketing` query parametresini de tanır (localStorage'a yazılır,
gezinirken kaybolmaz; `?host=reset` temizler). Yani ana URL'den bile test
edilebilir:

```
https://carenova-two.vercel.app/?host=app      → klinik girişi
https://carenova-two.vercel.app/?host=admin    → platform girişi
```

**Bu SADECE demo modunda çalışır** — üretimde (`REACT_APP_DEMO_MODE=false`
olduğunda) query parametresi hiçbir şeyi değiştirmez, tek sinyal hostname
olur (kod tarafında da böyle zorlanıyor, bkz. `hosts.ts` yorumları).

## 6. Admin girişini test etme (demo modu)

Admin login formuna herhangi bir e-posta/şifre girmek platform süper-admin
olarak giriş yapar — GERÇEK ROL KONTROLÜ demo modunda da çalışır ama test
edilebilmesi için bir kaçış yolu var: e-postaya "clinic" geçen bir değer
gir (örn. `clinic-owner@test.com`) — bu, klinik rolünde bir kullanıcı
simüle eder ve "Bu panel platform yöneticileri içindir" red ekranını
gösterir. Gerçek backend'de bu ayrım gerçek `role` alanına göre olur,
e-posta metnine göre değil — bu sadece backend olmadan iki yolu da
görebilmen için bir demo-modu kısayolu (`lib/demoAdapter.ts`).

## ÜRETİME GEÇERKEN

Yukarıdaki değerler `app.carenova.ai` / `admin.carenova.ai` olacak; DNS
adımları `docs/domain-setup.md`'de. **`carenova.ai` kök domain'ine (canlı
WordPress sitesi) dokunma** — sadece `app.`/`admin.` alt alanları ekleniyor.

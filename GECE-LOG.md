# CareNova Gece Çalışma Logu — 2026-09-04/05

## Özet
(sabah en üstte okunacak 5 satır — Paket 9'da doldurulacak)

## Canlı URL
(deploy edildiğinde buraya yazılacak)

---
## [23:05] PAKET 0 — Hazırlık
**Yapıldı:**
- `CARENOVA-STRATEJI.md` (857 satır) ve `CLAUDE-CODE-PROMPTS.md` (16 KOMUT) okundu. Strateji belgesinin ikinci yarısı (Bölüm 8-13) ve komut belgesinin tamamı bir alt-ajanla (context tasarrufu için) çıkarıldı ve özümsendi.
- `caredental` kaynak kod yapısı incelendi (SADECE okundu, dokunulmadı):
  - `backend/src/`: config, db, lib, middleware, migrations, routes, scripts, services, store, templates, utils
  - `frontend/src/`: assets, components (landing dahil), context, data, hooks, lib, pages, utils
  - `backend/.env.example`: Node/PORT, DATABASE_URL (Supabase Postgres), JWT_SECRET/JWT_REFRESH_SECRET, APP_URL/ADMIN_URL, WhatsApp Cloud API (ACCESS_TOKEN/PHONE_NUMBER_ID/WEBHOOK_VERIFY_TOKEN/API_VERSION), ANTHROPIC_API_KEY, OPENAI_API_KEY, RESEND_API_KEY, SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY, CLINIC_API_SECRET.
  - Not: Kök `CLAUDE.md`'de SMTP_* env değişkenlerinden bahsediliyor ama gerçek `.env.example` Resend kullanıyor — kod gerçeği, doküman güncel değil. CareNova'ya kopyalarken gerçek `.env.example`'ı esas alacağım.
- `caredental` kökünde `.vercel/` klasörü mevcut — **kesinlikle kopyalanmayacak ve dokunulmayacak.**
**Karar:** Ortam kontrolü ve doküman okuma paralel ajanlarla yapıldı, context tasarrufu için.
**Not:** —
**Commit:** (bu paket için commit yok, CareNova henüz git reposu değil)

---
node: v26.0.0
npm: 11.12.1
git: git version 2.50.1 (Apple Git-155)
gh auth: logged in as baturayozden, protocol https, scopes gist/read:org/repo/workflow
vercel CLI: 59.11.7

---
## [23:15] PAKET 1 — Fork, temizlik, marka
**Yapıldı:**
- `rsync` ile caredental → CareNova kopyalandı (brief'teki hariç listesiyle). Kopya sonrası fark edilen ekstra sorunlar da temizlendi: `.claude/worktrees/` altında caredental'ın 6.4MB'lık kırık/eski git worktree kalıntıları (untracked, kopyalanmaması gerekirdi) silindi; `.github/workflows/auto-blog.yml` ve `appointment-reminders.yml` (CareDental'a özel, backend deploy edilmeyecek, secret'sız kalacaktı) kaldırıldı.
- `.gitignore` düzeltildi: `.env.*` deseni `.env.example`'ı da yutuyordu, `!.env.example` istisnası ve `build/`/`dist/` eklendi.
- Git reposu kuruldu: `git init`, `main` branch, `origin` → `https://github.com/baturayozden/carenova.git` (henüz push edilmedi — PAKET 2'de).
- **Diş-spesifik temizlik** (`docs/dental-cleanup-inventory.md`'de tam liste): `ai.js` sistem prompt'u generic sağlık asistanına çevrildi, `DENTAL EXPERTISE` bloğu kaldırıldı, senaryo/itiraz regex'leri genelleştirildi; `leadScoring.js`'deki sabit diş puanları (implant=25 vb.) branş-bağımsız `treatment_value_weight` kolonuna taşındı (migration 055); varsayılan saat dilimi `Europe/London` → `Europe/Istanbul`; `£` → `€` (34 dosya, mekanik).
- **Marka:** 71+20 dosyada `CareDental`/`caredental` → `CareNova`/`carenova` (2 geçişte, ilk grep case-sensitive olduğu için bazı lowercase-only dosyalar ıskalandı, ikinci geçişte yakalandı). `CareDentalIcons.tsx` → `CareNovaIcons.tsx` (×2 dosya). Tailwind'e `brand`/`accent`/`surface`/`ink` semantic token'ları eklendi (Bölüm 4 paleti) — mevcut `navy`/`gold` dashboard token'ları **kasıtlı olarak korundu**, kaldırılmadı (bkz. karar). Google Fonts'a Fraunces + Hanken Grotesk eklendi. Yeni CareNova SVG wordmark'ları (açık/koyu/transparan) + favicon yazıldı; PNG/ICO ImageMagick ile üretildi ama metin glifleri render olmadı (CLI font sorunu — sadece düz renkli kare çıktı, tarayıcıda SVG'ler doğru görünüyor).
- `frontend/src/components/landing/` altındaki 11 CareDental pazarlama bölümü silindi; `LandingPage.tsx` boş placeholder'a indirgendi. NavBar/Footer minimal + marka-nötr halleriyle yeniden yazıldı (About/Blog/Contact/Careers/legal sayfaları bunlara bağımlıydı, silinirse build kırılırdı).
- `frontend/src/lib/businessDetails.ts` ve `organizationSchema.ts`: CareDental'ın gerçek İngiltere tüzel kişiliği (B4MIND Ltd, Londra adresi, Companies House/ICO alanları, gerçek sosyal medya linkleri) tamamen temizlendi — CareNova'nın henüz tüzel kişiliği yok (Strateji Bölüm 9, TR şirketi öneriliyor). Alanlar KVKK/MERSİS'e uygun isimlerle (`taxOrCompanyNumber`, `kvkkVerbisNumber`) boş olarak yeniden oluşturuldu.
- Kök `CLAUDE.md`, `README.md`, `AGENTS.md` CareNova için sıfırdan yazıldı (4 zorunlu kural dahil: diş varsayımı yok, i18n zorunlu, AI yetki matrisi bypass edilemez, hasta verisi model eğitiminde kullanılamaz).
- **Kabul kriteri doğrulandı:** `cd frontend && npm install --legacy-peer-deps && npm run build` → `Compiled successfully`, exit 0.

**Karar:**
- `navy`/`gold` renk skalası KALDIRILMADI — mevcut dashboard'un ~30 sayfası yoğun kullanıyor, tam re-tema riskli ve bu gecenin önceliği değil (öncelik: canlı URL + landing + demo panel). Sadece yeni `brand`/`accent`/`surface`/`ink` token'ları eklendi, landing + yeni UI bunları kullanacak.
- Tam per-tenant `currency` altyapısı (migration + format helper) kurulmadı, sadece görünen `£`→`€` sed değişikliği yapıldı — brief'in "yapılandırılabilir" isteğinin tam derinliği ayrı bir iş paketi gerektiriyor, TODO olarak `docs/dental-cleanup-inventory.md`'ye yazıldı.
- `.claude/worktrees/` ve `.github/workflows/` brief'in hariç listesinde yoktu ama kopya sonrası tespit edildi ve mantıken temizlenmesi gerektiği için silindi (worktree'ler bozuktu, workflow'lar deploy edilmeyecek backend'e bağımlıydı).

**Not:** `ai-prompts/en_initial_outreach.md` içinde hâlâ diş-spesifik dil var ama kod tarafından hiç yüklenmiyor (statik referans dosyası) — düşük öncelik, dokunulmadı.
**Commit:** `0e03aa2` chore: fork CareDental and rebrand to CareNova, strip dental-specific assumptions

---

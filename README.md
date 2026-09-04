# CareNova

**AI hasta güven ve dönüşüm platformu — Türkiye sağlık turizmi klinikleri için.**

Bir hasta bir kliniğe WhatsApp'tan yazıp randevu almadan vazgeçtiğinde, CareNova'nın çok dilli AI'ı (TR/EN/AR/DE/RU) saniyeler içinde kendi dilinde cevap verir, vakayı branşa özel bir fiyat-yetki matrisine göre nitelendirir, doktor onaylı kilitli bir teklife yönlendirir ve hasta eve döndükten sonra bir yıl boyunca bakım hattıyla takip eder. Bir CRM değil — reklam bütçesi ile rezerve edilmiş, elde tutulan hasta arasındaki güven altyapısı.

CareNova, [CareDental](https://github.com/baturayozden/caredental)'ın (İngiltere diş klinikleri için çalışan bir SaaS, ~47k satır) fork'udur. Ürün stratejisi için `CARENOVA-STRATEJI.md`'ye, fork sırasında nelerin genelleştirildiğine/kaldırıldığına dair tam listeye `docs/dental-cleanup-inventory.md`'ye bakın.

---

## Teknoloji

| Katman | Teknoloji |
|---|---|
| Frontend | React (TypeScript), Create React App, TailwindCSS |
| Backend | Node.js, Express |
| Mesajlaşma | WhatsApp Cloud API (Meta) |
| AI | Anthropic Claude (`claude-sonnet-4-5`) |
| Veritabanı | PostgreSQL |
| Ödeme | Stripe / Square / Atoa (CareDental'dan taşındı) |
| Barındırma | Vercel (frontend, `carenova` projesi) |

---

## Proje yapısı

```
CareNova/
├── frontend/          # Klinik ekibi için React panosu + genel erişilebilir sayfalar
├── backend/           # Express API + WhatsApp webhook + AI motoru
│   └── src/
│       ├── services/ai.js         # AI yanıt motoru, prompt derleyici
│       ├── services/leadScoring.js
│       ├── routes/whatsapp.js     # Webhook doğrulama + mesaj alımı
│       └── migrations/            # Numaralı SQL şema göçleri
├── docs/
│   └── dental-cleanup-inventory.md
├── CARENOVA-STRATEJI.md   # Ürün stratejisi ve pazar analizi
├── CLAUDE-CODE-PROMPTS.md # Yapım komutları (KOMUT 0-15)
├── GECE-LOG.md            # Gece çalışma günlüğü
└── BLOKAJLAR.md           # Müdahale gerektiren açık noktalar
```

---

## Hızlı başlangıç

### Backend

```bash
cd backend
cp .env.example .env       # gerçek anahtarları doldurun
npm install
npm run dev                # http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm start                  # http://localhost:3000
```

Demo modunda (`REACT_APP_DEMO_MODE=true`) frontend backend'e hiç istek atmaz, seed edilmiş Türkiye sağlık turizmi verisiyle çalışır.

---

## Ortam değişkenleri

Güncel ve otoriter liste için `backend/.env.example` ve `frontend/.env.example`'a bakın. Öne çıkanlar: `DATABASE_URL`, `JWT_SECRET`/`JWT_REFRESH_SECRET`, `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `ANTHROPIC_API_KEY`, `REACT_APP_API_URL`, `REACT_APP_DEMO_MODE`.

**`caredental/backend/.env`'deki gerçek anahtarları asla CareNova'ya kopyalamayın** — iki ürün aynı WhatsApp hattını, veritabanını veya AI anahtarını paylaşmamalı.

---

## Diller

Arayüz varsayılan dili **Türkçe**. AI destekli hasta mesajlaşması: Türkçe, İngilizce, Arapça, Almanca, Rusça (ilk dalga — bkz. CARENOVA-STRATEJI.md Bölüm 2.3).

# Demo tenant tohumlama

CareNova'nin uydurma demo verisini **gercek satirlar** olarak veritabanina yazar.
Veri `is_demo = true` isaretli tek bir tenant altinda toplanir (migration 065),
boylece demo/gercek ayrimi frontend'in import yoluna degil, satirin kendisine bagli olur.

## Dosyalar

| Dosya | Ne |
|---|---|
| `demo-seed-data.json` | Veri. `frontend/src/data/caseData.ts`'ten **uretilir** — elle duzenleme. |
| `generate-seed-sql.js` | JSON'dan duz SQL uretir (`seed-demo-tenant.sql`). |
| `seed-demo-tenant.sql` | Uretilmis SQL. Veritabanina dogrudan baglanamayan ortamlar icin (Supabase SQL Editor). **Elle duzenleme — jeneratoru duzenle.** |
| `seed-demo-tenant.js` | Node tohumlayici (uygulama tarafi demo klinigi, 18 vaka). `--purge` ile **her seyi** geri alir — asagidaki demo platformu dahil. |
| `demo-platform-seed-data.json` | Admin konsolunun demo platformu (11 klinik). `frontend/src/data/adminDemoData.ts`'ten **uretilir** (`generate-admin-seed-data.js`). |
| `generate-admin-seed-data.js` | adminDemoData.ts'i TypeScript'ten derleyip JSON'u yazar. `--check` JSON bayatsa hata verir. |
| `demo-platform-seed.js` | Platform tohumlama/silme mantigi. Neyin gercek, neyin sentetik oldugu dosyanin basinda. |
| `seed-demo-platform.js` | Platform CLI: tohumla / `--dry-run` (ROLLBACK) / `--purge`. |

## Kullanim

```
# 1) Migration'lar guncel olmali (065-070 dahil; 067 plan kisiti, 068 demo_requests,
#    069 tenant profili, 070 audit_logs tetikleyicisi — 070 olmadan hicbir kullanici
#    ya da tenant silinemez, --purge dahil)
node backend/migrate-schema.js

# 2a) DB'ye erisim varsa:
node backend/scripts/seed-demo-tenant.js              # uygulama demo klinigi
node backend/scripts/seed-demo-platform.js --dry-run  # platform: calistir, ROLLBACK
node backend/scripts/seed-demo-platform.js            # platform: tohumla
node backend/scripts/seed-demo-tenant.js --purge      # HEPSINI geri al

# 2b) Erisim yoksa: seed-demo-tenant.sql icerigini Supabase SQL Editor'e yapistir
```

## Giris kullanicisi

SQL yolu `demo@carenova.ai` kullanicisini **kullanilamaz** bir parola hash'iyle
olusturur. Gercek parolayi ayrica ver:

```
cd backend && ADMIN_EMAIL=demo@carenova.ai node scripts/set-admin-password.js
```

Parola gizli girdiden okunur, kabuk gecmisine dusmez.

## caseData.ts degisirse

```
# frontend/src/data/caseData.ts -> demo-seed-data.json yeniden uretilmeli,
# sonra generate-seed-sql.js calistirilmali. Ikisi ayrisirsa demo ekranlari
# ile veritabani farkli seyler gosterir.
```

## Demo platformu (admin konsolu)

11 klinik, hepsi `is_demo = true`, slug `demo-…`. carenova-demo (uygulama tarafi, 18 vaka)
**12. demo klinik** olarak ayri kalir: gercek vaka satirlari ve giris kullanicisi olan tek
tenant o; admin verisini ona katmak iki ayri demo hikayesini tek tenant'ta karistirirdi.

- **Rakamlar turetilir.** AI kullanimi, 24 saatlik mesaj/hata, ilk yanit suresi `messages`
  tablosundaki **sentetik** satirlardan hesaplanir (icerik yok, token sayilari sabit
  ortalama: 1450 giris / 210 cikis). Maliyet bu token'lardan hesaplanir.
- **Zaman kayar.** Zaman damgalari tohumlama anina gore yerlestirilir; "son 24 saat" ertesi
  gun bosalir. **Demodan once yeniden tohumla** (idempotent).
- **Riza uydurulmaz.** Lead'lerde `gdpr_consent_given = false`; `tenant_compliance` Ek-1
  sayilari `NULL` ("henuz olculmuyor").
- **Denetim kaydi tohumlanmaz.** `audit_logs` veritabani duzeyinde append-only (070); oraya
  yazilan uydurma bir olay bir daha silinemez.
- **E-postalar** `@demo.carenova.ai`'ye yazilir; veri setindeki alan adlari gercek
  kisilere ait olabilir. Kullanici parolalari kullanilamaz hash — kimse giris yapamaz.
- **Guvenlik:** `--purge`, `is_demo = false` olan bir `demo-…` tenant gorurse hicbir sey
  silmeden durur.
- Veri setinin kendi celiskisi: Istanbul Onkoloji "0 mesaj, 3 hata" — hata bir mesajdir,
  tohum 3 basarisiz mesaj yazar (24 saatlik mesaj sayisi 3 gorunur).

## adminDemoData.ts degisirse

```
node backend/scripts/generate-admin-seed-data.js          # JSON'u yeniden uret
node backend/scripts/generate-admin-seed-data.js --check  # CI/elle: bayat mi?
```

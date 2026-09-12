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
| `seed-demo-tenant.js` | Node tohumlayici. `--purge` ile geri alir. DB'ye ag erisimi gerektirir. |

## Kullanim

```
# 1) Migration'lar guncel olmali (065 dahil)
node backend/migrate-schema.js

# 2a) DB'ye erisim varsa:
node backend/scripts/seed-demo-tenant.js          # tohumla
node backend/scripts/seed-demo-tenant.js --purge  # geri al

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

## Bilinen uyumsuzluk

`chk_tenants_plan_tier` kisiti hala CareDental'in paketlerini kabul ediyor
(`free/starter/growth/pro/enterprise`). CareNova'nin paketleri Solo / Klinik / Grup.
Kisit guncellenene kadar demo tenant `growth` olarak isaretleniyor.

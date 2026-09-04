# CareNova — Claude Code Yapım Komutları

**Kullanım:** Bu dosyadaki komutları sırayla Claude Code oturumuna yapıştır. Her komut bir öncekinin çıktısını varsayar — **sırayı atlama**. Her fazın sonunda commit at ve bir sonrakine geç.

**Ön koşul:** Claude Code oturumunu `/Users/baturayozden/projects/CareNova` klasöründe aç. `CARENOVA-STRATEJI.md` aynı klasörde olmalı — komutların çoğu ona referans veriyor.

**İşaretler:** 🔴 kritik yol · 🟡 önemli · ⚪ opsiyonel

---

## KOMUT 0 — Fork ve temel kurulum 🔴

```
CareNova adında yeni bir ürün kuruyoruz. Bu, /Users/baturayozden/projects/caredental
klasöründeki CareDental kod tabanının Türkiye sağlık turizmi pazarına uyarlanmış hali olacak.

Aynı klasördeki CARENOVA-STRATEJI.md dosyasını BAŞTAN SONA oku — ürünün tamamı orada tanımlı.
Özellikle Bölüm 7 (modüller) ve Bölüm 8 (ne taşınır/değişir/yeni yazılır) tablosunu referans al.

ŞİMDİ YAP:
1. caredental klasörünü CareNova'ya kopyala. .git, node_modules, .vercel, .playwright-mcp,
   .DS_Store, tüm caredental-handoff-*.md dosyalarını ve Marketing/ klasörünü HARİÇ tut.
2. Yeni bir git reposu başlat, ilk commit'i at.
3. package.json'lardaki isimleri carenova-backend / carenova-frontend olarak güncelle.
4. Kök dizinde CLAUDE.md dosyasını CareNova için sıfırdan yaz. İçinde şunlar olsun:
   - Ürünün ne olduğu (sağlık turizmi AI hasta dönüşüm platformu, TR pazarı)
   - CareDental'dan farkları (Bölüm 8 tablosunu özetle)
   - Workspace yapısı, komutlar, mimari
   - "Diş hekimliğine özel hiçbir varsayım kalmamalı" kuralı
   - "Arayüz varsayılan dili Türkçe, tüm yeni string'ler i18n üzerinden" kuralı
   - AI yetki matrisi kuralı (branşa göre AI fiyat verebilir/veremez)
5. README.md'yi CareNova için yeniden yaz.

Henüz kod mantığına DOKUNMA. Sadece iskeleti kur ve ne yapacağını bana özetle.
```

---

## KOMUT 1 — Diş-spesifik temizlik 🔴

```
CareNova kod tabanında CareDental'dan miras kalan tüm diş hekimliğine özel varsayımları bul
ve işaretle. Şu an SİLME — önce bir envanter çıkar.

ARA:
- backend/src/services/ai.js içindeki sistem prompt'unda diş terminolojisi
  ("dental practice assistant", implant/veneer/Invisalign listeleri, "dental anxiety")
- backend/src/services/leadScoring.js içindeki diş işlem değerleri (implant=25, veneers=20...)
- clinic_knowledge kategorileri ve seed verileri
- clinic_ai_settings escalation_keywords (diş acilleri: bleeding, swelling, broken)
- frontend'deki tüm "dental", "clinic", "tooth", "smile" geçen metin ve ikonlar
- CareDentalIcons.tsx
- landing/ ve frontend/src/components/landing/ altındaki tüm pazarlama kopyası
- Fiyat kuralındaki £ para birimi varsayımı
- Europe/London varsayılan saat dilimi

ÇIKTI: docs/dental-cleanup-inventory.md dosyasına dosya:satır bazında bir liste yaz.
Her madde için "sil", "genelleştir" veya "branş şablonuna taşı" etiketi koy.
Bana özet ver, sonra onayımı bekle.
```

---

## KOMUT 2 — Marka, tema ve landing temizliği 🟡

```
CareNova'nın görsel kimliğini kur ve CareDental markasını tamamen sök.

1. Tüm "CareDental" geçen string, dosya adı, asset ve yorumu "CareNova" yap.
   frontend/src/assets/ altındaki logoları placeholder CareNova SVG'leriyle değiştir.
2. Renk paletini güncelle. CareDental navy+gold kullanıyor. CareNova için:
   - Ana: derin petrol/teal (#0E4F52 ailesi)
   - Aksan: sıcak amber (#D99A2B ailesi)
   - Zemin: kemik beyazı (#F7F4EF) açık tema, koyu tema #0A1A1C
   tailwind.config.js'de semantic token olarak tanımla (brand, accent, surface, ink),
   hardcoded hex kullanma.
3. frontend/src/components/landing/ altındaki TÜM bölümleri sil ve yerine
   boş placeholder bileşenler koy. Landing kopyası KOMUT 14'te yazılacak.
4. SEOMeta ve sitemap generator'ı CareNova için güncelle, dil alternatifleri (hreflang)
   için hazır hale getir.

Değişiklikleri commit et.
```

---

## KOMUT 3 — Kullanıcıları ve refresh token'ları PostgreSQL'e taşı 🔴

```
CareDental'ın bilinen teknik borcu: kullanıcılar backend/src/store/users.js içinde
in-memory Map'te, refresh token'lar backend/src/utils/tokens.js içinde Set'te tutuluyor.
Sunucu her yeniden başladığında kayboluyorlar. CareNova'da bu kabul edilemez.

YAP:
1. users tablosu için migration yaz (varsa mevcut 003_create_roles_and_users.sql'i incele —
   tablo şeması zaten olabilir, sadece store katmanı bypass ediyor olabilir).
   Kontrol et ve gerçek durumu bana söyle.
2. src/store/users.js'i PostgreSQL destekli bir repository ile değiştir.
   API yüzeyini (fonksiyon imzalarını) koru ki çağıran kodlar değişmesin.
3. refresh_tokens tablosu ekle: id, user_id, token_hash, expires_at, revoked_at,
   created_at, user_agent, ip. Token'ı düz metin DEĞİL hash'lenmiş sakla.
4. Rotasyonda eski token'ı revoke et, yeniden kullanım denemesini tespit edip
   o kullanıcının tüm token'larını iptal et (token reuse detection).
5. Süper admin seed'ini idempotent bir migration'a taşı.
6. Testleri yaz: kayıt, giriş, yenileme, rotasyon, yeniden kullanım tespiti.

Bu güvenlik açısından kritik — dikkatli ol ve testleri geçirmeden bitirme.
```

---

## KOMUT 4 — i18n altyapısı (TR/EN) 🔴

```
CareNova arayüzü Türkçe ve İngilizce olmalı, VARSAYILAN TÜRKÇE. Şu an frontend'de
hiç i18n yok — tüm metinler JSX içinde sabit İngilizce (~47k satır kod, tahmini 600-900 string).

YAP:
1. react-i18next + i18next-browser-languagedetector kur.
2. frontend/src/i18n/ altında namespace'li JSON yapısı:
   locales/tr/{common,auth,cases,patients,settings,billing,doctors,travel,aftercare}.json
   locales/en/ aynı yapı.
3. Dil tespiti sırası: kullanıcı tercihi (DB) → localStorage → tarayıcı → tr (fallback).
4. Kullanıcı tercihini users tablosuna ekle (locale kolonu) ve ayarlar sayfasına dil seçici koy.
5. Tarih, saat, sayı ve para birimi için Intl tabanlı yardımcılar yaz
   (frontend/src/utils/format.ts). date.ts'i buna göre güncelle.
6. ESLint kuralı ekle: JSX içinde hardcoded string yazımını uyar (react/jsx-no-literals
   veya i18next/no-literal-string), yeni kodda ihlali engelle.

ŞİMDİLİK mevcut ekranları ÇEVİRME. Sadece altyapıyı kur ve Layout + Sidebar + LoginPage'i
örnek olarak i18n'e geçir. Kalan ekranlar ilgili modül üzerinde çalışırken çevrilecek.
```

---

## KOMUT 5 — Vaka Dosyası (Case File) veri modeli 🔴

```
CARENOVA-STRATEJI.md Bölüm 7 / M1'i oku. Sağlık turizminin merkezi kavramı "vaka" (case) —
CareDental'ın lead modeli yerel randevu için tasarlanmış, yetersiz.

Mevcut leads, patients ve cases (caseStore.js) yapısını incele ve bana raporla:
hangisi genişletilebilir, hangisi yeniden tasarlanmalı.

SONRA migration'ları yaz:

cases (veya mevcut cases genişletilir):
  id, tenant_id, patient_id, case_number (insan okunur, örn CN-2026-0142),
  branch_key (branş şablonu referansı), status (enum, aşağıda),
  source_channel, source_campaign, assigned_consultant_id, assigned_doctor_id,
  assigned_coordinator_id, assigned_interpreter_id,
  patient_country, patient_language, patient_timezone,
  medical_eligibility (pending|eligible|conditional|ineligible),
  eligibility_note, eligibility_decided_by, eligibility_decided_at,
  currency, estimated_value, created_at, updated_at, deleted_at

status enum:
  new, qualified, pre_assessment, awaiting_doctor, quoted, awaiting_deposit,
  reserved, travel_planned, arrived, treated, returned, in_aftercare, completed,
  lost, medically_ineligible

case_companions: id, case_id, name, relationship, phone, flight_info, notes
case_media: id, case_id, kind(photo|scan|report|document), whatsapp_media_id,
            storage_path, template_slot_id, quality_ok, ai_extraction jsonb,
            uploaded_at, uploaded_by
case_assessments: id, case_id, template_key, answers jsonb, completed_at
case_timeline: id, case_id, day_offset, title jsonb(i18n), starts_at, ends_at,
               location, type(consultation|procedure|checkup|transfer|flight|hotel)
case_events: id, case_id, event_type, actor_id, payload jsonb, created_at
             ← denetim izi, KVKK için kritik, append-only

leads tablosunu bozma — lead hâlâ ilk temas kaydı. Bir lead nitelendiğinde case doğar.
leads.case_id nullable FK ekle.

leads.language CHECK constraint'ini genişlet: en,tr,ar,de,ru,fr,es,pt,zh,az,fa,ro,uk,kk,sq,bg

Migration'ları numaralandırma sırasına uygun ekle (054'ten devam) ve migrate.js ile çalıştır.
Rollback yolunu da yaz.
```

---

## KOMUT 6 — Branş şablon motoru 🔴

```
CARENOVA-STRATEJI.md Bölüm 7 / M2'yi oku, özellikle "AI yetki matrisi" tablosunu.

CareNova branş-bağımsız olmalı: her klinik kendi branşını seçer, sistem o branşın
ön-değerlendirme sorularını, gerekli görsellerini, itirazlarını ve AI fiyat yetkisini yükler.

YAP:
1. branch_templates tablosu:
   key (pk, örn 'hair_transplant'), display_name jsonb (tr/en/ar/de/ru),
   pre_assessment_questions jsonb, required_media jsonb (her biri için çekim talimatı,
   çok dilli), ai_pricing_authority enum
   ('full'|'range_from_photo'|'range_after_imaging'|'qualification_only'|'logistics_only'),
   doctor_approval_scope jsonb, typical_stay_days, typical_cycle_days,
   red_flags jsonb, branch_objections jsonb, aftercare_schedule jsonb (gün offsetleri),
   knowledge_seed jsonb (bilgi bankası ön dolgu taslağı),
   is_system boolean, tenant_id nullable (null = sistem şablonu, dolu = kliniğe özel)

2. tenants tablosuna active_branch_keys text[] ekle.

3. Şu 3 sistem şablonunu SEED et (strateji belgesindeki AI yetki matrisine BİREBİR uy):
   - hair_transplant  → ai_pricing_authority: 'range_from_photo'
   - dental           → 'range_after_imaging'
   - aesthetic_surgery→ 'qualification_only'

   Her biri için gerçekçi ve eksiksiz içerik yaz:
   ön-değerlendirme soruları, gerekli görsellerin çekim talimatları (5 dilde),
   kırmızı bayraklar, branşa özel itirazlar, bakım hattı takvimi.
   Saç ekimi için strateji belgesindeki YAML örneğini temel al.

4. Sonraki şablonları iskelet olarak ekle (içerik boş, ai_pricing_authority doğru):
   eye_lasik ('qualification_only'), bariatric ('qualification_only'),
   ivf ('qualification_only'), orthopedics ('qualification_only'),
   cardiology ('logistics_only'), oncology ('logistics_only'),
   checkup ('full')

5. IVF şablonunun red_flags/notes alanına şu KRİTİK kuralı yaz:
   "Türkiye'de donör yumurta ve donör sperm yasal değildir. Hasta donör gamet ihtiyacı
   belirtirse AI bunu İLK yanıtta açıkça söylemeli ve hastanın vaktini harcamamalıdır."

6. Admin arayüzü: /settings/branches — klinik şablon seçer, sorularını ve
   çekim talimatlarını düzenleyebilir, kendi şablonunu türetebilir.
```

---

## KOMUT 7 — AI prompt derleyici ve yetki matrisi 🔴

```
CARENOVA-STRATEJI.md Bölüm 7 / M0.4 ve M2'yi oku.

backend/src/services/ai.js'deki buildSystemPrompt fonksiyonu şu an diş-spesifik sabit metin.
Bunu KATMANLI BİR DERLEYİCİYE dönüştür:

  [Evrensel çekirdek]      → ses tonu, WhatsApp formatı, dil kuralı, tıbbi çıkarım yasağı
  + [Mevzuat kalkanı]      → KVKK + Tanıtım Yönetmeliği kuralları (KOMUT 12'de dolacak,
                              şimdilik yer tutucu fonksiyon)
  + [Branş şablonu]        → branch_templates'ten derlenir
  + [Klinik bilgi bankası] → clinic_knowledge (mevcut mantık korunur)
  + [Vaka bağlamı]         → hasta ülkesi, dili, saat dilimi, yüklenen belgeler, önceki mesajlar
  + [Tarih/saat referansı] → hastanın saat diliminde (mevcut 14 günlük tarih haritası mantığı
                              korunur ama iki saat dilimli hale gelir)

KRİTİK — AI YETKİ MATRİSİ:
CareDental'daki "PRICE RULE"u genişlet. ai_pricing_authority değerine göre prompt'a
zorlayıcı kural enjekte et:

  'full'                → paket fiyatı verebilir, uçtan uca rezervasyon yapabilir
  'range_from_photo'    → görsel geldiyse ve kalite yeterliyse fiyat ARALIĞI verebilir,
                          kesin fiyat için doktor onayı gerektiğini söylemeli
  'range_after_imaging' → tıbbi görüntüleme (panoramik/CBCT/MR) yüklenmeden fiyat aralığı
                          bile veremez; önce görüntü ister
  'qualification_only'  → HİÇBİR fiyat veremez. Sadece nitelendirir, belge toplar,
                          doktor konsültasyonu önerir
  'logistics_only'      → satış çerçevesi kurmaz. Sadece randevu, seyahat, belge.
                          Fiyat, süreç veya sonuç vaadi YASAK

Bu kuralların ihlali CRITICAL FAILURE olarak prompt'ta işaretlensin — CareDental'daki
mevcut CRITICAL RULES formatını kullan.

AYRICA:
- MEDICAL INFERENCE RULE'u koru ve güçlendir: AI asla teşhis koymaz, uygunluk kararı vermez,
  greft sayısı/implant sayısı taahhüt etmez. Bunlar doktor onay kuyruğunun işi.
- LANGUAGE RULE'u koru.
- WHATSAPP FORMATTING RULE'u koru.
- Prompt derleyicinin çıktısını loglayan bir debug endpoint ekle (sadece admin).
- Prompt katmanları için unit test yaz: her yetki seviyesinde doğru kuralın enjekte
  edildiğini doğrula.
```

---

## KOMUT 8 — İtiraz taksonomisi ve lead skorlama kalibrasyonu 🟡

```
CARENOVA-STRATEJI.md Bölüm 7 / M0.7 ve M0.8'i oku.

1. İTİRAZ TESPİTİ
   backend/src/services/ai.js içindeki detectObjection'ın 8 diş itirazını, strateji
   belgesindeki 11 sağlık turizmi itirazıyla değiştir:
   price_shock, trust_surgeon, trust_clinic, safety_fear, aftercare_fear,
   travel_friction, timing, comparison_shopping, language_barrier,
   partner_approval, financing

   Her itiraz için branş şablonundaki branch_objections'tan yanıt stratejisi çekilsin.
   trust_surgeon ve safety_fear tespit edildiğinde: AI kendi başına kapatmaya çalışmasın,
   doktor kartını paylaşsın ve video konsültasyon önersin (KOMUT 10).

2. LEAD SKORLAMA
   backend/src/services/leadScoring.js'deki diş kalibrasyonunu değiştir:
   - Intent (35): tarih sordu mu, belge gönderdi mi, "kaç gün kalmam gerekir" dedi mi,
     uçuş/vize sordu mu
   - Aciliyet (15): izin tarihi belirtti mi, uçuş aradı mı
   - Değer (25): branş × işlem kapsamı × paket (branş şablonundan gelen tipik değer)
   - Yeterlilik (15): YENİ BOYUT — tıbbi ön eleme geçti mi, gerekli belgeler tam mı
   - Etkileşim (10): yanıt hızı, mesaj derinliği

   Etiketler: Sıcak / Ilık / Serin / Kayıp Riski
   Etiketler ve tag'ler i18n üzerinden gösterilsin, DB'de İngilizce key saklansın.

3. Sıcak lead alarmı (mevcut hot_alert mantığı) korunsun ama bildirim çok dilli olsun.
```

---

## KOMUT 9 — Ses notu ve görsel/belge anlama 🔴 EN YÜKSEK ETKİ

```
CARENOVA-STRATEJI.md Bölüm 7 / M0.2 ve M0.3'ü oku.

ŞU AN backend/src/routes/whatsapp.js şunu yapıyor:
  if (incomingMsg.type !== 'text' || !incomingMsg.text) return;
Yani ses, fotoğraf, belge — hepsi SESSİZCE ATILIYOR. Bu ürünün en büyük boşluğu.
Arapça ve Türkçe WhatsApp kullanımında sesli mesaj baskın davranış.

A) SES NOTU
1. whatsapp.js parseIncomingMessage'ı audio/voice tipini de döndürecek şekilde genişlet.
2. Meta Media API'den medyayı indir (GET /{media-id} → url, sonra authenticated download).
3. Transkribe et. Sağlayıcıyı env ile seçilebilir yap (OPENAI_WHISPER veya alternatif);
   arayüzü soyutla ki değiştirilebilsin. Dil otomatik tespit edilsin.
4. Transkripti normal AI hattına metin gibi ver. case_media'ya kaydet
   (kind='audio', ai_extraction={transcript, detected_language, confidence}).
5. Sohbet arayüzünde ses dosyasını oynatılabilir göster + transkripti altına yaz.
6. Transkripsiyon başarısız olursa AI hastadan nazikçe yazılı tekrar istesin — sessiz kalmasın.

B) GÖRSEL VE BELGE
1. image, document (PDF) tiplerini işle. İndir, Supabase Storage'a kaydet
   (lib/supabaseStorage.js mevcut).
2. Claude vision ile YAPILANDIRILMIŞ ön-veri üret. Branş şablonundaki required_media
   slot'larıyla eşleştir. Çıktı şeması branşa göre:
   - hair_transplant: {norwood_estimate, donor_density_note, image_quality, matched_slot}
   - dental: {visible_missing_teeth, image_type(photo|panoramic|cbct), image_quality, matched_slot}
   - genel: {document_type, extracted_text, relevance}

3. 🔴 MUTLAK KURAL — BU ÇIKTI ASLA HASTAYA GÖSTERİLMEZ.
   Yalnızca case_media.ai_extraction'a yazılır ve doktor onay kuyruğuna düşer.
   AI hastaya "Norwood 4 görünüyorsunuz" gibi hiçbir tıbbi değerlendirme SÖYLEMEZ.
   Bunu hem prompt'ta hem kodda (yanıt filtresi) zorla.

4. Görsel kalitesi yetersizse (bulanık, kötü ışık, yanlış açı):
   AI hastadan branş şablonundaki çekim talimatıyla YENİ FOTOĞRAF ister — hastanın dilinde.
5. Gerekli görsellerin tamamlanma durumunu vaka ekranında checklist olarak göster.
6. Hasta tüm gerekli görselleri gönderdiğinde vaka otomatik 'awaiting_doctor'a geçsin.

C) TEST
Her medya tipi için birim test yaz + medya indirme hatalarında graceful degradation
(webhook 200 dönmeye devam etmeli, Meta'nın 5 sn kuralı bozulmamalı).
```

---

## KOMUT 10 — Doktor kartı, onay kuyruğu, video konsültasyon 🔴

```
CARENOVA-STRATEJI.md Bölüm 7 / M3'ü oku. Bu modül araştırmadaki en büyük hasta korkusunu
("beni kim ameliyat edecek?" / ghost surgeon) hedefliyor ve hiçbir rakipte yok.

A) DOKTOR KARTI
1. doctors tablosu: id, tenant_id, user_id (nullable), full_name, title, specialty,
   registration_no (Sağlık Bakanlığı tescil), diploma_media_id, years_experience,
   photo_url, intro_video_url, languages text[], bio jsonb (çok dilli),
   is_active, public_slug
2. /settings/doctors yönetim ekranı.
3. Herkese açık doktor kimlik sayfası: /dr/:slug — hastanın dilinde, doğrulanabilir
   bilgiler, fotoğraf, video, konuştuğu diller. Tanıtım Yönetmeliğine uygun:
   fiyat yok, hasta yorumu yok, sonuç vaadi yok.
4. AI teklif verirken veya trust_surgeon itirazı tespit ettiğinde bu linki paylaşır.
5. Vakaya atanan doktor = ameliyatı yapacak doktor. Teklifte ADI GEÇER.

B) DOKTOR ONAY KUYRUĞU (mobil öncelikli)
1. /doctor-queue ekranı. Doktor rolü için varsayılan açılış sayfası.
2. Her kart: hasta ülkesi/yaşı, branş, yüklenen görseller (galeri), AI'ın yapılandırdığı
   ön-veri özeti, ön-değerlendirme yanıtları, kırmızı bayrak uyarıları.
3. Doktor aksiyonu: eligible / conditional / ineligible + not + onaylanan kapsam
   (greft sayısı aralığı, implant sayısı, işlem listesi) + onaylanan fiyat bandı.
4. Onay olmadan teklif üretilemez — bunu backend'de zorla, sadece UI'da değil.
5. Doktor kararı case_events'e append-only yazılsın (denetim izi).
6. Bekleyen onaylar için doktora push/e-posta bildirimi; SLA sayacı (X saattir bekliyor).

C) VİDEO KONSÜLTASYON
1. Doktor müsaitlik takvimi (mevcut clinic_availability mantığını doktor bazına genişlet).
2. AI sıcak lead'e 10-15 dk video görüşme önerir, slot sunar, rezerve eder.
3. Görüşme linki üret (önce basit: harici link alanı; v2'de Daily.co/Whereby entegrasyonu).
4. Hastaya kendi dilinde ve kendi saat diliminde hatırlatma (24 saat + 1 saat önce).
```

---

## KOMUT 11 — Kilitli Teklif Motoru 🔴 EN SATILABİLİR ÖZELLİK

```
CARENOVA-STRATEJI.md Bölüm 7 / M4'ü oku. Bu, ürünün en satılabilir tek özelliği —
araştırmada Şikayetvar ve Trustpilot şikayetlerinin en yoğun kümesi "fiyat sonradan değişti".

1. quotes tablosu:
   id, case_id, tenant_id, version (int), quote_number (insan okunur),
   status (draft|issued|accepted|expired|superseded|cancelled),
   currency, fx_rate, fx_rate_date, subtotal, discount, total, deposit_amount,
   valid_until, issued_by, issued_at, accepted_at,
   content_hash (sha256, değişmezlik kanıtı),
   superseded_by_quote_id, change_reason jsonb (çok dilli),
   language (hastanın dili), doctor_id (onaylayan/uygulayacak doktor)

   quote_items: id, quote_id, kind(procedure|anesthesia|accommodation|transfer|
   interpreter|medication|followup|other), description jsonb, qty, unit_price,
   total, is_included boolean
   quote_exclusions: id, quote_id, description jsonb   ← "dahil DEĞİLDİR" listesi

2. KURALLAR (backend'de zorla):
   - Doktor onayı olmadan teklif issue edilemez.
   - issued bir teklif DEĞİŞTİRİLEMEZ. Değişiklik = yeni versiyon + zorunlu change_reason.
   - Hasta değişiklik geçmişini ve gerekçesini görür.
   - Fiyat bandı doktorun onayladığı aralığın dışındaysa uyar ve tekrar onay iste.
   - valid_until geçtiğinde otomatik 'expired'.

3. TEKLİF PDF'i:
   - Kalem kalem: işlem, anestezi, konaklama (kaç gece, hangi otel), transfer, tercüman,
     ilaç, kontrol muayeneleri
   - AYRI BİR BÖLÜM: "Bu fiyata dahil DEĞİLDİR" listesi
   - Uygulayacak doktorun adı, unvanı ve tescil numarası
   - Geçerlilik tarihi, teklif numarası, versiyon, doğrulama hash'i
   - ÇİFT DİL: sol kolon Türkçe (hukuki geçerli metin), sağ kolon hastanın dili
   - 2025 Sağlık Turizmi Yönetmeliği gereği konaklama/ulaşım/tercümanlık/danışmanlık
     ücretleri KALEM KALEM ayrı gösterilmeli
   Mevcut invoicePdf.js ve pdfkit altyapısını kullan.

4. Herkese açık teklif sayfası: /q/:token — hasta linke tıklar, teklifi kendi dilinde görür,
   PDF indirir, "Kabul ediyorum" der, depozito ödemesine geçer.
   Stripe/Square (mevcut) ile depozito linki. Çoklu para birimi.

5. "Fiyat Garantisi" rozeti: teklif sayfasında ve PDF'te görünür bir işaret —
   "Bu fiyat GG.AA.YYYY tarihine kadar kilitlidir. Değişiklik ancak yeni bir teklif
   versiyonuyla ve gerekçesiyle yapılabilir."

6. Teklif issue edildiğinde AI hastaya WhatsApp'tan link gönderir, hastanın dilinde,
   kısa ve satış baskısı olmadan.
```

---

## KOMUT 12 — Mevzuat Kalkanı (KVKK + Tanıtım Yönetmeliği) 🔴

```
CARENOVA-STRATEJI.md Bölüm 7 / M7'yi BAŞTAN SONA oku. Bu modül CareNova'nın savunma hendeği.

⚠️ ÖNCE: Bu modülü kodlamadan önce bana şunu sor — kvkk.gov.tr'deki
"Üretken Yapay Zeka ve Kişisel Verilerin Korunması Rehberi" (24.11.2025) okundu mu?
Okunmadıysa uyar, ama yine de aşağıdakini uygula.

A) TANITIM YÖNETMELİĞİ KORUYUCUSU
AI'ın ürettiği HER dış içerik bir kural motorundan geçsin (services/complianceGuard.js):
- Türkçe / yurt içi hedefli fiyat, indirim, kampanya duyurusu → BLOKLA
- Hasta yorumu / teşekkür mesajı paylaşımı → BLOKLA
- Sonuç garantisi, "kesin sonuç", "%100 başarı" gibi ifadeler → BLOKLA
- Öncesi/sonrası görsel paylaşımı → Ek-1 onamı yoksa BLOKLA
- Lisanssız sağlık bilgisi üretimi → tıbbi tavsiye niteliğindeki çıktıyı engelle
Bloklanan her deneme compliance_events tablosuna loglansın (kim, ne zaman, ne).
Ayarlar > Mevzuat panelinde bu log görünsün.

B) EK-1 GÖRSEL ONAM YÖNETİMİ
1. media_consents tablosu: id, tenant_id, case_id, patient_id, media_ids uuid[],
   consent_form_version, language, signed_at, signwell_document_id,
   revoked_at, revoke_reason, allows_marketing_use, allows_web, allows_social
2. Dijital Ek-1 formu, hastanın dilinde + Türkçe. SignWell ile imza (mevcut utils/signwell.js).
3. Onam GERİ ALINABİLİR. Geri alındığında ilgili tüm görseller sistemde
   'revoked' işaretlensin ve hangi kanallarda yayınlandıysa listelensin (kaldırma görevi).
4. Onam karşılığında ödeme yapılamayacağı, filtre/AI düzenleme yasağı,
   tarih belirtme zorunluluğu formda ve UI'da açıkça belirtilsin.

C) KVKK KATMANI
1. Aydınlatma metni + açık rıza akışı, hastanın dilinde, versiyonlu.
   İlk WhatsApp temasında AI kısa aydınlatma + link paylaşsın.
2. consents tablosu: hukuki sebebi de kaydet (açık rıza / kanunun açıkça öngörmesi /
   bir hakkın tesisi / kamu sağlığının korunması ...). 7499 sayılı kanunla sağlık verisi
   için 8 işleme sebebi var — sadece açık rızaya dayanmak başka sebep varken
   hakkın kötüye kullanımı sayılabilir.
3. Veri sahibi hakları: erişim, düzeltme, silme, taşınabilirlik talep akışı + 30 gün SLA sayacı.
4. Saklama süresi ve otomatik anonimleştirme işi (mevcut data_retention_until mantığını kullan).
5. Yurt dışı aktarım kaydı: Anthropic API, Meta/WhatsApp, ödeme sağlayıcıları için
   alıcı, ülke, aktarım mekanizması (standart sözleşme), bildirim tarihi.
   ⚠️ Standart sözleşme KVKK'ya 5 İŞ GÜNÜ içinde bildirilmeli — bildirmemenin cezası
   50.000-1.000.000 TL. Sistem bu bildirimi hatırlatan bir görev üretsin.
6. VERBİS kayıt hatırlatıcısı: sağlık verisi (özel nitelikli) işleyenler için
   50 çalışan/100mn TL muafiyeti GEÇERLİ DEĞİL — büyüklükten bağımsız kayıt zorunlu.
   Onboarding'de kliniğe bunu bildir.
7. 🔴 ÜRÜN İLKESİ — kodda ve sözleşmede: hasta verisi HİÇBİR koşulda model eğitiminde
   kullanılmaz. Anthropic API çağrılarında bunu sağlayan ayarları doğrula ve dokümante et.

D) 2025 SAĞLIK TURİZMİ YÖNETMELİĞİ PANELİ
/settings/compliance ekranı:
- Yetki belgesi bilgisi ve geçerlilik tarihi
- Komplikasyon sigortası durumu (31.12.2026 son tarih) — sayaç
- %20 yabancı dil yetkin personel oranı takibi
- HealthTürkiye portalına raporlanacak verinin dışa aktarımı (CSV/Excel)
- Yıllık performans değerlendirmesi için hazırlık kontrol listesi

E) GDPR KÖPRÜSÜ
Hasta ülkesi AB/UK ise: GDPR uyumlu rıza akışı devreye girsin, veri sahibi hakları
GDPR süreleriyle işlesin, m.27 temsilci gereksinimi hakkında kliniği uyar.

⚖️ Kodun içine "bu hukuki tavsiye değildir" notu koy ve ayarlar panelinde
kliniğin kendi hukuk danışmanından görüş alması gerektiğini belirt.
```

---

## KOMUT 13 — Seyahat Konsiyerj + Bakım Hattı 🟡

```
CARENOVA-STRATEJI.md Bölüm 7 / M5 ve M6'yı oku.

A) SEYAHAT KONSİYERJ
1. case_travel tablosu: id, case_id, arrival_flight, arrival_at, departure_flight,
   departure_at, hotel_name, hotel_confirmation, room_type, nights,
   transfer_driver, transfer_status, visa_status, visa_notes, interpreter_id
2. Uçuş takibi: hasta uçuş kodunu WhatsApp'a yazar → AI parse eder → kaydeder.
   Uçuş durumu API'si (AviationStack/FlightAware) opsiyonel, env ile açılabilir olsun.
   Rötar olursa case_timeline otomatik kaysın ve klinik + sürücü bilgilendirilsin.
3. Vize/belge kontrol listesi — hastanın ülkesine göre şablon.
4. Tercüman atama: dile göre müsait tercüman, işlem gününe planlanır.
5. Gün gün program üretimi: case_timeline'dan hastanın dilinde WhatsApp mesajı + PDF.
6. REFAKATÇİ KANALI: case_companions'daki refakatçiye ayrı WhatsApp iletişimi.
   Sağlık turizminde kararı çoğu zaman refakatçi verir — bu göz ardı edilen bir kaldıraç.
   Refakatçi ayrı rıza vermeli, ayrı aydınlatılmalı.

Mevcut patientChecklist ve appointments modüllerini temel al, sıfırdan yazma.

B) BAKIM HATTI (aftercare)
1. aftercare_schedules: case_id'den türetilir, branch_template.aftercare_schedule'a göre
   D+1, D+3, D+7 ... D+365 temas noktaları üretilir.
   aftercare_touchpoints: id, case_id, day_offset, scheduled_at, status,
   sent_at, responded_at, response jsonb, media_ids uuid[], triage_flag
2. Her temasta AI:
   - Hastanın dilinde, hastanın saat diliminde mesaj
   - Fotoğraf ister → iyileşme zaman çizelgesi otomatik oluşur
   - Branş şablonundaki komplikasyon triyaj sorularını sorar
   - İlaç/bakım hatırlatması yapar
3. 🔴 KOMPLİKASYON TRİYAJI AYRI BİR AKIŞTIR — satış akışı değil.
   Kırmızı bayrak (ateş, aşırı kanama, şiddetli ağrı, enfeksiyon belirtisi,
   ani görme kaybı vb.) tespit edilirse:
   - AI satış dili KULLANMAZ
   - DERHAL doktora eskale eder (push + SMS + e-posta)
   - Hastaya acil durumda en yakın sağlık kuruluşuna başvurmasını söyler
   - case_events'e kaydeder
   Bu kuralı prompt'ta CRITICAL RULE olarak yaz.
4. İyileşme zaman çizelgesi ekranı: tarihli, düzenlenmemiş görseller.
   Ek-1 onamı varsa pazarlama kullanımına uygun işaretlenir (KOMUT 12).
5. Bakım hattı cron'u: mevcut backend/src/routes/cron.js altyapısını kullan.
```

---

## KOMUT 14 — Kanal ROI panosu, entegrasyonlar ve landing 🟡

```
CARENOVA-STRATEJI.md Bölüm 7 / M9, M12 ve Bölüm 5.2'yi (Bookimed "Sofia" tehdidi) oku.

A) KANAL ROI PANOSU — stratejik olarak en önemli rapor
/insights içinde yeni sekme. Kanal bazında tablo:
  Kanal | Lead | CPL | Vaka | CAC | Gelir | Komisyon | NET MARJ
Kanallar: Meta reklam, Google Ads, Instagram organik, Bookimed, Flymedi, WhatClinic,
referans, doğrudan.
Klinik reklam harcamasını manuel girebilsin (v2'de Meta/Google API ile otomatik).
Komisyonlu kanalın GERÇEK net marjını göster — kliniğin komisyon bağımlılığını
sayısal olarak görmesini sağla. Bu satışta en güçlü hikaye.

B) ENTEGRASYONLAR
1. Meta Lead Ads webhook → doğrudan lead/case oluşturma
2. Instagram DM + Messenger → aynı AI motoruna (WhatsApp ile aynı hat)
3. Pazaryeri lead içe aktarımı: Bookimed/Flymedi CSV içe aktarma (API varsa API)
4. Web sitesine gömülebilir branş ön-değerlendirme formu → doğrudan case açar
   (mevcut widget.js ve ingest.js altyapısını genişlet)
5. Google Business Profile mesajları (opsiyonel)

C) ONBOARDING SİHİRBAZI
CARENOVA-STRATEJI.md M11'i uygula. Hedef: klinik 45 dakikada, bireysel doktor
15 dakikada canlıda. 7 adım:
klinik bilgisi → branş seçimi → WhatsApp bağlama → doktor kartları →
bilgi bankası (şablondan ön dolu) → fiyat bandı + AI yetki onayı → KVKK/Ek-1 metinleri →
test sohbeti → canlıya al

⚠️ WhatsApp bağlama Meta Embedded Signup ile SELF-SERVİS olmalı. CareDental'da bu
çözülmemiş bir ağrı. Erken prototiple ve çalışmıyorsa bana söyle — manuel fallback koy.

D) LANDING SAYFASI
Bölüm 6.2'deki konumlandırma ifadesini ve Bölüm 4.3'teki "hastanın istediği 5 şey"
tablosunu temel al. Bölümler:
- Hero: WhatsApp sohbet animasyonu, 5 dilde (TR/EN/AR/DE/RU) döngü
- Problem: kayıp hesabı (Bölüm 3.3'teki huni — reklam bütçesi sabit, sonuç 10-15 kat)
- Üç güven yarası ve CareNova'nın cevabı (Kilitli Teklif / Doktor Kimliği / Bakım Hattı)
- Platform modülleri
- Mevzuat Kalkanı (KVKK + Tanıtım Yönetmeliği) — bu bir satış argümanı
- Fiyatlandırma (Bölüm 10 tablosu: Solo €149 / Klinik €449 / Grup €1.190)
- SSS
- Demo talep formu

Dil: TR varsayılan, EN/AR/DE/RU alternatif. hreflang etiketleri doğru kurulsun.
⚠️ Landing sayfasında Türkçe hasta fiyatı YAYINLAMA — Tanıtım Yönetmeliği yasağı.
Yayınlanan fiyatlar KLİNİĞE satılan SaaS fiyatı, hasta tedavi fiyatı değil. Bunu ayırt et.
```

---

## KOMUT 15 — Test, güvenlik ve yayına hazırlık 🔴

```
CareNova'yı yayına hazırla.

A) TEST
1. Backend: AI prompt derleyici (her yetki seviyesi), mevzuat kalkanı kuralları,
   teklif versiyonlama ve değişmezliği, doktor onayı olmadan teklif engellemesi,
   komplikasyon triyaj tetikleme, medya işleme, auth/token rotasyonu.
2. Kritik senaryolar için uçtan uca test:
   - Arapça sesli mesaj → transkript → doğru dilde yanıt
   - Fotoğraf → AI ekstraksiyon → doktor kuyruğuna düşme → ONAY OLMADAN teklif YOK
   - qualification_only branşta AI'ın fiyat vermeye zorlanması → vermemeli
   - Ek-1 onamı olmadan öncesi/sonrası paylaşımı → bloklanmalı
   - Onam geri alma → görsellerin işaretlenmesi
3. Kiracı izolasyonu testi: bir tenant başka tenant'ın vakasını GÖREMEMELİ.

B) GÜVENLİK
1. Tüm endpoint'lerde tenant scoping'i denetle — özellikle yeni yazılan case/quote/media.
2. Medya URL'leri imzalı ve süreli olsun, doğrudan erişilemesin.
3. Rate limiting: webhook, teklif sayfası, medya indirme.
4. case_events append-only olduğunu DB seviyesinde zorla (UPDATE/DELETE trigger engeli).
5. Sırların hiçbiri repoda olmasın; .env.example'ı eksiksiz yaz.
6. Bağımlılık güvenlik taraması çalıştır.

C) YAYIN
1. backend/render.yaml'ı CareNova için güncelle. Bölge kararı: Frankfurt (AB) —
   KVKK yurt dışı aktarım yükü açısından değerlendir ve bana raporla.
2. Frontend Vercel yapılandırması, carenova.ai domaini.
3. ⚠️ carenova.ai'da ŞU AN ESKİ BİR WORDPRESS SİTESİ CANLI. Yeni siteyi
   önce staging'e (app.carenova.ai veya beta.carenova.ai) al, kesme planını bana sor.
4. Migration'ları prod'a uygulama runbook'u yaz.
5. Monitoring: hata takibi, AI çağrı maliyeti, webhook başarı oranı, ilk yanıt süresi metriği.

D) DOKÜMANTASYON
1. CLAUDE.md'yi son haline getir.
2. docs/ altına: mimari, branş şablonu ekleme rehberi, mevzuat notları,
   onboarding runbook'u.
```

---

## Ek — Her komuttan sonra çalıştırılacak kontrol

```
Yaptığın değişiklikleri özetle. Şunları doğrula ve bana raporla:
1. Diş hekimliğine özel hiçbir varsayım kalmadı mı?
2. Yeni eklenen tüm kullanıcıya görünen metinler i18n üzerinden mi geçiyor?
3. Yeni endpoint'lerin hepsinde tenant scoping var mı?
4. AI'ın hastaya söyleyebileceği yeni bir şey eklediysen, yetki matrisine ve
   mevzuat kalkanına takılıyor mu?
5. Testler geçiyor mu?
Sonra anlamlı bir mesajla commit at.
```

---

## Faz haritası — hangi komut hangi faza denk geliyor

| Faz | Komutlar | Süre |
|---|---|---|
| F0 Temel | 0, 1, 2, 3, 4 | ~1,5 hafta |
| F1 Motor | 5, 6, 7, 8 | ~2 hafta |
| F2 Çok modlu | 9 | ~1,5 hafta |
| F3 Güven | 10, 11 | ~2 hafta |
| F4 Uyum | 12 | ~1,5 hafta |
| F5+F6 Operasyon & Elde tutma | 13 | ~3 hafta |
| F7 Büyüme | 14 | ~2 hafta |
| Yayın | 15 | ~1 hafta |

**Satılabilir ilk demo: KOMUT 11 sonunda (~7 hafta).**

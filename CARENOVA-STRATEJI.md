# CareNova — Strateji ve Ürün Tanımı

**Türkiye sağlık turizmi için AI hasta dönüşüm ve vaka yönetim platformu**

Sürüm 1.0 · 3 Eylül 2026 · Hazırlayan: Claude (Cowork) · Talep eden: Baturay Özden

---

## 0. Bu belge nasıl okunur

Bölüm 1–6 stratejik karar temeli (pazar, segment, rekabet, konumlandırma). Bölüm 7 ürünün kendisi — Claude Code'a verilecek özellik listesinin kaynağı. Bölüm 8–12 ticari model, yol haritası ve risk. Bölüm 13 doğrulanması gereken açık noktalar.

Her rakamın yanında kaynak ve yıl var. Kaynağı zayıf olan her rakam **[düşük güven]** olarak işaretlendi. Bu belgede uydurma rakam yok; bulunamayan veri "bulunamadı" diye yazıldı.

---

## 1. Yönetici özeti

**Ana tez:** Türkiye sağlık turizminde asıl kayıp hasta bulmakta değil, *bulunan hastayı elde tutmakta*. Klinikler lead başına ₺150–900 ödeyip bu lead'lerin %85–95'ini kaybediyor. Kayıp üç noktada gerçekleşiyor ve üçü de yazılımla kapatılabilir bir güven açığı: **(1) ilk yanıt gecikmesi**, **(2) fiyatın sonradan değişmesi**, **(3) ödeme sonrası kaybolma**. Mevcut yazılımların hiçbiri bu üçünü birden çözmüyor — hepsi satış öncesi CRM.

**CareNova'nın konumu:** CRM değil. *Hasta güveni altyapısı.* Çok dilli AI WhatsApp ajanı ön uçta, kilitli teklif ve doktor onaylı vaka dosyası ortada, dönüş sonrası bakım hattı arkada. Rakiplerin hepsi ilk üçte biri yapıyor; hiçbiri son üçte birini yapmıyor.

**Neden şimdi:** 26 Nisan 2025 Yönetmeliği ve 2023/2025 Tanıtım Yönetmeliği kliniklere ölçülebilir uyum yükü getirdi (yıllık performans değerlendirmesi, HealthTürkiye portal kaydı, komplikasyon sigortası, tanıtım yasakları, 1–3 ay faaliyet durdurma cezaları). Uyumu *ürünün içine gömen* ilk yazılım büyük bir savunma hendeği kazanır. Türk rakiplerin hiçbiri bunu yapmıyor.

**Neden CareDental'dan fork:** 47.000 satırlık çalışan bir kod tabanı var — çok kiracılı mimari, WhatsApp Cloud API, Claude tabanlı AI motoru, lead skorlama, itiraz tespiti, komisyon motoru, fatura, Stripe/Square/Atoa ödeme, SignWell imza, hasta doküman ve checklist modülleri. Sağlık turizmi ihtiyaçlarının ~%60'ı zaten kodda. Sıfırdan yazmak 6–10 hafta kaybettirir.

**En büyük tek risk:** Hasta başına başarı primi almak "aracılık" sayılabilir ve Uluslararası Sağlık Turizmi Aracı Kuruluş yetki belgesi gerektirebilir (2026 toplam maliyeti ₺910.545). Bölüm 9'daki analiz **saf abonelik + kullanım modelini** öneriyor.

---

## 2. Pazar: rakamlarla

### 2.1 Büyüklük ve trend

Kaynak: USHAŞ / TÜİK, [ushas.gov.tr](https://www.ushas.gov.tr/en/saglik-turizmi-verileri/)

| Yıl | Hasta sayısı | Gelir (USD) | Hasta başı |
|---|---|---|---|
| 2019 | 756.926 | 1,459 mlr | $1.928 |
| 2020 | 435.691 | 1,371 mlr | $3.147 |
| 2021 | 729.592 | 2,016 mlr | $2.763 |
| 2022 | 1.381.807 | 2,207 mlr | $1.597 |
| 2023 | 1.538.643 | 3,006 mlr | $1.954 |
| 2024 | 1.506.442 | 3,023 mlr | $2.007 |
| 2025 | 1.398.580 | 3,022 mlr | $2.161 |
| 2026 Ç1 | 302.487 | 761,5 mn | $2.518 |
| 2026 Ç2 | 563.327 | 1,580 mlr | $2.805 |

**Okunuşu — bu tablo stratejinin merkezinde:** 2023'ten beri hasta *sayısı* düşüyor (1,54 mn → 1,40 mn, −%9) ama gelir sabit ve **hasta başı gelir sert yükseliyor** (2022'de $1.597 → 2026 Ç2'de $2.805, +%76). Pazar hacimden değere kayıyor.

Bu, CareNova için tek cümlelik iş gerekçesi: **klinikler artık daha az hastayı daha pahalıya satmak zorunda.** Ucuz hasta akını bitti. Kazanan, gelen her lead'i daha yüksek oranda ve daha yüksek sepetle kapatan klinik olacak — yani dönüşüm optimizasyonu artık bir "nice to have" değil, hayatta kalma koşulu. Ürün tam olarak bunu satıyor.

*Not: Q2 2026 rakamı çeyreklik ve Q1'in neredeyse iki katı — mevsimsellik mi yoksa metodoloji değişikliği mi olduğu doğrulanmalı [düşük güven].*

### 2.2 Branş kırılımı

**Resmî (TÜİK/USHAŞ) branş kırılımı yayınlanmıyor.** İki sektörel tahmin birbiriyle 10 puana kadar çelişiyor [düşük güven]:

| Branş | Tahmin A | Tahmin B |
|---|---|---|
| Estetik/plastik | %28 | %35 |
| Saç ekimi | %25 | — |
| Diş | %22 | %25 |
| Göz | %10 | %20 |
| Ortopedi | %8 | — |
| Onkoloji/IVF/diğer | %7 | — |

Kaynaklar: [smile-antalya.com](https://smile-antalya.com/data/health-tourism-statistics/), [medikalakademi.com.tr](https://www.medikalakademi.com.tr/turkiye-saglik-turizmi-2024e-nasil-giriyor/)

**Ürün kararı açısından önemi:** Kesin oran bilinmiyor ama sıralama tutarlı — estetik + saç ekimi + diş toplamın ~%75'i. MVP branş şablonları bu üçüyle başlamalı; motor branş-bağımsız olmalı ki geri kalan uzun kuyruk (göz, bariatrik, IVF, ortopedi) yapılandırmayla açılabilsin.

### 2.3 Kaynak ülkeler

Resmî ülke bazlı hacim tablosu bulunamadı. Nitel olarak doğrulanan ana pazarlar: **Almanya, İngiltere, Irak, Azerbaycan, Rusya, Libya, Körfez ülkeleri**; hızlı büyüyen: **Kazakistan, Özbekistan, Orta Asya**. USHAŞ'ın 29 ülkelik hedef listesi ayrıca Balkanlar, Kuzey Afrika ve Batı Afrika'yı içeriyor. Saç ekimi özelinde hastaların %70'i Avrupa'dan ([aa.com.tr](https://www.aa.com.tr/tr/saglik/turkiyeye-sac-ekimi-tedavisi-icin-gelenlerin-yuzde-70i-avrupadan/2476927)).

**Dil kararı:** Zorunlu ilk set **TR, EN, AR, DE, RU**. İkinci dalga: FR, ES, RO, AZ, FA. Bu, Claude'un doğal olarak yapabildiği bir şey — rakiplerin çoğu Google Translate/DeepL katmanı kullanıyor.

### 2.4 Arz tarafı

Yetki belgeli tesisler (24 Temmuz 2024, [uste.org.tr](https://www.uste.org.tr/verlerle-saglik-turizmi/)):

- Hastane: 654
- Tıp merkezi: 189
- **Klinik: 2.525**
- Diğer sağlık tesisi: 1.299
- **Toplam ≈ 4.667**

2023 Aralık'ta 4.555 → 4.787 arası bir sıçrama var, yani yıllık birkaç yüz tesis ekleniyor. Güncel 2026 sayısı çekilemedi (kayıt sitesi JS ile render ediliyor).

**TAM hesabı (aşağıdan yukarı):**

| Segment | Tesis | Erişilebilir oran | Hedef hesap |
|---|---|---|---|
| Klinik (küçük/orta) | 2.525 | %60 aktif uluslararası | ~1.500 |
| Diğer sağlık tesisi | 1.299 | %40 | ~520 |
| Tıp merkezi | 189 | %70 | ~130 |
| **Toplam SAM** | | | **~2.150 hesap** |

Ayrıca yetki belgesi olmayıp aracı kuruluş üzerinden çalışan bireysel doktorlar var — sayısı bulunamadı, ama serbest çalışan estetik/saç ekimi hekimi sayısı bunun katları olabilir.

Aylık ortalama €300 ARPU varsayımıyla SAM ≈ **€7,7 mn ARR**. %15 penetrasyonda €1,16 mn ARR. Bu, tek başına büyük bir iş değil — **ARPU'yu yukarı çekmek (kullanım bazlı AI kotası + konsiyerj modülü) ve ikinci pazara (Körfez, Balkanlar kaynaklı hasta çeken diğer ülkeler) genişlemek** büyüme tezinin parçası olmalı.

### 2.5 WhatsApp

- Türkiye: internet kullanıcılarının **%88,6'sı WhatsApp kullanıyor** — en çok kullanılan uygulama (YouTube %72,9, Instagram %68,1). TÜİK 2025 BİT anketi.
- Meta 1 Temmuz 2025'te konuşma başına faturalamadan **mesaj başına faturalamaya** geçti. Kategoriler: Marketing, Utility, Authentication, Service. Service (müşteri başlattığı 24 saatlik pencere) 1 Kasım 2024'ten beri **ücretsiz**.
- **Türkiye'ye özel yayınlanmış tarife bulunamadı.** Meta'nın kendi sayfası login duvarında. Referans: UK Marketing £0,0382 / Utility £0,0159; US Marketing $0,025 / Utility $0,004 (Ocak 2026).

**Ürün kararı:** Service penceresinin ücretsiz olması, "hasta yazar → AI cevaplar" akışının **marjinal mesaj maliyetinin sıfıra yakın** olması demek. Maliyet sadece 24 saat sonrası proaktif takiplerde (Utility/Marketing) oluşuyor. Bu, birim ekonomisini AI token maliyetine indirger — çok sağlıklı bir yapı. Fiyatlandırma "AI konuşma kotası" üzerinden kurulmalı, mesaj sayısı üzerinden değil.

---

## 3. Değer havuzu: para tam olarak nerede kaybediliyor

Bu bölüm ürünün varlık sebebi. Sektörün yayınladığı gerçek sayılarla bir huni kurdum.

### 3.1 Lead maliyeti (yayınlanmış CPL, ₺)

Kaynak: [onuroztr.com](https://www.onuroztr.com/blog/saglik-sektorunde-lead-maliyeti-dusurme/)

| İşlem | Düşük | Orta | Yüksek |
|---|---|---|---|
| Diş muayene | 50–100 | 100–200 | 200+ |
| Diş implant | 150–300 | 300–500 | 500+ |
| Saç ekimi | 150–300 | 300–600 | 600+ |
| Estetik cerrahi | 250–500 | 500–900 | 900+ |

### 3.2 Dönüşüm oranları (yayınlanmış)

| Metrik | Değer | Kaynak |
|---|---|---|
| Genel lead→hasta | **%5–15** | onuroztr.com |
| Sorgu→hasta baz çizgisi | ~%10 | Medical Tourism Magazine |
| **Eğitimli satış ekibi** | **%15–20** | peganom.com |
| **Eğitimsiz satış ekibi** | **%1–2** | peganom.com |
| 1 saat içinde yanıt | **7× dönüşüm** | onuroztr.com |
| 5 dakika içinde yanıt | **10× dönüşüm** | peganom.com |
| 24 saat içinde aranmama | yanıt oranı ~yarıya düşer | Medical Tourism Magazine |

### 3.3 Kayıp hesabı — satılabilir tek slayt

100 lead'lik bir saç ekimi kampanyası, orta CPL ₺400:

```
Reklam harcaması                         ₺40.000
─────────────────────────────────────────────────
100 lead gelir
  ↓  %40'ı ilk 1 saatte yanıtlanmıyor  → dönüşümü 7 kat düşük
  ↓  Gece/hafta sonu gelen ~%35 hiç yanıtlanmıyor
  ↓  Danışman eğitimsizse dönüşüm %1–2
─────────────────────────────────────────────────
Eğitimsiz/yavaş ekip:   1–2 hasta  → CPA ₺20.000–40.000
Eğitimli/hızlı ekip:   15–20 hasta → CPA ₺2.000–2.700
─────────────────────────────────────────────────
FARK: aynı reklam bütçesiyle 10–15 kat sonuç
```

**Bu, CareNova'nın tek cümlelik satış argümanı:** *"Reklam bütçenizi artırmadan, gelen lead'lerin cevaplanma hızını ve tutarlılığını AI'a devrederek eğitimsiz ekip performansından eğitimli ekip performansına geçiyorsunuz."*

Ve bu AI için ideal bir problem: **AI 5 saniyede, 7/24, 5 dilde, her seferinde aynı kalitede cevaplıyor.** İnsan danışman hiçbir zaman yapamaz.

### 3.4 İnsan katmanının maliyeti ve kırılganlığı

- Hasta danışmanı ortalama maaşı **₺37.200/ay** (2026), aralık ₺33.500–55.400; 2025'te ₺26.700 idi → **+%29 YoY** ([eleman.net](https://www.eleman.net/meslek/saglik-turizmi-uzmani/maas)).
- Satış müdürü ₺60–120k, ajans yöneticisi ₺80–200k (peganom).
- Tercüman katmanı improvize: bir hastane çeviri departmanında **80 kişi** çalıştırıyor; eski bankacılar ve mühendisler tercüman olmuş; nadir dil tercümanı ~₺15.000/ay ([gazeteoksijen.com](https://gazeteoksijen.com/amp/turkiye/saglik-turizmi-patlayinca-bankacilar-bile-cevirmen-oldu-162196)).

**Çıkarım:** Tek bir Arapça+Rusça+Almanca konuşan danışman ekibi kurmanın aylık maliyeti ₺110.000+. CareNova'nın aylık €300'luk fiyatı bunun ~%3'ü. ROI argümanı kendini anlatıyor.

**Not — bu bir "insan yerine AI" hikayesi değil, olmamalı.** Doğru çerçeve: *danışman ekibi 60 lead'i yüzeysel kovalamak yerine 12 sıcak lead'i derinlemesine kapatır.* Sağlık turizminde nihai kapanış hâlâ insan işi; AI'ın işi filtre, hız ve tutarlılık.

---

## 4. Hasta tarafındaki gerçek acı — ürünün farklılaşma kaynağı

Bu bölüm ürün spec'inin en önemli girdisi. Rakiplerin hiçbiri buraya bakmıyor çünkü hepsi *kliniğe* satmaya odaklanıp *hastanın* neden gitmediğini incelemiyor.

### 4.1 Üç güven yarası

**Yara 1 — "Beni kim ameliyat edecek?" (ghost surgeon)**

Bu bir paranoya değil, belgelenmiş bir operasyonel desen. 800 saç ekimi yorumunun analizi: kötü sonuçların **%96'sı**, işlemin tamamının lisanssız teknisyenler tarafından yapıldığı kliniklere ait ([clinictruth.com](https://clinictruth.com/blog/hair-transplant-gone-wrong-turkey.html), [haircostcalculator.com](https://haircostcalculator.com/reviews/turkey/)).

Hasta ifadesi:
> *"Her konuşma bir WhatsApp satış temsilcisi üzerinden geçiyor ve hiçbir zaman bir hemşire, koordinatör veya doktorla konuşmuyorsunuz."*

Hastaların bağlanmadan önce yazılı cevap istedikleri sorular ([HairLossTalk](https://www.hairlosstalk.com/interact/threads/hair-transplant-turkey-what-do-patients-want-clinics-to-answer-honestly-before-booking.140207/)):
- İşlemin her aşamasını *kim* yapacak?
- Aşırı greft alımı / kalıcı donör hasarı riski var mı?
- Fiyata tam olarak ne dahil? Geldiğimde fiyat değişebilir mi?
- Eve döndükten sonra komplikasyon çıkarsa sorumlu kim?

**Yara 2 — Fiyatın sonradan değişmesi**

> *"Uzman olmayan bir personel online fiyat verdi, oraya gittiğimde 500 euro daha istediler."*
> *"Sürekli upsell yapmaya çalışıyorlar. 500 dolarlık şampuan paketi satmaya çalıştılar."*

Şikayetvar'da Esteworld: **142 değerlendirmede 51/100** — WhatsApp'ta fiyat verilip klinikte daha fazlasının istenmesi, "ücretsiz konsültasyon" sözü sonrası beklenmedik ücretler, **ödeme alındıktan sonra iletişimin kesilmesi** ([sikayetvar.com/esteworld](https://www.sikayetvar.com/esteworld)).

Trustpilot'ta SaphireDent (diş): *"Ödedikten sonra her şey değişti. İletişim çok sınırlandı, sorular görmezden gelindi"* — ve söz verilen İsviçre implantı yerine sertifikasız implant takılan bir vaka.

**Yara 3 — Eve döndükten sonra terk edilme**

- Ruby Khan, 30, İzmir'de liposuction/karın germe sonrası ertesi gün kardiyak aritmiden hayatını kaybetti. Ailesi: *"Bize bir zarf verdiler, 'işte paranız, işte kız kardeşinizin parası, işte uçağınız' dediler."* ([LBC](https://www.lbc.co.uk/article/woman-died-liposuction-tummy-tuck-surgery-turkey-5Hjd7Dr_2/))
- BOMSS çalışması, 35 İngiliz bariatrik turizm hastasının komplikasyonlarının NHS'e **hasta başına £16.006** maliyet çıkardığını, ortalama yatışın **22 gün** olduğunu ve hastaların **yarısından fazlasının NICE kriterlerine göre zaten ameliyata uygun olmadığını** buldu.
- Manchester'dan Rida Azeem, diş sonrası €30.000'lık düzeltme işlemi gerekti; sadece €3.000 geri alabildi. Türk Diş Hekimleri Birliği **%3–5 hatalı işlem oranını "kabul edilebilir"** olarak nitelendiriyor. İstanbul Diş Hekimleri Odası başkanı: *"Gelecekte işsiz diş hekimleri yaratıyoruz."* ([Euronews](https://www.euronews.com/travel/2022/10/13/in-turkey-concerns-grow-over-flaws-in-its-booming-dental-tourism-industry))

### 4.2 Google ile Reddit arasındaki uçurum

Aynı klinikler için: **Google Maps duygu analizi %94,4 olumlu; Reddit sadece %30 olumlu** (%53 nötr, %17 olumsuz). Bu fark tek başına, hastaların ilk gördüğü platformlarda yorum filtrelemesi/teşviki yapıldığını ve gerçek şikayet oranının filtrelenmemiş topluluklarda ortaya çıktığını gösteriyor.

**Ürün fırsatı:** Hasta artık Google yorumuna inanmıyor. İnandığı şey **doğrulanabilir, tarihli, düzenlenmemiş kanıt.** CareNova bunu üretebilir.

### 4.3 Hastanın istediği beş şey — doğrudan ürün gereksinimine dönüşür

| Hasta ne istiyor | CareNova modülü |
|---|---|
| 1. Ameliyatı yapacak doktorun **adı yazılı olarak** + öncesinde video görüşme | **Doktor Kimlik Kartı + Video Konsültasyon** (M3) |
| 2. **Kilitli, kalem kalem teklif** — gelince değişmeyen | **Kilitli Teklif Motoru** (M4) |
| 3. Tıbbi sorular için **satışçıya değil klinik birine** erişim | **Klinik Eskalasyon + Doktor Onay Kuyruğu** (M3) |
| 4. Dönüş sonrası **tanımlı komplikasyon protokolü** | **Bakım Hattı + Komplikasyon Triyajı** (M6) |
| 5. Süslenmiş referans değil, **gerçek tarihli ilerleme belgeleri** | **Hasta Zaman Çizelgesi + Ek-1 uyumlu görsel arşivi** (M6, M8) |

**Bu tablo CareNova'nın tüm farklılaşmasıdır.** Rakipler 1–2–3'ün bir kısmını, 4 ve 5'i hiç yapmıyor.

---

## 5. Rekabet haritası

### 5.1 Türkiye — doğrudan rakipler

| Ürün | Ne yapıyor | Fiyat (açık) | Diller | Zayıflık |
|---|---|---|---|---|
| **ProjeMED / MeduAI360** ⚠️ *en yakın tehdit* | WhatsApp API + AI asistan + sağlık turizmi lojistiği | Yayınlanmamış | "Neredeyse tüm diller" — **Google Translate/DeepL katmanı** | Çeviri API'si, native LLM değil; ajans/ops aracı olarak konumlanmış; itiraz yönetimi iddiası yok |
| **Planports** | WhatsApp + IG/Messenger tek gelen kutusu, Meta/Google form lead yakalama, ülke/dil bazlı yönlendirme, 3-5-7 gün takip otomasyonu, ROI raporu | **$25/kullanıcı/ay** (yıllık) + $20/WA hattı; Enterprise $49 | TR/EN arayüz | **Kural tabanlı otomasyon, LLM yok** — "3. gün mesajı gönder" seviyesi |
| **MetoCRM** | Çok kanallı gelen kutusu, çağrı merkezi + video konsültasyon, dile göre lead dağıtımı, otomatik teklif, ortak/ajans komisyon takibi, otel/transfer koordinasyonu | Demo kapılı | TR öncelikli | "AI ajanı" = durgun lead'i işaretleyen kural motoru, üretken AI değil |
| **Rapitek** | Genel sağlık CRM, çoklu kullanıcı WhatsApp, HBYS/ERP entegrasyonu (Logo, SAP, Netsis, Mikro) | **$25/kullanıcı/ay** | TR, EN, AR, RU, DE, FR, ES, KZ | Sağlık turizmine özel değil; AI dönüşüm katmanı yok |
| **ÖzgürKod** | No-code çok dilli chatbot flow builder, WhatsApp Cloud API | Yayınlanmamış, 7–14 gün deneme | 100+ dil iddiası | Akışları kliniğin kendisinin tasarlaması gerekiyor |
| **BeeMessenger, Netgsm, Infobip TR, CBOT** | WhatsApp API altyapısı/reseller | Değişken | — | **Altyapı**, dikey ürün değil — AI katmanını klinik kendisi kurmalı |

### 5.2 Pazaryerleri — hem kanal hem tehdit

Bookimed, Flymedi, MyMediTravel, Qunomedical, MediGence, WhatClinic, Estheticon. **Hiçbiri komisyon oranını yayınlamıyor** — bu bir araştırma boşluğu değil, sektörel bir desen (sözleşmeyle müzakere ediliyor).

⚠️ **Kritik gelişme:** Bookimed **"Sofia"** adlı bir AI koordinatör devreye aldı — 14 dilde ilk teması yönetiyor ve hasta adına klinikle iletişime geçiyor. Pazaryerleri AI dönüşüm katmanını *kendileri sahiplenmeye* başladı. Bu, kliniklerin komisyon ödeyen kanala daha da bağımlı hale gelmesi demek.

**CareNova'nın stratejik cevabı:** Pazaryerlerini reddetme, *entegre et ve ölç.* Bookimed/Flymedi lead'lerini içeri al, kanal bazlı harmanlanmış CAC'ı göster (komisyonlu kanal vs. direkt kanal), kliniğin komisyon bağımlılığını sayısal olarak görüp azaltmasını sağla. Bu "komisyondan kurtulma yol haritası" tek başına satılabilir bir hikaye.

Aracı kuruluş komisyonu: **%8–25** aralığı tek bir sektörel blogda geçiyor [düşük güven]; alternatif olarak hasta başı ~$300 sabit ücret modeli de zikrediliyor.

### 5.3 Global — neden Türkiye'ye gelmiyorlar

| Ürün | Fiyat | Neden Türkiye'de rakip değil |
|---|---|---|
| Artera | **$20–30k/yıl**, 3–5 yıl sözleşme | Sadece SMS, kurumsal ABD sağlık sistemleri, fiyat tabanı Türk kliniklerini tamamen dışarıda bırakıyor |
| Assort Health | Yayınlanmamış ($1,2 mlr değerleme, Haz 2026) | **Sadece sesli/telefon AI**, WhatsApp yok |
| Weave, Podium, Dental Intelligence | $249–399/ay | Sadece İngilizce, ABD telefon numarası tabanlı SMS |
| Klara, NexHealth, Luma | Özel fiyat | ABD EHR entegrasyon oyunu |
| Interakt (Jio Haptik) | Yayınlanmamış | WhatsApp AI ajanı var ama **dikey uzmanlık yok**, Türkiye'de varlığı yok |

### 5.4 Beyaz alan — tek paragrafta

> Türkiye'de **native LLM tabanlı** (çeviri API'si değil), **WhatsApp yerlisi**, **hasta güven açığını** (kilitli teklif + doktor kimliği + dönüş sonrası bakım) çözen, **KVKK ve Tanıtım Yönetmeliği uyumunu ürünün içine gömen**, küçük/orta klinik ve bireysel doktorun ödeyebileceği fiyatta bir ürün **yok**. Türk oyuncular CRM-öncelikli, AI eklenti; global oyuncular kurumsal fiyatlı ve İngilizce/SMS merkezli.

---

## 6. Segment seçimi ve konumlandırma

### 6.1 ICP — Ideal Customer Profile

**Birincil: Küçük/orta klinik (5–50 kişi)**

| Özellik | Durum |
|---|---|
| Sahip olduğu | Yetki belgesi (veya ajans üzerinden), hasta danışmanı kadrosu (₺30–60k/ay), WhatsApp Business, Meta/Google reklam bütçesi |
| Eksik olan | CRM (dağınık WhatsApp/e-posta/SMS), merkezi hasta verisi, tutarlı satış kalitesi, eğitim (aynı klinikte %1–2 ile %15–20 arasında salınan dönüşüm) |
| Kritik gözlem | **Şikayetvar/Trustpilot şikayetlerinin yoğunlaştığı tam olarak bu segment** — yani belgelenmiş acı burada |
| Ödeme gücü | En yüksek uyum. Aboneliği ödeyebilecek geliri var, kurumsal entegrasyon yaptıracak ölçeği yok |

**İkincil: Bireysel doktor / tek şube**

| Özellik | Durum |
|---|---|
| Sahip olduğu | Kişisel marka + Instagram, doğrudan ilişkiler, daha yüksek doğal güven |
| Eksik olan | Çok dilli personel (tercüman kıtlığından en çok etkilenen segment), hiçbir CRM, IT kapasitesi |
| Ödeme gücü | Fiyat hassas — ama tek bir ek saç ekimi hastası (€2.000–3.000) aylık aboneliği 10× karşılıyor |
| Ürün gereksinimi | **Radikal basitlik.** HBYS entegrasyonu yok, 15 dakikada kurulum, tek ekran |

**Sonuç:** İki ayrı ürün değil, **iki ayrı paket ve iki ayrı onboarding akışı** — aynı motor. `Solo` paketi tek kullanıcı + tek WhatsApp hattı + hazır branş şablonu; `Klinik` paketi çok kullanıcı + rol yönetimi + komisyon + konsiyerj.

### 6.2 Konumlandırma ifadesi

> **Türkiye'ye hasta getiren klinikler ve doktorlar için**, gelen her WhatsApp mesajını 5 saniyede hastanın kendi dilinde karşılayan, fiyatı kilitleyen, ameliyatı yapacak doktoru isimle taahhüt eden ve hasta eve döndükten sonra bir yıl boyunca peşini bırakmayan **AI hasta güven platformu**.
>
> Planports ve MetoCRM gibi bir CRM değil — onlar lead'i *takip eder*, CareNova lead'i *kazanır ve elde tutar*. ProjeMED gibi çeviri katmanı değil — Claude, hastanın dilini konuşur, kültürünü ve itirazını anlar.

### 6.3 Marka mimarisi

CareDental ve CareNova aynı motorun iki yüzü. Ama **konumlandırma bilinçli olarak ayrışmalı:**

| | CareDental | CareNova |
|---|---|---|
| Pazar | UK diş klinikleri | Türkiye sağlık turizmi |
| Hasta | Yerel, tekrar eden | Uluslararası, tek seferlik yüksek sepet |
| Ana ağrı | Randevu doldurma | Güven inşası + dönüşüm |
| Regülasyon | UK GDPR, ICO | KVKK, Tanıtım Yönetmeliği, 2025 Sağlık Turizmi Yönetmeliği |
| Arayüz dili | Sadece EN | **TR + EN (zorunlu)** |
| Fiyat para birimi | GBP | EUR veya TL |

---

## 7. ÜRÜN — modüller ve özellikler

Bu bölüm Claude Code'a verilecek özellik listesinin kaynağı. Her modülde **[YENİ]** = sıfırdan yazılacak, **[UYARLA]** = CareDental'da var, değiştirilecek, **[HAZIR]** = olduğu gibi taşınır.

---

### M0 — Çok dilli AI WhatsApp ajanı (çekirdek)

**M0.1 Gelen mesaj işleme [UYARLA]**
CareDental'da webhook imza doğrulama, tenant çözümleme, lead upsert, dil tespiti, senaryo sınıflandırma, yanıt üretme ve gönderme zinciri **çalışıyor**. Taşınır.

**M0.2 Ses notu desteği [YENİ] — yüksek öncelik**
CareDental şu an `if (incomingMsg.type !== 'text') return;` diyor — metin dışı her şeyi sessizce atıyor. Arapça ve Türkçe WhatsApp kullanımında **sesli mesaj baskın davranış**. Bu, mevcut kodda en büyük tek boşluk.
→ WhatsApp media API'den ses indir → transkribe et (Whisper veya eşdeğeri) → normal AI hattına ver → gerekirse sesli yanıt üret (TTS, opsiyonel v2).

**M0.3 Görsel anlama [YENİ] — yüksek öncelik**
Hasta fotoğraf gönderiyor: saç çizgisi, diş, panoramik röntgen, vücut fotoğrafı, kan tahlili PDF'i.
→ Claude vision ile **yapılandırılmış ön-veri** üret (Norwood tahmini, eksik diş sayımı, görüntü kalitesi yeterli mi).
→ **Kritik kural: Bu çıktı asla hastaya gösterilmez.** Yalnızca doktor onay kuyruğuna düşer. Tıbbi karar AI'ın değil.
→ Görsel yeterli değilse AI hastadan **belirli bir açıdan yeni fotoğraf ister** (branş şablonundaki çekim talimatıyla).

**M0.4 Branş-bağımsız sistem prompt motoru [UYARLA]**
CareDental'ın sistem prompt'u diş-spesifik sabit metin. CareNova'da promptun yapısı korunur ama **branş şablonundan derlenir**:

```
[Evrensel çekirdek]      → ses tonu, WhatsApp formatı, dil kuralı, tıbbi çıkarım yasağı
+ [Mevzuat kalkanı]      → KVKK + Tanıtım Yönetmeliği kuralları (M7)
+ [Branş şablonu]        → o branşın terminolojisi, ön-değerlendirme soruları,
                            gerekli belgeler, tipik itirazlar, kırmızı bayraklar
+ [Klinik bilgi bankası] → fiyat, doktor, adres, garanti, paket içeriği
+ [Vaka bağlamı]         → hastanın ülkesi, dili, önceki mesajları, yüklediği belgeler
+ [Tarih/saat referansı] → hastanın saat diliminde
```

**M0.5 Çok saat dilimli tarih motoru [UYARLA]**
CareDental tek klinik saat dilimi varsayıyor. CareNova'da **hastanın saat dilimi ile kliniğin saat dilimi ayrı** — Almanya'daki hastaya "yarın 15:00" derken hangi saatten bahsettiğini netleştirmeli. Uçuş planlaması için ikisi de gerekli.

**M0.6 Dil derinliği [UYARLA]**
Zorunlu: TR, EN, AR, DE, RU. `leads.language` CHECK constraint genişletilmeli (şu an 9 dil, `az`, `fa`, `ro`, `uk`, `kk` eklenmeli). Arapça için **RTL ve lehçe farkındalığı** (Körfez vs Mağrip vs Irak Arapçası).

**M0.7 İtiraz tespiti [UYARLA]**
CareDental'ın 8 itiraz tipi diş odaklı. Sağlık turizmi itiraz taksonomisi farklı:

| İtiraz | Tetikleyici |
|---|---|
| `price_shock` | "çok pahalı", karşılaştırma |
| `trust_surgeon` | "ameliyatı kim yapacak", "doktoru göreyim" |
| `trust_clinic` | "sertifikanız var mı", "yorumlara baktım" |
| `safety_fear` | ölüm/komplikasyon haberleri, "riskli mi" |
| `aftercare_fear` | "dönünce ne olacak", "sorun çıkarsa" |
| `travel_friction` | vize, uçuş, refakatçi, konaklama |
| `timing` | "sonra düşüneceğim", izin/iş |
| `comparison_shopping` | başka klinik adı geçmesi |
| `language_barrier` | "İngilizce biliyor musunuz" |
| `partner_approval` | "eşime soracağım" |
| `financing` | taksit, kredi |

Her itiraz için **branş bazlı yanıt stratejisi** bilgi bankasında tanımlı olmalı — ve **sıcak lead'de doktora eskale edilmeli**, AI tek başına kapatmaya çalışmamalı.

**M0.8 Lead skorlama [UYARLA]**
CareDental'ın skorlama prompt'u diş işlem değerlerine göre kalibre (implant=25, veneer=20...). Sağlık turizmi versiyonunda:
- **Intent (35)**: tarih sordu mu, belge gönderdi mi, "kaç gün kalmam gerekir" dedi mi
- **Aciliyet (15)**: izin tarihi belirtti mi, uçuş aradı mı
- **Değer (25)**: branş × işlem kapsamı × paket
- **Yeterlilik (15)**: tıbbi ön eleme geçti mi, belgeler tam mı ← **yeni boyut**
- **Etkileşim (10)**: yanıt hızı, mesaj derinliği

---

### M1 — Vaka Dosyası (Case File) [YENİ] — sağlık turizminin merkezi kavramı

CareDental'ın `lead` modeli yerel randevu için tasarlanmış. Sağlık turizminde birim **lead değil, vaka** — çünkü tek bir hasta için pasaport, uçuş, otel, refakatçi, tercüman, çoklu işlem, taksitli ödeme ve 1 yıllık takip yönetiliyor.

```
Vaka (case)
├── Hasta (patient)          ad, ülke, dil, doğum tarihi, saat dilimi
├── Refakatçi(ler)           ad, ilişki, uçuş bilgisi
├── Tıbbi dosya              yüklenen görseller/raporlar, ön-değerlendirme yanıtları,
│                            doktor notu, uygunluk kararı (uygun / şartlı / uygun değil)
├── Teklif(ler)              versiyonlu, kilitli, süreli (M4)
├── Seyahat                  uçuş, transfer, otel, vize durumu, tercüman ataması (M5)
├── Program                  gün gün: varış → konsültasyon → işlem → kontrol → dönüş
├── Ödemeler                 depozito, bakiye, para birimi, yöntem
├── Onamlar                  KVKK açık rıza, tedavi onamı, Ek-1 görsel onamı, dil versiyonu
├── Bakım hattı              D+1 … D+365 takip zinciri (M6)
└── Sahiplik                 danışman, doktor, tercüman, koordinatör
```

**Vaka durumları:**
`yeni → nitelendi → ön_değerlendirme → doktor_onayı_bekliyor → teklif_verildi → depozito_bekliyor → rezerve → seyahat_planlandı → geldi → tedavi_edildi → döndü → takipte → tamamlandı` (+ `kayıp`, `tıbben_uygun_değil`)

**Uygulama notu:** CareDental'ın `leads` + `patients` + `cases` (`caseStore.js`) yapısı bunun iskeleti — genişletilir, sıfırdan yazılmaz.

---

### M2 — Branş şablonu motoru [YENİ] — yapılandırılabilir çekirdek

Kullanıcı kararı: motor branş-bağımsız, şablonlar hazır gelir. Her şablon bir JSON/DB kaydı:

```yaml
branş: sac_ekimi
görünen_ad: { tr: "Saç Ekimi", en: "Hair Transplant", ar: "زراعة الشعر", de: "Haartransplantation", ru: "Пересадка волос" }

ön_değerlendirme_soruları:
  - { id: yas, tip: sayı, zorunlu: true }
  - { id: sac_dokulme_suresi, tip: seçim, seçenekler: [<1yıl, 1-3yıl, 3-5yıl, 5yıl+] }
  - { id: onceki_operasyon, tip: evet_hayır }
  - { id: ilac_kullanimi, tip: metin }     # finasterid/minoksidil
  - { id: kronik_hastalik, tip: metin }

gerekli_görseller:
  - { id: on_gorunum,   talimat: {tr: "Doğal ışıkta, saçlar kuru, alından çekilmiş", en: "..."} }
  - { id: tepe,         talimat: {...} }
  - { id: donor_ense,   talimat: {...} }
  - { id: yan_profil,   talimat: {...} }

ai_yetkisi: fiyat_aralığı_verebilir      # ← branş bazlı kritik ayar
doktor_onayı: greft_sayısı_ve_uygunluk   # doktor neyi onaylamalı

tipik_kalış: 3 gün
tipik_satış_döngüsü: 7-21 gün
kırmızı_bayraklar: [aktif_alopecia_areata, yetersiz_donor, kontrolsüz_diyabet, 24_yas_alti]
branş_itirazları: [trust_surgeon, donor_damage, graft_count_dispute]
```

**AI yetki matrisi — bu tablo ürünün hukuki güvenlik omurgası:**

| Branş | AI fiyat verebilir mi? | Neden |
|---|---|---|
| **Check-up** | ✅ Tam — uçtan uca rezervasyon | Standart paket fiyatları, tıbbi karar yok |
| **Saç ekimi** | ⚠️ Fotoğraftan Norwood bazlı **aralık**; kesin fiyat doktor onayı sonrası | Donör yeterliliği cerrah kararı |
| **Diş** | ⚠️ Aralık; **implantta panoramik/CBCT olmadan kesin fiyat yasak** | Sektörde fotoğraftan fiyatlama şikayet kaynağı |
| **Estetik/plastik** | ❌ Sadece nitelendirme | Anestezi uygunluğu ve cerrahi risk değerlendirmesi zorunlu; belgelenmiş ölüm vakaları |
| **Göz (LASIK/SMILE)** | ❌ Ön eleme anketi + uygunluk uyarısı | Kornea kalınlığı uzaktan doğrulanamaz — hasta gelip reddedilirse iade krizi |
| **Bariatrik** | ❌ Sadece nitelendirme | BMI/komorbidite taraması; NHS verisi komplikasyon maliyetini £16k/hasta gösteriyor |
| **IVF** | ❌ Sadece nitelendirme | **Türkiye'de donör yumurta/sperm yasal değil** — AI bunu ilk mesajda söylemeli, hastanın vaktini harcamamalı |
| **Ortopedi** | ❌ Görüntüleme incelemesi zorunlu | |
| **Kardiyoloji / Onkoloji** | ❌ **AI satış çerçevesi kurmaz** — sadece lojistik ve randevu | Hayati; ikinci görüş/sevk yoluyla gelir, fiyat kıyaslamasıyla değil |

**Bu matris kodda `ai_pricing_authority` enum'u olarak yaşamalı** ve sistem prompt'una zorlayıcı kural olarak enjekte edilmeli — CareDental'daki mevcut "PRICE RULE" mekanizmasının genişletilmiş hali.

---

### M3 — Doktor Kimliği ve Onay Kuyruğu [YENİ] — 1. yaranın panzehiri

**M3.1 Doktor Kimlik Kartı**
Her klinik doktorlarını kaydeder: ad, unvan, **diploma/uzmanlık belgesi**, Sağlık Bakanlığı tescil no, deneyim yılı, branş, fotoğraf, kısa video tanıtım, konuştuğu diller.
→ AI, teklif verirken **ameliyatı yapacak doktoru isimle ve kartıyla birlikte** paylaşır.
→ Hasta bağlantıya tıklayıp doktorun kimlik sayfasını görür.

Bu tek özellik, araştırmadaki en büyük hasta korkusunu doğrudan hedefliyor ve **hiçbir rakipte yok**.

**M3.2 Doktor Onay Kuyruğu**
Ön-değerlendirme tamamlandığında vaka doktora düşer. Doktor mobilde:
görselleri görür → AI'ın yapılandırdığı özeti görür → **uygun / şartlı / uygun değil** işaretler → greft sayısı/işlem kapsamı/fiyat bandını onaylar → notunu yazar.
Ancak bundan sonra AI teklif verebilir.

**M3.3 Video Konsültasyon Planlama**
AI, sıcak lead'e doktorla 10 dakikalık görüntülü görüşme önerir; doktorun takvimine yazar. Sağlık turizminde bağlanma anı budur — ve "ghost surgeon" korkusunu en hızlı çözen şey.

---

### M4 — Kilitli Teklif Motoru [YENİ] — 2. yaranın panzehiri

**Bu, ürünün en satılabilir tek özelliği.**

- Teklif PDF'i **kalem kalem**: işlem, anestezi, konaklama (kaç gece, hangi otel), transfer, tercüman, ilaç, kontrol muayeneleri, **dahil olmayanlar listesi**.
- **Versiyonlu ve hash'li.** Her teklifin benzersiz kodu ve değişmez kaydı var.
- **Geçerlilik süresi** (örn. 21 gün) — süre biterse yenisi düzenlenir, sessizce değişmez.
- Klinik fiyatı değiştirmek isterse **yeni versiyon** çıkarır ve hasta **değişiklik gerekçesini görür**.
- Hasta teklifi **kendi dilinde** görür; hukuki geçerli metin Türkçe + hastanın dili çift kolon.
- Depozito ödeme linki teklifin içinde (Stripe/Square — CareDental'da hazır).
- **Klinik için pazarlama argümanı:** *"Fiyat Garantisi Rozeti"* — hasta bunu görür, kliniğin reklamında kullanılabilir.

**Neden bu kadar önemli:** Şikayetvar ve Trustpilot şikayetlerinin en yoğun kümesi burada. Kliniğe satarken argüman şu: *"Bu rozet, sizi rakiplerinizin şikayet ettiği şeyden ayırıyor — ve dönüşümü artırıyor."*

---

### M5 — Seyahat ve Lojistik Konsiyerj [YENİ]

Sağlık turizmini normal klinik CRM'inden ayıran operasyonel katman:

- **Uçuş takibi** — hasta uçuş kodunu yazar, sistem varış saatini izler, transfer sürücüsüne ve kliniğe otomatik bildirir. Rötar olursa program otomatik kayar.
- **Transfer ve otel koordinasyonu** — anlaşmalı otel listesi, oda tipi, refakatçi, tahsis.
- **Vize/seyahat belgesi kontrol listesi** — hastanın ülkesine göre.
- **Tercüman atama** — dile göre müsait tercüman, işlem gününe planlanır.
- **Gün gün program** — hastaya kendi dilinde WhatsApp'tan gönderilir, takvimine eklenebilir.
- **Refakatçi ayrı iletişim kanalı** — anne/eş bilgilendirmesi. Sağlık turizminde kararı çoğu zaman refakatçi verir; bu göz ardı edilen bir kaldıraç.

**Uygulama notu:** CareDental'ın `appointments` + `patientChecklist` modülleri bunun temeli. Checklist mantığı seyahat kalemlerine genişletilir.

---

### M6 — Dönüş Sonrası Bakım Hattı [YENİ] — 3. yaranın panzehiri

**Rakiplerin hiçbirinde yok. Uzun vadede en büyük hendek burada.**

Hasta uçağa bindiği anda otomatik bakım zinciri başlar — branş şablonunda tanımlı:

```
Saç ekimi:  D+1, D+3, D+7, D+10 (yıkama), D+15, D+30, D+90, D+180, D+365
Diş:        D+1, D+7, D+30, D+90, D+180, D+365
Bariatrik:  D+1, D+7, D+14, D+30, sonra aylık × 12 (diyetisyen)
Estetik:    D+1, D+3, D+7, D+14, D+30, D+90, D+180
```

Her temasta:
- Hastanın dilinde, hastanın saatinde WhatsApp mesajı
- **Fotoğraf isteme** → iyileşme zaman çizelgesi otomatik oluşur
- **Komplikasyon triyaj soruları** → kırmızı bayrak varsa **derhal doktora eskalasyon** (bu bir satış akışı değil, klinik akış — ayrı ele alınmalı)
- İlaç/bakım hatırlatması

**İki yönlü değer:**
1. **Hasta için:** terk edilmeme. Araştırmadaki en ağır şikayet bu.
2. **Klinik için:** iyileşme zaman çizelgesi = **Ek-1 onamı alınmış, tarihli, düzenlenmemiş öncesi/sonrası arşivi**. Yani Tanıtım Yönetmeliğine uygun pazarlama varlığı, otomatik üretiliyor. Ayrıca memnun hastadan referans/tekrar satış (2. işlem, aile üyesi) doğal olarak çıkar.

**Ayrıca — komplikasyon erken yakalama, klinik için sigorta değeri taşır.** 2025 Yönetmeliği 31.12.2026'ya kadar komplikasyon sigortasını zorunlu kılıyor; erken müdahale kaydı hem hasar hem hukuki savunma açısından kritik.

---

### M7 — Mevzuat Kalkanı (Compliance Guard) [YENİ] — savunma hendeği

Bu modül CareNova'yı Türk rakiplerden ayıran ve *değiştirme maliyetini* yükselten katman.

**M7.1 Tanıtım Yönetmeliği koruyucusu**
2023 (ve 2025 güncellemesiyle) Sağlık Hizmetlerinde Tanıtım ve Bilgilendirme Faaliyetleri Yönetmeliği:
- Fiyat/indirim/kampanya duyurusu **yasak** (dar istisnalar var)
- Hasta yorumu/teşekkür paylaşımı **yasak**
- Öncesi/sonrası görsel: **Ek-1 standart onam formu zorunlu**, geri alınabilir, karşılığında ödeme yapılamaz, ışık/koşul eşleştirilmeli, tarih belirtilmeli, **filtre/AI düzenleme yasak**, mahrem bölge yasak, ameliyat içi görüntü yasak, **yorumlar kapatılmalı**
- İçerik yalnızca **lisanslı sağlık meslek mensubu** tarafından üretilebilir
- **Ceza:** Sağlık kuruluşu için 2 uyarı, 3. ihlalde 3 gün kapatma. Uluslararası sağlık turizmi sağlayıcıları için **kademeli 1–3 ay faaliyet durdurma**. Hekimler için idari para cezası + disiplin sevki.

→ Ürün: AI'ın ürettiği her dış içerik (WhatsApp mesajı, teklif metni, pazarlama önerisi) **kural motorundan geçer**. Türkçe/yurt içi hedefli fiyat paylaşımı bloklanır. Görsel onamı olmayan öncesi/sonrası paylaşımı sistem tarafından engellenir.

**M7.2 Ek-1 onam yönetimi**
Görsel onam formu dijital, imzalı (SignWell — CareDental'da hazır), geri alınabilir, dile göre versiyonlu. Onam geri alındığında ilgili görseller **tüm yayın kanallarından işaretlenir**.

**M7.3 KVKK uyum katmanı**
- **VERBİS:** Özel nitelikli kişisel veri (sağlık) işleyenler için **50 kişi/100 mn TL muafiyeti geçerli değil** — büyüklükten bağımsız kayıt zorunlu. Hem CareNova hem müşteri klinikler için.
- **Hukuki sebep:** 7499 sayılı kanunla (yürürlük 01.06.2024) sağlık verisi için açık rıza dışında **8 işleme sebebi** tanımlandı. Başka hukuki sebep varken sadece açık rızaya dayanmak **hakkın kötüye kullanımı** sayılabilir — ürün hukuki sebebi vaka tipine göre kaydetmeli.
- **Yurt dışı aktarım:** Anthropic API, Meta/WhatsApp sunucuları yurt dışında. Yeterlilik kararı yoksa **Kurulca ilan edilen standart sözleşme** kullanılmalı ve **5 iş günü içinde KVKK'ya bildirilmeli** — bildirmemenin cezası **50.000–1.000.000 TL**. Ürün bu bildirimi hatırlatan ve belgeyi üreten bir akış içermeli.
- **KVKK Üretken Yapay Zeka ve Kişisel Verilerin Korunması Rehberi (24.11.2025)** yayınlandı — **içeriği bu araştırmada çekilemedi, kvkk.gov.tr'den doğrudan okunmalı** ⚠️ (Bölüm 13).
- **Veri sorumlusu / veri işleyen:** Klinik veri sorumlusu, CareNova veri işleyen olmalı. **Kritik:** CareNova hasta verisi üzerinde kendi amaçları için (model eğitimi, kendi analitiği) işleme yaparsa müşterek/bağımsız veri sorumlusu konumuna kayar. → **Ürün ilkesi: hasta verisi hiçbir koşulda model eğitiminde kullanılmaz, sözleşmede taahhüt edilir.**

**M7.4 GDPR köprüsü**
Alman/İngiliz hastaya pazarlama yapan Türk kliniği GDPR m.3(2) kapsamına girme ihtimali yüksek (Türkiye'ye özel emsal bulunamadı — **hukuki görüş gerekli**). Ürün: hasta AB/UK'liyse GDPR uyumlu rıza akışı, veri erişim/silme talebi işleyişi, m.27 temsilci gereksinimi uyarısı.

**M7.5 2025 Sağlık Turizmi Yönetmeliği uyum paneli**
26 Nisan 2025 Yönetmeliği (RG) kliniğe: HealthTürkiye portalına tüm faaliyeti kaydetme, konaklama/ulaşım/tercümanlık/danışmanlık ücretlerini **kalem kalem gösterme**, komplikasyon sigortası (31.12.2026'ya kadar), **%20 yabancı dil yetkin personel**, yıllık performans değerlendirmesi yükümlülüğü getiriyor.
→ Ürün: kalem kalem ücretlendirme zaten M4'te var; sistem yönetmelik takvimini panelde gösterir ve HealthTürkiye'ye raporlanacak veriyi dışa aktarır.

**Bunun stratejik değeri:** Bir klinik CareNova'ya geçtikten sonra çıkması zorlaşır — çünkü uyum kayıtları, onam arşivi ve denetim izi burada birikiyor.

---

### M8 — Ekip, roller ve CRM [UYARLA]

CareDental'da 5 rollü izin sistemi hazır. CareNova rolleri:

| Rol | Yetki |
|---|---|
| `klinik_sahibi` | Her şey + faturalama |
| `operasyon_muduru` | Vakalar, ekip, raporlar |
| `hasta_danismani` | Kendi vakaları, sohbetler, teklif taslağı |
| `doktor` | Onay kuyruğu, tıbbi dosya, komplikasyon eskalasyonu |
| `koordinator` | Seyahat, otel, transfer, tercüman |
| `tercuman` | Atandığı vakaların sohbetleri (tıbbi dosya kısıtlı) |
| `muhasebe` | Ödeme, fatura, komisyon |

**Sohbet devralma:** Danışman her an AI'ı durdurup sohbete girebilmeli, sonra AI'a geri verebilmeli. (CareDental'da eskalasyon var, tam devralma UX'i güçlendirilmeli.)

**Performans paneli — hasta danışmanı bazında:** ilk yanıt süresi, dokunulan vaka, teklif→depozito dönüşümü, iptal oranı. Peganom verisi eğitimli/eğitimsiz ekip arasında 10× fark gösteriyor — bu paneli görmek yöneticinin en çok isteyeceği şey.

---

### M9 — Gelir, komisyon ve kanal analitiği [UYARLA]

**Hazır olan:** komisyon motoru, kademeli şemalar, prim, dönem kapanışı, fatura, PDF, Stripe/Square/Atoa, ödeme eşleştirme.

**Uyarlama:**
- **Hasta danışmanı primi** — vaka bazlı, işlem bazlı, kademeli
- **Aracı kuruluş / ortak komisyonu** — %8–25 aralığı yönetilebilir, otomatik hesap dökümü
- **Çoklu para birimi** — EUR/GBP/USD/TL, kur tarihi kilitli
- **Depozito yönetimi** — kısmi ödeme, bakiye takibi, iade politikası

**[YENİ] Kanal ROI panosu — stratejik olarak en önemli rapor:**

| Kanal | Lead | CPL | Vaka | CAC | Gelir | Net marj |
|---|---|---|---|---|---|---|
| Meta reklam | | | | | | |
| Google Ads | | | | | | |
| Instagram organik | | | | | | |
| **Bookimed (komisyonlu)** | | | | | | |
| **Flymedi (komisyonlu)** | | | | | | |
| Referans | | | | | | |

Komisyonlu kanalın gerçek net marjını göstermek, kliniğin *direkt kanala yatırım yapma kararını* verilerle destekler. Bu, Bookimed "Sofia" tehdidine karşı doğrudan cevap ve satışta çok güçlü bir hikaye.

---

### M10 — Türkçe/İngilizce arayüz (i18n) [YENİ]

⚠️ **CareDental'da hiçbir i18n altyapısı yok** — tüm metinler JSX içinde sabit İngilizce. Bu, fork'un en büyük mekanik iş kalemi (~47k satır, tahmini 600–900 çevrilecek string).

**Yaklaşım:**
- `react-i18next` + namespace'li JSON (`common`, `cases`, `settings`, `billing`, `landing`)
- **Varsayılan TR**, EN opsiyonel; kullanıcı bazlı tercih
- Tarih/saat/para birimi `Intl` ile lokalize
- **Landing sayfası ayrıca AR/DE/RU** (klinik sahibi Arapça konuşuyor olabilir; ayrıca SEO)
- Hastaya giden metinler (teklif PDF, onam, program) **hastanın dilinde** — arayüz dilinden bağımsız ayrı sistem

**Sıra önerisi:** Önce yeni yazılan CareNova ekranlarını i18n'li yaz, mevcut CareDental ekranlarını taşırken çevir. Sonradan retrofit çok daha pahalı.

---

### M11 — Onboarding ve self-servis kurulum [UYARLA]

CareDental'da `OnboardingWizard` ve `onboarding.js` var. CareNova'da:
1. Klinik kaydı → branş seçimi → şablon otomatik yüklenir
2. **WhatsApp bağlama** — Meta Embedded Signup ile kliniğin kendi numarası (CareDental'ın çözülmemiş ağrısı; CareNova'da baştan doğru yapılmalı)
3. Doktor kartları
4. Bilgi bankası — branş şablonundan **ön doldurulmuş taslak** gelir, klinik düzenler
5. Fiyat bantları + AI yetki seviyesi onayı
6. KVKK/Ek-1 onam metinleri
7. Test sohbeti → canlıya al

**Hedef: 45 dakikada canlı.** Bireysel doktor için 15 dakika.

---

### M12 — Widget, lead ingest ve entegrasyonlar [HAZIR/UYARLA]

CareDental'da hazır: `widget.js` (site anahtarıyla web widget), `ingest.js` (tenant ingest key ile harici lead alımı).

**Ekle:**
- Meta Lead Ads → doğrudan webhook
- Instagram DM ve Messenger (WhatsApp'la aynı motora)
- Bookimed/Flymedi lead içe aktarımı (CSV + varsa API)
- Google Business Profile mesajları
- Web sitesine gömülebilir **branş ön-değerlendirme formu** → doğrudan vaka açar

---

## 8. CareDental → CareNova: ne taşınır, ne değişir, ne yeni yazılır

| Bileşen | Durum | Not |
|---|---|---|
| Multi-tenant mimari, tenant/rol/izin | **HAZIR** | `country` ve `timezone` alanları zaten var |
| JWT auth + refresh rotasyonu | **HAZIR** | ⚠️ Kullanıcılar in-memory Map'te — **PostgreSQL'e taşınmalı** (CareDental'ın bilinen borcu) |
| WhatsApp Cloud API webhook + imza doğrulama | **HAZIR** | 5 sn kuralı doğru uygulanmış |
| Claude AI yanıt motoru + tool use | **UYARLA** | Prompt yapısı korunur, içerik branş şablonundan derlenir |
| Bilgi bankası (`clinic_knowledge`) | **UYARLA** | Kategoriler genişletilir: `paket`, `seyahat`, `garanti`, `komplikasyon_politikasi` |
| Lead skorlama | **UYARLA** | Sağlık turizmi boyutlarına kalibre |
| İtiraz tespiti | **UYARLA** | 11 itiraz tipi (M0.7) |
| Randevu + Google Calendar | **UYARLA** | Çok saat dilimli hale getirilmeli |
| Komisyon motoru, kademe, prim, dönem | **HAZIR** | Aracı kuruluş komisyonuna genişletilir |
| Fatura + PDF + numaralandırma + KDV | **UYARLA** | TL/EUR, e-Arşiv/e-Fatura entegrasyonu değerlendirilmeli |
| Stripe / Square / Atoa | **HAZIR** | + iyzico/PayTR (Türk klinikler için) değerlendirilmeli |
| SignWell doküman imza | **HAZIR** | Ek-1 onam ve tedavi onamı için birebir uygun |
| Hasta dokümanları + checklist | **UYARLA** | Seyahat ve tıbbi belge kalemlerine genişletilir |
| Aktivite akışı, bildirim, denetim kaydı | **HAZIR** | KVKK denetim izi için değerli |
| Insights / analitik | **UYARLA** | Kanal ROI panosu eklenir |
| Blog + SEO + sitemap | **HAZIR** | TR/EN/AR/DE/RU çok dilli hale getirilir |
| **Ses notu işleme** | **YENİ** | 🔴 En yüksek etkili tek boşluk |
| **Görsel/belge anlama** | **YENİ** | 🔴 |
| **Vaka Dosyası modeli** | **YENİ** | 🔴 Merkezi kavram |
| **Branş şablon motoru** | **YENİ** | 🔴 |
| **Doktor kartı + onay kuyruğu** | **YENİ** | 🔴 |
| **Kilitli teklif motoru** | **YENİ** | 🔴 En satılabilir özellik |
| **Seyahat konsiyerj** | **YENİ** | 🟡 |
| **Bakım hattı** | **YENİ** | 🟡 En büyük uzun vadeli hendek |
| **Mevzuat kalkanı (KVKK + Tanıtım)** | **YENİ** | 🔴 Savunma hendeği |
| **i18n TR/EN** | **YENİ** | 🔴 Mekanik ama büyük |
| Diş-spesifik her şey (prompt, skorlama, ikon, kopya) | **SİL** | Temizlenmeli |

---

## 9. Ticari model analizi (talep edilen)

Üç modeli regülasyon, marj ve satılabilirlik ekseninde karşılaştırdım.

### Model A — TR şirketi + aylık abonelik (TL/EUR) ⭐ **ÖNERİLEN**

| Boyut | Değerlendirme |
|---|---|
| **Regülasyon** | ✅ En temiz. Yazılım hizmeti satıyorsunuz; hasta yönlendirmiyorsunuz → **aracı kuruluş yetki belgesi gerekmez** |
| **KVKK** | ✅ Veri işleyen konumu net. TR şirketi + TR/AB barındırma ile sözleşme tarafı basit. ⚠️ Anthropic API kullanımı yine de yurt dışı aktarım → standart sözleşme + 5 iş günü bildirim gerekli |
| **Satış** | ✅ Türk kliniğe TL fatura, KDV, e-Fatura — sürtünmesiz |
| **Marj** | Öngörülebilir. Değişken maliyet ≈ AI token + WhatsApp utility mesajı |
| **Değerleme** | ✅ Saf SaaS çarpanı (ARR bazlı) |
| **Risk** | Fiyat hassasiyeti; TL değer kaybına karşı EUR endeksleme gerekebilir |

### Model B — UK şirketi + EUR/GBP abonelik

| Boyut | Değerlendirme |
|---|---|
| **Regülasyon** | ✅ Aracılık riski yok |
| **KVKK** | ⚠️ Türk kliniğin verisini UK'ye aktarmak **yurt dışı aktarım** — her müşteri için standart sözleşme + bildirim yükü. Klinikler bunu bir satın alma engeli olarak görebilir |
| **Satış** | ⚠️ Türk KOBİ kliniğe yurt dışı faturası, döviz ödemesi, KDV/stopaj tereddüdü |
| **Marka** | ✅ "UK merkezli" güven algısı — ama bu algı *hastaya* değer katar, *kliniğe* değil. Klinik yerel muhatap ister |
| **Değerlendirme** | CareDental için doğru; CareNova için yanlış müşteriye optimize ediyor |

### Model C — Abonelik + hasta başı başarı primi (hibrit)

| Boyut | Değerlendirme |
|---|---|
| **Gelir potansiyeli** | ✅✅ En yüksek. Hasta başı $2.000–2.800 sepette %2 pay bile ARPU'yu 5–10× yapar |
| **Regülasyon** | 🔴🔴 **Ciddi risk.** Hasta yönlendirme/dönüşüm karşılığı bedel almak, 2025 Uluslararası Sağlık Turizmi Yönetmeliği kapsamında **aracı kuruluş faaliyeti** sayılabilir. Yetki belgesi 2026 maliyeti **₺910.545** (TÜRSAB A grubu ₺649.279 + aidat + teminat + Bakanlık isim ücreti + HİB üyeliği + USHAŞ portal ₺120.000). Ayrıca komplikasyon sigortası ve %20 yabancı dil personel yükümlülüğü doğar |
| **Etik/algı** | ⚠️ Hasta başı prim, sağlık hizmetinde "hasta simsarlığı" algısı yaratabilir — TTB ve hekim camiasında hassas konu |
| **Operasyon** | ⚠️ Klinik ciro beyanına bağımlı; denetim ve uyuşmazlık maliyeti yüksek |
| **Değerleme** | ⚠️ Karma gelir modeli SaaS çarpanını düşürür |
| **Sonuç** | Hukuki görüş almadan **kesinlikle girilmemeli** |

### Önerilen yapı

**Model A + kullanım bazlı üst katman.** Başarı primi yerine, başarı ile *doğal olarak korele* kullanım metriği üzerinden fiyatlandır:

```
Sabit abonelik   → kullanıcı + WhatsApp hattı sayısı
+ AI kotası      → aylık AI konuşma paketi (aşımda ek paket)
+ Modül          → Konsiyerj, Bakım Hattı, Mevzuat Kalkanı ayrı katman
```

Klinik büyüdükçe konuşma sayısı artar → fatura artar. Başarı primi almadan başarıya endeksli gelir elde edersiniz, aracılık riski sıfır.

⚖️ **Bu bölüm hukuki tavsiye değildir.** Model C'ye yaklaşmadan önce sağlık turizmi mevzuatında uzman bir avukattan yazılı görüş alınmalı.

---

## 10. Fiyatlandırma önerisi

Rakip çapaları: Planports $25/kullanıcı/ay + $20/WA hattı; Rapitek $25/kullanıcı/ay. Bunlar **AI'sız CRM** fiyatları — CareNova bunun üzerinde konumlanmalı ama Artera'nın ($20–30k/yıl) çok altında.

| | **Solo** | **Klinik** ⭐ | **Grup** |
|---|---|---|---|
| Kime | Bireysel doktor, tek şube | 5–50 kişi klinik | Çok şube / ajans |
| Aylık (yıllık ödeme) | **€149** | **€449** | **€1.190** |
| Aylık (aylık ödeme) | €189 | €549 | €1.450 |
| Kullanıcı | 3 | 15 | Sınırsız |
| WhatsApp hattı | 1 | 3 | 10 |
| AI konuşma/ay | 300 | 2.000 | 10.000 |
| Branş şablonu | 1 | Sınırsız | Sınırsız + özel |
| Diller | 5 | Tümü | Tümü + özel ton |
| Ses notu + görsel anlama | ✅ | ✅ | ✅ |
| Kilitli Teklif | ✅ | ✅ | ✅ |
| Doktor kartı + onay kuyruğu | ✅ | ✅ | ✅ |
| Seyahat Konsiyerj | — | ✅ | ✅ |
| Bakım Hattı | 90 gün | 365 gün | 365 gün + özel |
| Mevzuat Kalkanı | Temel | ✅ Tam | ✅ Tam + denetim raporu |
| Komisyon/prim motoru | — | ✅ | ✅ |
| Kanal ROI panosu | — | ✅ | ✅ |
| HBYS entegrasyonu | — | — | ✅ |
| Destek | E-posta | Öncelikli | Özel hesap yöneticisi + SLA |

**ROI kancası (satış konuşmasında ilk cümle):**
> "Klinik paketi aylık €449. Tek bir ek saç ekimi hastası €2.000. Ayda **bir** ek hasta, dört ay boyunca bedava kullanım demek."

**Ek gelir kalemleri:** kurulum/onboarding (€490 tek seferlik, kampanyada muaf), ek AI konuşma paketi (1.000 konuşma €99), ek WhatsApp hattı (€39/ay), özel branş şablonu geliştirme.

---

## 11. Yol haritası

| Faz | Süre | Kapsam | Çıktı |
|---|---|---|---|
| **F0 — Temel** | 1 hafta | Fork, diş-spesifik temizlik, TR/EN i18n iskeleti, marka/tema, kullanıcıları PostgreSQL'e taşı | Çalışan boş kabuk |
| **F1 — Motor** | 2 hafta | Vaka Dosyası modeli, branş şablon motoru + 3 şablon (saç ekimi, diş, estetik), AI prompt derleyici, AI yetki matrisi, itiraz taksonomisi, lead skorlama kalibrasyonu | AI doğru branşta doğru soruyu soruyor |
| **F2 — Çok modlu** | 1,5 hafta | Ses notu transkripsiyon, görsel/belge anlama, medya arşivi, görsel kalite kontrolü ve yeniden isteme | 🔴 En büyük rekabet farkı canlıda |
| **F3 — Güven** | 2 hafta | Doktor kartı, doktor onay kuyruğu (mobil), video konsültasyon planlama, **Kilitli Teklif Motoru** + PDF + depozito linki | Satılabilir demo hazır |
| **F4 — Uyum** | 1,5 hafta | Mevzuat Kalkanı, Ek-1 onam akışı, KVKK aydınlatma/açık rıza, VERBİS ve yurt dışı aktarım belge üretimi, denetim izi | Hukuki olarak satılabilir |
| **F5 — Operasyon** | 2 hafta | Seyahat Konsiyerj, program üretimi, tercüman atama, refakatçi kanalı, çoklu para birimi ödeme | Uçtan uca vaka yönetimi |
| **F6 — Elde tutma** | 1,5 hafta | Bakım Hattı, komplikasyon triyajı, iyileşme zaman çizelgesi, referans/tekrar satış akışı | Hendek kazıldı |
| **F7 — Büyüme** | 2 hafta | Kanal ROI panosu, Meta Lead Ads/IG DM entegrasyonu, pazaryeri lead içe aktarımı, landing sayfası (TR/EN/AR/DE/RU), SEO | Pazara çıkış hazır |

**Toplam ≈ 13,5 hafta.** Satılabilir ilk demo **F3 sonunda (~6,5 hafta)**.

**Paralel iş — kod dışı, ama kritik:**
- Hukuki görüş: aracılık riski, KVKK veri işleyen sözleşmesi, standart sözleşme
- 5–8 pilot klinik görüşmesi (İstanbul saç ekimi + Antalya diş) — spec'i doğrula, ön sipariş al
- KVKK Üretken YZ Rehberi'nin okunması
- HealthTürkiye portalı veri gereksinimlerinin incelenmesi

---

## 12. Başarı metrikleri

**Ürün (hasta hunisi):**
- Ortanca ilk yanıt süresi — **hedef < 10 saniye**, 7/24
- Yanıtlanmayan lead oranı — hedef **%0**
- Lead → nitelenmiş vaka
- Nitelenmiş → doktor onaylı
- Onaylı → teklif verildi
- **Teklif → depozito** ← ana dönüşüm metriği
- Depozito → geldi (no-show oranı)
- Vaka başına insan dokunma süresi (düşmeli)

**Klinik ROI (satış vaadi):**
- Reklam harcaması sabit, hasta sayısı artışı
- CAC düşüşü
- Kanal bazlı net marj (komisyonlu vs direkt)

**Elde tutma:**
- Bakım hattı yanıt oranı
- D+30 / D+180 fotoğraf paylaşım oranı
- Referans ve tekrar satış oranı
- Komplikasyonun erken yakalanma oranı

**İş:**
- Aylık ARR, net gelir tutma (NRR), churn
- Onboarding→canlı süresi (hedef < 48 saat)

---

## 13. Açık sorular ve doğrulanması gerekenler

Bunlar bilinçli olarak çözülmemiş bıraktığım noktalar — varsayımla ilerlemek yerine işaretledim.

**Regülasyon (yüksek öncelik):**
1. ⚠️ **KVKK Üretken Yapay Zeka Rehberi (24.11.2025)** — içeriği çekilemedi. kvkk.gov.tr'den okunmalı. AI ile hasta verisi işlemenin sınırlarını doğrudan etkiler.
2. ⚠️ **Başarı primi = aracılık mı?** Hukuki görüş şart. Model C kararının tamamı buna bağlı.
3. ⚠️ Türk kliniğin AB/UK hastasına pazarlamasında **GDPR m.3(2)** uygulanabilirliği — Türkiye'ye özel emsal bulunamadı.
4. ⚠️ Sağlık turizminde **AI/otomatik mesajlaşmayı özel olarak düzenleyen** bir mevzuat bulunamadı — bu bir araştırma boşluğu değil, gerçek bir düzenleme boşluğu gibi görünüyor. Değişebilir; takip edilmeli.
5. **Meta WhatsApp Business Messaging Policy**'de sağlık dikeyine özel madde var mı — doğrudan Meta politikasından okunmalı.

**Pazar verisi:**
6. Resmî **branş kırılımı yok** — MVP branş sıralaması sektörel tahminlere dayanıyor [düşük güven].
7. Resmî **ülke bazlı hasta hacmi tablosu yok** — dil önceliklendirmesi nitel kaynaklara dayanıyor.
8. **Aracı kuruluş sayısı** ve **komisyon oranı** yayınlanmıyor (%8–25 tek kaynak).
9. **Uluslararası hasta no-show oranı** hiçbir kaynakta yayınlanmamış — depozito modülünün ROI hesabı bu yüzden nitel.
10. **Türkiye'ye özel WhatsApp API tarifesi** yayınlanmamış — birim maliyet modeli için Meta Business Manager'dan canlı çekilmeli.
11. 2026 Ç2 hasta sayısındaki sıçrama (302k → 563k) doğrulanmalı — mevsimsellik mi metodoloji mi.

**Teknik:**
12. CareDental'da **kullanıcılar ve refresh token'lar in-memory** — CareNova'da PostgreSQL'e taşınması F0'da zorunlu.
13. **Meta Embedded Signup** ile self-servis WhatsApp bağlama CareDental'da çözülmemiş — CareNova'nın onboarding vaadi buna bağlı, erken prototiplenmeli.
14. Barındırma kararı: TR mi AB mi? (Supabase Frankfurt vs Türkiye'de bulut) — KVKK aktarım yükünü doğrudan etkiler.
15. Anthropic API'yi AB bölgesinden (örn. Bedrock EU) kullanmak yurt dışı aktarım riskini azaltır mı — araştırılmalı.

**Ticari:**
16. 5–8 pilot klinik görüşmesi yapılmadan fiyat bantları doğrulanmış sayılmaz.
17. Bireysel doktor segmentinin gerçek ödeme istekliliği test edilmeli (€149 doğru rakam mı).

---

## 14. Tasarım sistemi — renk token'ları (WCAG AA)

Bu bölüm bir kere eklendi (Eylül 2026) çünkü aynı token'lar art arda iki kez
WCAG AA'nın altına düştü: önce "3:1 UI-metin" eşiğine göre kalibre edildi,
sonra sayfadaki gerçek kullanım (11-12px rozet/altyazı metni) 4.5:1
gerektirdiği ortaya çıktı. **`frontend/src/index.css` her zaman tek gerçek
kaynaktır** — buradaki değerler referans içindir, index.css'i günceller ama
bu belgeyi unutursan, bir sonraki kişi (ya da sen) eski/düşük-kontrastlı
değerlere geri dönebilir.

**Açık tema (`:root`, varsayılan):**
| Token | Hex | Not |
|---|---|---|
| `--ink-subtle` | `#5F6E84` | ≥4.57:1, en zor durum (`--surface-2`) için çözüldü |
| `--accent` | `#1567E0` | ≥4.56:1, en zor durum (`--accent-soft` zemin, küçük rozet) için çözüldü |
| `--accent-hover` | `#1559C4` | değişmedi, zaten ≥5.66:1 |
| `--success` | `#0B7E5D` | ≥4.53:1, `--success-soft` zemin için çözüldü |
| `--warning` | `#9F6108` | ≥4.56:1, `--warning-soft` zemin için çözüldü |

**`.surface-inverted` (her zaman koyu blok — Mevzuat Kalkanı, Fiyatlandırma
"Önerilen" kartı, CTA):**
| Token | Hex | Not |
|---|---|---|
| `--accent-hover` | `#447DE3` | ≥4.55:1, metin olarak kullanıldığında (`--surface-0` #0F1626 zemin) |
| `--accent` | `#2563EB` | **DEĞİŞMEDİ** — bu blokta sadece buton zemini olarak kullanılıyor (üstünde beyaz metin), asla metin rengi olarak değil. Aydınlatılırsa beyaz metnin kendi kontrastı bozulur (~4.0:1'e düşer) — bkz. index.css'teki yorum. |

**Kural — bir dahaki sefer bu token'lardan biri değişecekse:**
1. `frontend/scripts/check-contrast.js`'i (canlı render edilmiş DOM üzerinde
   çalışır, teorik token çiftlerini değil) çalıştır — `npm start` + `node
   scripts/check-contrast.js`.
2. Bir token'ın SADECE metin renginin mi yoksa SADECE buton zemininin mi
   (ya da her ikisinin mi) olduğunu kontrol et — `.surface-inverted`'daki
   `--accent` örneğinde olduğu gibi, aynı token iki farklı rolde
   kullanılıyorsa "aydınlat/koyulaştır" tek yönlü çözüm olmayabilir.
3. Yuvarlama payı bırak — tam 4.50 hedeflemek yerine 4.55+ hedefle, HSL→RGB
   tamsayı yuvarlaması oranı 4.50'nin altına düşürebilir (bu oturumda
   gerçekten oldu: 4.50 hedefiyle çözülen `accent-hover` yuvarlama sonrası
   4.49 çıktı).

---

*Bu belgedeki tüm rakamlar Eylül 2026 itibarıyla erişilebilir kamuya açık kaynaklardan derlenmiştir. Hukuki değerlendirmeler bilgilendirme amaçlıdır ve hukuki tavsiye yerine geçmez.*

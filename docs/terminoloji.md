# Terminoloji sözlüğü

CareNova'nın çekirdek kavramlarının TR/EN karşılıkları. Yeni bir ekran/metin
yazarken burayı kontrol et — aynı kavram için iki farklı kelime kullanmak
("Vaka" bir yerde, "Dosya" başka yerde) kafa karıştırır ve GECE-3-BRIEFI.md
Bulgu 1'in (karışık dil/terminoloji) tekrarına yol açar.

Sözlük i18n dosyalarındaki gerçek `key: value` çiftlerini DEĞİL, kavramın
kendisini sabitler — aynı Türkçe/İngilizce kelime birden fazla namespace'te
(`cases.json`, `admin.json`, `nav.json`...) farklı key adlarıyla tekrar
edebilir, sorun değil; önemli olan görünen METNİN tutarlı olması.

| Kavram (EN, kod içinde) | TR | EN (kullanıcıya gösterilen) |
|---|---|---|
| case | Vaka | Case |
| case file | Vaka Dosyası | Case File |
| lead | Aday hasta | Lead |
| quote | Teklif | Quote |
| locked quote | Kilitli Teklif | Locked Quote |
| doctor queue | Doktor Onay Kuyruğu | Doctor Approval Queue |
| aftercare | Bakım Hattı | Aftercare |
| branch (tıbbi alan) | Branş | Branch |
| pre-assessment | Ön Değerlendirme | Pre-Assessment |
| eligibility | Uygunluk | Eligibility |
| companion | Refakatçi | Companion |
| concierge | Konsiyerj | Concierge |
| clinic | Klinik | Clinic |
| tenant | (kod içi terim, kullanıcıya gösterilmez) | (internal only) |
| onboarding | Kurulum / Onboarding | Onboarding |
| impersonation | Klinik olarak görüntüleme | View as Clinic |
| branch template | Branş Şablonu | Branch Template |
| AI pricing authority | AI Fiyatlandırma Yetkisi | AI Pricing Authority |
| first response time | İlk Yanıt Süresi | First Response Time |
| red flag | Kırmızı Bayrak / Risk İşareti | Red Flag |
| approved scope | Onaylanan Kapsam | Approved Scope |
| price band | Fiyat Bandı | Price Band |

## Kural

Sidebar'daki isim, sayfa başlığındaki isim ve o modülü referans eden her
yerdeki isim AYNI olmalı — örn. "Doktor Onay Kuyruğu" hem sidebar'da hem
`/doctor-queue` sayfasının `<h1>`'inde hem de admin konsolunun onu
referans ettiği her yerde bu şekilde geçmeli, "Doctor Queue"/"Doktor
Onayı" gibi varyasyonlar kullanılmamalı.

Yeni bir kavram eklerken: önce bu tabloya bak, yoksa buraya ekle, sonra
kodu yaz — tersini yapma (önce kodu yazıp sonra tutarlılığı umut etme).

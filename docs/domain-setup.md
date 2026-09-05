# app.carenova.ai kurulumu — Baturay'ın manuel adımları

Bu adımlar Claude Code tarafından yapılamaz (Vercel dashboard + DNS sağlayıcı
erişimi gerektiriyor). `App.tsx`'teki hostname yönlendirme mantığı zaten hazır
ve çalışıyor — eksik olan sadece bu yapılandırma.

⚠️ **`carenova.ai` kök alan adı şu an WordPress'te yayında — ONA DOKUNMA.**
Aşağıdaki adımların hiçbiri kök domaini etkilemiyor, sadece `app` alt alanını
ekliyor. Kök domain kesintiye uğramaz.

## Adımlar

1. **Vercel'de alt alan adını projeye ekle**
   `vercel.com` → `carenova` projesi → **Settings → Domains** → `app.carenova.ai`
   yaz → **Add**. Vercel sana bir DNS kaydı önerecek (genelde bir CNAME).

2. **DNS'e CNAME kaydı ekle**
   `carenova.ai`'ın DNS'ini yönettiğin yerde (muhtemelen WordPress'i barındıran
   sağlayıcı — kayıt eklemek WordPress sitesini etkilemez, sadece yeni bir alt
   alan tanımlar):
   - Tür: `CNAME`
   - Ad/Host: `app`
   - Değer: `cname.vercel-dns.com`
   Vercel'in Adım 1'de gösterdiği tam değeri kullan; farklıysa onu esas al.

3. **Vercel ortam değişkenini ayarla**
   `carenova` projesi → **Settings → Environment Variables** →
   `REACT_APP_APP_URL=https://app.carenova.ai` ekle. **Hem Production hem
   Preview** için işaretle (sadece Production yeterli değil, çünkü preview
   deploy'ları da aynı kodu test ediyor).

   ⚠️ **Kritik:** Create React App ortam değişkenleri **BUILD sırasında koda
   gömülür**, sunucu çalışırken okunmaz. Yani bu değişkeni eklemek TEK BAŞINA
   hiçbir şeyi değiştirmez — mutlaka Adım 4'ü yap.

4. **Yeniden deploy et (zorunlu)**
   `carenova` projesi → **Deployments** → en üstteki (son) deployment → sağdaki
   `⋯` menüsü → **Redeploy**. Yeni bir git push'a gerek yok, mevcut kodu yeni
   env değişkeniyle yeniden derletmen yeterli.

5. **DNS yayılmasını bekle**
   Genelde 5 dakika ile 1 saat arasında sürer (sağlayıcıya göre değişir).
   `dig app.carenova.ai` veya `nslookup app.carenova.ai` ile kontrol edebilirsin.

## Doğrulama

Yayıldıktan ve redeploy tamamlandıktan sonra:
- `https://app.carenova.ai` → doğrudan `/login` ekranına düşmeli (landing
  sayfası DEĞİL — `App.tsx`'teki `isAppOrAdminSubdomain` kontrolü bunu yapıyor).
- `https://carenova.ai` (kök, WordPress) → hiç etkilenmemiş olmalı.

## admin.carenova.ai için

Aynı 4 adımı `admin` alt alanı ve `REACT_APP_ADMIN_URL` için tekrarla. İki alt
alan da AYNI Vercel deployment'ını (aynı React uygulaması) gösterir —
`App.tsx` hangi rolün (`super_admin`/`admin` vs. diğerleri) hangi alt alana
yönlendirileceğine `LoginPage.tsx`'teki `redirectAfterLogin` fonksiyonunda karar
verir, ayrı bir build/deploy gerekmez.

## Not: env değişkeni unutulsa bile çalışır

`App.tsx` artık sadece `REACT_APP_APP_URL`/`REACT_APP_ADMIN_URL` eşleşmesine
değil, hostname'in düz `app.` veya `admin.` ile başlamasına da bakıyor. Yani
3-4. adımları atlasan bile (env değişkenini hiç ayarlamasan da) `app.carenova.ai`
doğru şekilde `/login`'e düşer — env değişkeni sadece `redirectAfterLogin`'in
GİRİŞ SONRASI doğru alt alana yönlendirmesi için gerekli.

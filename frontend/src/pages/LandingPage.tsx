import React from 'react';
import SEOMeta from '../components/SEOMeta';

// Placeholder — the real CareNova landing page (Nav, Hero, Problem, Trust,
// Platform, Regulatory Shield, Pricing, FAQ, CTA, Footer) is built in PAKET 4.
// See CARENOVA-STRATEJI.md Bölüm 6.2/7/10 and GECE-CALISMA-BRIEFI.md PAKET 4.
//
// This placeholder carries real, honest content rather than a near-empty
// "coming soon" screen — partly because it's what visitors should see before
// the full page ships, and partly because scripts/prerender.js refuses to
// write a route to disk as static HTML unless its body text exceeds 500
// characters and has an <h1> (a guard against publishing broken/empty pages).
export default function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface text-ink antialiased px-6">
      <SEOMeta
        title="CareNova — Türkiye Sağlık Turizmi için AI Hasta Güven Platformu"
        description="CareNova, Türkiye'ye hasta getiren klinikler için WhatsApp üzerinden çok dilli AI hasta dönüşüm ve güven platformu."
        path="/"
      />
      <div className="max-w-xl text-center">
        <h1 className="font-display text-4xl sm:text-5xl text-brand-500">CareNova</h1>
        <p className="mt-2 text-sm uppercase tracking-widest text-accent-500">Çok yakında</p>
        <p className="mt-6 text-lg leading-relaxed text-ink-muted">
          Türkiye'ye hasta getiren klinikler ve doktorlar için: gelen her WhatsApp
          mesajını 5 saniyede hastanın kendi dilinde karşılayan, fiyatı kilitleyen,
          ameliyatı yapacak doktoru isimle taahhüt eden ve hasta eve döndükten
          sonra bir yıl boyunca peşini bırakmayan AI hasta güven platformu.
        </p>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">
          CareNova bir CRM değil — reklam bütçenizle rezerve edilmiş bir hasta
          arasındaki güven altyapısı. Çok dilli AI ajanı (TR, EN, AR, DE, RU),
          doktor onaylı kilitli teklif, seyahat konsiyerjliği ve dönüş sonrası
          bakım hattı tek bir WhatsApp hattında birleşiyor.
        </p>
        <p className="mt-8 text-sm text-ink-muted">
          Demo talep etmek veya erken erişim için{' '}
          <a href="mailto:hello@carenova.ai" className="text-accent-500 underline">
            hello@carenova.ai
          </a>
        </p>
      </div>
    </div>
  );
}

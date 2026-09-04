import React from 'react';
import SEOMeta from '../components/SEOMeta';

// Placeholder — the real CareNova landing page (Nav, Hero, Problem, Trust,
// Platform, Regulatory Shield, Pricing, FAQ, CTA, Footer) is built in PAKET 4.
// See CARENOVA-STRATEJI.md Bölüm 6.2/7/10 and GECE-CALISMA-BRIEFI.md PAKET 4.
export default function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface text-ink antialiased">
      <SEOMeta
        title="CareNova — Türkiye Sağlık Turizmi için AI Hasta Güven Platformu"
        description="CareNova, Türkiye'ye hasta getiren klinikler için WhatsApp üzerinden çok dilli AI hasta dönüşüm ve güven platformu."
        path="/"
      />
      <div className="text-center px-6">
        <h1 className="font-display text-4xl text-brand-500">CareNova</h1>
        <p className="mt-3 text-ink-muted">Çok yakında.</p>
      </div>
    </div>
  );
}

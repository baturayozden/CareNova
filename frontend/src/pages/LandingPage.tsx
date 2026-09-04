import React from 'react';
import { useTranslation } from 'react-i18next';
import SEOMeta from '../components/SEOMeta';
import ScrollToTopButton from '../components/ScrollToTopButton';
import NavBar from '../components/landing/NavBar';
import HeroSection from '../components/landing/HeroSection';
import ProblemSection from '../components/landing/ProblemSection';
import TrustSection from '../components/landing/TrustSection';
import PlatformSection from '../components/landing/PlatformSection';
import ComplianceSection from '../components/landing/ComplianceSection';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import CTASection from '../components/landing/CTASection';
import Footer from '../components/landing/Footer';

// CareNova landing page — TR default, EN via the nav language switcher.
// See CARENOVA-STRATEJI.md Bölüm 6.2/7/10 and GECE-CALISMA-BRIEFI.md PAKET 4
// for the content/section brief this implements.
export default function LandingPage() {
  const { i18n } = useTranslation();
  const isTr = i18n.language?.startsWith('tr');

  return (
    <div className="min-h-screen bg-surface text-ink antialiased">
      <SEOMeta
        title={isTr
          ? 'CareNova — Türkiye Sağlık Turizmi için AI Hasta Güven Platformu'
          : 'CareNova — AI Patient-Trust Platform for Turkish Health Tourism'}
        description={isTr
          ? "Gelen her WhatsApp mesajını 5 saniyede hastanın kendi dilinde karşılayan, fiyatı kilitleyen ve dönüş sonrası bir yıl takip eden AI platformu."
          : 'The AI platform that replies to every WhatsApp message in 5 seconds, in the patient\'s own language, locks the price, and follows up for a year after they go home.'}
        path="/"
      />
      <NavBar />
      <HeroSection />
      <ProblemSection />
      <TrustSection />
      <PlatformSection />
      <ComplianceSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
      <ScrollToTopButton />
    </div>
  );
}

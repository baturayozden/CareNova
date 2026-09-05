import React from 'react';
import { useTranslation } from 'react-i18next';
import SEOMeta from '../components/SEOMeta';
import ScrollToTopButton from '../components/ScrollToTopButton';
import NavBar from '../components/landing/NavBar';
import HeroSection from '../components/landing/HeroSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import ProblemSection from '../components/landing/ProblemSection';
import TrustSection from '../components/landing/TrustSection';
import PlatformSection from '../components/landing/PlatformSection';
import BranchesSection from '../components/landing/BranchesSection';
import AftercareSection from '../components/landing/AftercareSection';
import ComparisonSection from '../components/landing/ComparisonSection';
import RoiSection from '../components/landing/RoiSection';
import ComplianceSection from '../components/landing/ComplianceSection';
import SetupSection from '../components/landing/SetupSection';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import CTASection from '../components/landing/CTASection';
import Footer from '../components/landing/Footer';

// CareNova landing page — TR default, EN via the nav language switcher.
// Section order and content brief: GECE-LOG.md "İş Paketi 2 / Bölüm C.5".
// Content sources: CARENOVA-STRATEJI.md Bölüm 2/3/4/6.2/7/9/10.
//
// Honesty rules (Bölüm C.1): no fake testimonials, client logos, or metrics
// presented as CareNova's own — the product has no customers yet. Every
// industry statistic on this page carries its source inline (see
// data/landingContent.tsx). Social proof is replaced with a "what we build
// on" band (regulatory sources) instead.
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
      <main>
        <HeroSection />
        <HowItWorksSection />
        <ProblemSection />
        <TrustSection />
        <PlatformSection />
        <BranchesSection />
        <AftercareSection />
        <ComparisonSection />
        <RoiSection />
        <ComplianceSection />
        <SetupSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
      <ScrollToTopButton />
    </div>
  );
}

import React, { Suspense, useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop  from './components/ScrollToTop';
import ScrollToHash from './components/ScrollToHash';
import ConsentBanner from './components/ConsentBanner';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import LeadsPage from './pages/LeadsPage';
import AIActivityPage from './pages/AIActivityPage';
import AppointmentsPage from './pages/AppointmentsPage';
import ClinicsPage from './pages/ClinicsPage';
import ClinicDetailPage from './pages/ClinicDetailPage';
import SettingsPage from './pages/SettingsPage';
import DemoRequestsPage from './pages/DemoRequestsPage';
import LandingPage from './pages/LandingPage';
import AboutPage    from './pages/AboutPage';
import ContactPage  from './pages/ContactPage';
import BlogPage     from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import CareersPage  from './pages/CareersPage';
import CommissionPage from './pages/CommissionPage';
import PaymentsPage from './pages/PaymentsPage';
import InvoicesPage from './pages/InvoicesPage';
import CaseDetailPage from './pages/CaseDetailPage';
import CasesPage from './pages/CasesPage';
import CaseFileDetailPage from './pages/CaseFileDetailPage';
import DoctorQueuePage from './pages/DoctorQueuePage';
import QuotesPage from './pages/QuotesPage';
import TravelPage from './pages/TravelPage';
import AftercarePage from './pages/AftercarePage';
import ReportsPage from './pages/ReportsPage';
import PatientProfilePage from './pages/PatientProfilePage';
import PatientsListPage  from './pages/PatientsListPage';
import PaymentSuccessPage  from './pages/PaymentSuccessPage';
import PaymentCancelledPage from './pages/PaymentCancelledPage';
import PrivacyPage from './pages/legal/PrivacyPage';
import TermsPage from './pages/legal/TermsPage';
import CookiePage from './pages/legal/CookiePage';
import GdprPage from './pages/legal/GdprPage';
import ComingSoonPage from './pages/ComingSoonPage';
import { hostMode } from './config/hosts';
import {
  LOCALES, LOCALIZED_ROUTES, localizedPath, localeFromPathname,
  contentLocaleFor, isLocalizedRoute, stripLocale,
} from './i18n/locales';

// The admin console is a real, separate route tree (GECE-2-BRIEFI.md Bölüm
// B.3, güvenlik kuralı #3: "Admin route'ları app bundle'ında hiç mount
// edilmesin"). React.lazy is what actually enforces that — it puts
// AdminApp and everything it imports in its own webpack chunk, and that
// chunk is only ever requested when the code path that imports it (the
// hostMode==='admin' branch below) actually runs. A marketing or app-host
// visitor's browser never fetches it, not even in the background.
const AdminApp = React.lazy(() => import('./admin/AdminApp'));

function AdminLoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-page">
      <div className="w-10 h-10 border-4 border-line border-t-accent rounded-full animate-spin" />
    </div>
  );
}

// ── Marketing host (carenova.ai) ────────────────────────────────────────────

// Elements for the paths that exist in every locale (i18n/locales.json →
// localizedRoutes). Adding a language adds a prefixed Route for each entry
// here automatically; adding a localized PAGE means adding its base path to
// locales.json and its element here.
const LOCALIZED_ELEMENTS: Record<string, React.ReactElement> = {
  '/': <LandingPage />,
};

/**
 * Keeps the active language equal to the language the URL addresses, for as
 * long as the marketing tree is mounted.
 *
 * i18n/index.ts already does this once at module scope, which is what makes
 * the FIRST render (and therefore the prerendered HTML) correct. But that runs
 * once per document: a client-side move between /en and / — the language
 * switcher, a <Link>, the back button — changes the URL without reloading, and
 * without this the page would keep rendering the previous language while the
 * address bar claimed otherwise.
 */
function MarketingLocaleSync() {
  const { pathname } = useLocation();
  const { i18n } = useTranslation();
  const localized = isLocalizedRoute(stripLocale(pathname));
  const urlLocale = localeFromPathname(pathname);
  const contentLocale = contentLocaleFor(pathname);

  useLayoutEffect(() => {
    if (localized && !i18n.language?.startsWith(urlLocale.code)) {
      i18n.changeLanguage(urlLocale.code);
    }
  }, [localized, urlLocale.code, i18n]);

  // Owns <html lang> on the marketing host. i18n's own languageChanged handler
  // also writes it, from the CHROME's language — which is wrong on an
  // English-only page whose nav happens to be Turkish. Re-running on
  // i18n.language means this always gets the last word.
  useLayoutEffect(() => {
    document.documentElement.lang = contentLocale.code;
  }, [contentLocale.code, i18n.language]);

  return null;
}

function MarketingRoutes() {
  return (
    <>
    <MarketingLocaleSync />
    <Routes>
      <Route path="/" element={<LandingPage />} />

      {/* Prefixed locale URLs, generated from the registry — /en today.
          Only genuinely translated pages appear here: giving an English-only
          page an /en twin would publish the same bytes at two URLs. */}
      {LOCALES.filter(l => l.prefix).flatMap(locale =>
        LOCALIZED_ROUTES.filter(basePath => LOCALIZED_ELEMENTS[basePath]).map(basePath => (
          <Route
            key={`${locale.code}:${basePath}`}
            path={localizedPath(basePath, locale)}
            element={LOCALIZED_ELEMENTS[basePath]}
          />
        )),
      )}

      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/careers" element={<CareersPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/cookies" element={<CookiePage />} />
      <Route path="/gdpr" element={<GdprPage />} />
      <Route path="/payment-success" element={<PaymentSuccessPage />} />
      <Route path="/payment-cancelled" element={<PaymentCancelledPage />} />
      {/* Anything else on the marketing host (including a stray /login or
          /dashboard link) falls back to the landing page, not a 404 — this
          host has no auth concept of its own. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

// ── App host (app.carenova.ai) — clinic users ───────────────────────────────
function AppRoutes() {
  // APP-ADMIN-EKSIKLER-KOMUTU.md Görev 5 — this used to call
  // setDefaultTitle('CareNova | Klinik Paneli') imperatively here, always
  // mounted regardless of which child route was active. The real root
  // cause of the "2 <title> elements" bug: that raw DOM manipulation sits
  // completely outside React 19's <title> hoisting/reconciliation, so
  // when a child page (e.g. CasesPage) later renders its OWN declarative
  // <AppMeta>, React has no way to know the imperative one even exists —
  // it never gets removed, and both stay in <head> at once (confirmed:
  // `document.querySelectorAll('title').length === 2` on /cases). Every
  // page under this route tree now renders its own <AppMeta> instead (see
  // each page file) — since <Routes> only ever mounts ONE matched route
  // element at a time, that structurally guarantees exactly one component
  // providing a title at any moment, with no separate fallback needed.
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* ProtectedRoute (no roles= restriction here) still enforces the
          platform-vs-clinic subdomain split: a super_admin/admin session
          reaching this tree is hard-redirected to the admin host rather
          than rendered a clinic dashboard (brief B.3 güvenlik kuralı #2 —
          "sadece impersonation akışıyla, normal kullanıcı gibi değil";
          the impersonation bypass itself is Bölüm C.10, not built yet). */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard"   element={<Dashboard />} />
          <Route path="/leads"       element={<LeadsPage />} />
          <Route path="/ai-activity" element={<AIActivityPage />} />
          <Route path="/appointments"  element={<AppointmentsPage />} />
          <Route path="/clinics"        element={<ClinicsPage />} />
          <Route path="/clinics/:id"   element={<ClinicDetailPage />} />
          <Route path="/settings"              element={<SettingsPage />} />
          <Route path="/settings/integrations" element={<SettingsPage initialTab="integrations" />} />
          <Route path="/settings/onboarding"   element={<ComingSoonPage title="Kurulum Sihirbazı" />} />
          <Route path="/commission"             element={<CommissionPage />} />
          <Route path="/patients"              element={<PatientsListPage />} />
          <Route path="/patients/:leadId"     element={<PatientProfilePage />} />
          <Route path="/payments"              element={<PaymentsPage />} />
          <Route path="/payments/:id"          element={<CaseDetailPage />} />
          <Route path="/invoices"              element={<InvoicesPage />} />
          <Route path="/demo-requests"         element={<DemoRequestsPage />} />
          <Route path="/cases"          element={<CasesPage />} />
          <Route path="/cases/:id"      element={<CaseFileDetailPage />} />
          <Route path="/doctor-queue"   element={<DoctorQueuePage />} />
          <Route path="/quotes"         element={<QuotesPage />} />
          <Route path="/travel"         element={<TravelPage />} />
          <Route path="/aftercare"      element={<AftercarePage />} />
          <Route path="/reports"        element={<ReportsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  // Safety net for scroll-reveal (Framer Motion whileInView/animate) content:
  // these run on requestAnimationFrame, which browsers throttle or fully
  // suspend for backgrounded/hidden tabs (e.g. a link opened in a background
  // tab). If a reveal's rAF loop never gets a tick, the element's JS-driven
  // opacity/transform values stay frozen at their "hidden" starting point
  // forever — the tab becoming visible again does not, by itself, resume or
  // restart that stalled animation. A plain resize-event dispatch does not
  // fix this either (verified): it only helps observers that recompute on
  // resize, not a JS interpolation loop that never advanced in the first
  // place.
  //
  // Two complementary checks, because a backgrounded tab throttles BOTH
  // requestAnimationFrame and setInterval/setTimeout (verified: a 250ms
  // interval effectively never ticks while hidden) — a poll-only watchdog
  // can silently never run in exactly the case it exists for:
  //   - a periodic poll, for a tab that's visible the whole time (normal
  //     case) and something still didn't resolve on its own;
  //   - a `visibilitychange` listener, which fires immediately and is NOT
  //     subject to timer throttling, for a tab that loaded in the
  //     background and only later became the one the visitor is looking
  //     at — the exact scenario the poll alone would miss.
  // Either way, only elements genuinely on screen are touched, so this
  // never short-circuits the intentional scroll-reveal effect for content
  // the visitor hasn't scrolled to yet.
  useEffect(() => {
    // Timestamp of the first tick each element was seen on screen. Never
    // cleared just because a later tick reads it as momentarily out of view
    // (e.g. a boundary flicker while a poll is itself throttled to ~1/s) —
    // only cleared once actually revealed. That makes the 700ms threshold
    // a floor, not a fragile "N consecutive ticks" streak that a single
    // missed tick could reset indefinitely.
    const firstSeen = new WeakMap<Element, number>();
    const sweep = (force: boolean) => {
      document.querySelectorAll('main [style*="opacity: 0"]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        const inView = rect.width > 0 && rect.top < window.innerHeight && rect.bottom > 0;
        if (!inView) return;
        if (!firstSeen.has(el)) firstSeen.set(el, Date.now());
        if (force || Date.now() - firstSeen.get(el)! > 700) {
          const style = (el as HTMLElement).style;
          style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          style.opacity = '1';
          style.transform = 'none';
          firstSeen.delete(el);
        }
      });
    };
    const id = window.setInterval(() => sweep(false), 250);
    const onVisible = () => { if (!document.hidden) sweep(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <ThemeProvider>
    <BrowserRouter>
      <ScrollToTop />
      <ScrollToHash />
      {/* Cookie consent — marketing host only. app/admin have no anonymous
          visitors and no analytics/marketing cookies to ask consent for. */}
      {hostMode === 'marketing' && <ConsentBanner />}
      <AuthProvider>
        {hostMode === 'marketing' && <MarketingRoutes />}
        {hostMode === 'app' && <AppRoutes />}
        {hostMode === 'admin' && (
          <Suspense fallback={<AdminLoadingFallback />}>
            <AdminApp />
          </Suspense>
        )}
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}

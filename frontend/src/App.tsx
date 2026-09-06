import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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
import { setDefaultTitle } from './lib/setDefaultTitle';

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
function MarketingRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
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
  );
}

// ── App host (app.carenova.ai) — clinic users ───────────────────────────────
function AppRoutes() {
  // Default tab title for routes that don't render their own <AppMeta> (most
  // of the dashboard doesn't yet). Set imperatively (document.title, not a
  // JSX <title>) specifically so it never competes with a page that DOES
  // render its own AppMeta — React 19 hoists JSX <title> elements and the
  // first one it finds wins (see AppMeta.tsx's own warning about mounting
  // two at once); a plain imperative assignment sits outside that mechanism
  // entirely, so a page's own AppMeta always overrides it on navigation,
  // and it re-takes effect as the fallback the moment that page unmounts.
  useEffect(() => { setDefaultTitle('CareNova | Klinik Paneli'); }, []);
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
          <Route path="/quotes"         element={<ComingSoonPage title="Teklifler" />} />
          <Route path="/travel"         element={<ComingSoonPage title="Seyahat" />} />
          <Route path="/aftercare"      element={<ComingSoonPage title="Bakım Hattı" />} />
          <Route path="/reports"        element={<ComingSoonPage title="Raporlar" />} />
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

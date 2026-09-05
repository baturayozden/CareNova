import React, { useEffect } from 'react';
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
import PatientProfilePage from './pages/PatientProfilePage';
import PatientsListPage  from './pages/PatientsListPage';
import PaymentSuccessPage  from './pages/PaymentSuccessPage';
import PaymentCancelledPage from './pages/PaymentCancelledPage';
import PrivacyPage from './pages/legal/PrivacyPage';
import TermsPage from './pages/legal/TermsPage';
import CookiePage from './pages/legal/CookiePage';
import GdprPage from './pages/legal/GdprPage';
import ComingSoonPage from './pages/ComingSoonPage';

// Determine at runtime whether we're on an app/admin subdomain.
// Two independent signals, either one is enough:
//   1. REACT_APP_APP_URL / REACT_APP_ADMIN_URL env vars (set on Vercel, baked
//      in at BUILD time — see docs/domain-setup.md) matched exactly.
//   2. A plain "app." / "admin." hostname prefix, so routing still works
//      correctly even if the env vars are never configured or a deploy
//      forgets to set them — CRA env vars are easy to lose track of since
//      they're build-time, not runtime.
const hostname  = window.location.hostname;
const appHost   = process.env.REACT_APP_APP_URL   ? new URL(process.env.REACT_APP_APP_URL).hostname   : null;
const adminHost = process.env.REACT_APP_ADMIN_URL ? new URL(process.env.REACT_APP_ADMIN_URL).hostname : null;
const isAppOrAdminSubdomain =
  hostname.startsWith('app.') || hostname.startsWith('admin.') ||
  (appHost && hostname === appHost) || (adminHost && hostname === adminHost);

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
      {/* Cookie consent — landing host only; not shown on app/admin subdomains */}
      {!isAppOrAdminSubdomain && <ConsentBanner />}
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/"             element={isAppOrAdminSubdomain ? <Navigate to="/login" replace /> : <LandingPage />} />
          <Route path="/login"            element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password"  element={<ResetPasswordPage />} />
          <Route path="/unauthorized"    element={<UnauthorizedPage />} />
          <Route path="/privacy"  element={<PrivacyPage />} />
          <Route path="/terms"    element={<TermsPage />} />
          <Route path="/cookies"  element={<CookiePage />} />
          <Route path="/gdpr"     element={<GdprPage />} />
          <Route path="/about"    element={<AboutPage />} />
          <Route path="/contact"  element={<ContactPage />} />
          <Route path="/blog"          element={isAppOrAdminSubdomain ? <Navigate to="/login" replace /> : <BlogPage />} />
          <Route path="/blog/:slug"    element={isAppOrAdminSubdomain ? <Navigate to="/login" replace /> : <BlogPostPage />} />
          <Route path="/careers"          element={<CareersPage />} />
          <Route path="/payment-success"  element={<PaymentSuccessPage />} />
          <Route path="/payment-cancelled" element={<PaymentCancelledPage />} />

          {/* Protected — all wrapped in shared Layout */}
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
              <Route path="/commission"             element={<CommissionPage />} />
              <Route path="/patients"              element={<PatientsListPage />} />
              <Route path="/patients/:leadId"     element={<PatientProfilePage />} />
              <Route path="/payments"              element={<PaymentsPage />} />
              <Route path="/payments/:id"          element={<CaseDetailPage />} />
              <Route path="/invoices"              element={<InvoicesPage />} />
              <Route path="/demo-requests"         element={<DemoRequestsPage />} />
              <Route path="/cases"          element={<ComingSoonPage title="Vakalar" />} />
              <Route path="/doctor-queue"   element={<ComingSoonPage title="Doktor Onayı" />} />
              <Route path="/quotes"         element={<ComingSoonPage title="Teklifler" />} />
              <Route path="/travel"         element={<ComingSoonPage title="Seyahat" />} />
              <Route path="/aftercare"      element={<ComingSoonPage title="Bakım Hattı" />} />
              <Route path="/reports"        element={<ComingSoonPage title="Raporlar" />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}

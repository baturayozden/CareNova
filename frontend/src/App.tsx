import React from 'react';
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
// Uses build-time env vars; if not set (local dev) falls back to false → LandingPage shown.
const hostname  = window.location.hostname;
const appHost   = process.env.REACT_APP_APP_URL   ? new URL(process.env.REACT_APP_APP_URL).hostname   : null;
const adminHost = process.env.REACT_APP_ADMIN_URL ? new URL(process.env.REACT_APP_ADMIN_URL).hostname : null;
const isAppOrAdminSubdomain = (appHost && hostname === appHost) || (adminHost && hostname === adminHost);

export default function App() {
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

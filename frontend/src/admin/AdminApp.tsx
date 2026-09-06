import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLoginPage from './AdminLoginPage';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminLayout from './AdminLayout';
import OverviewPage from './pages/OverviewPage';
import ClinicsPage from './pages/ClinicsPage';
import ClinicDetailPage from './pages/ClinicDetailPage';
import OnboardingPage from './pages/OnboardingPage';
import WhatsappPage from './pages/WhatsappPage';
import AiUsagePage from './pages/AiUsagePage';
import BranchesPage from './pages/BranchesPage';
import CompliancePage from './pages/CompliancePage';
import AdminDemoRequestsPage from './pages/AdminDemoRequestsPage';
import BillingPage from './pages/BillingPage';
import UsersPage from './pages/UsersPage';
import AuditPage from './pages/AuditPage';
import HealthPage from './pages/HealthPage';
import { ImpersonationProvider } from './ImpersonationContext';

// Mounted only when config/hosts.ts resolves hostMode === 'admin' (see
// App.tsx), and only via React.lazy there — so none of this, including
// every module below, is ever downloaded by a visitor on the marketing or
// app host. All 12 Bölüm C modules below, each built and verified as its
// own commit (see GECE-LOG.md).
export default function AdminApp() {
  return (
    <ImpersonationProvider>
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route path="/" element={<Navigate to="/admin/overview" replace />} />

      <Route element={<AdminProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin/overview" element={<OverviewPage />} />
          <Route path="/admin/clinics" element={<ClinicsPage />} />
          <Route path="/admin/clinics/:id" element={<ClinicDetailPage />} />
          <Route path="/admin/onboarding" element={<OnboardingPage />} />
          <Route path="/admin/whatsapp" element={<WhatsappPage />} />
          <Route path="/admin/ai-usage" element={<AiUsagePage />} />
          <Route path="/admin/branches" element={<BranchesPage />} />
          <Route path="/admin/compliance" element={<CompliancePage />} />
          <Route path="/admin/demo-requests" element={<AdminDemoRequestsPage />} />
          <Route path="/admin/billing" element={<BillingPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/audit" element={<AuditPage />} />
          <Route path="/admin/health" element={<HealthPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/admin/overview" replace />} />
    </Routes>
    </ImpersonationProvider>
  );
}

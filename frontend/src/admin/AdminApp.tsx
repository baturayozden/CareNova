import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLoginPage from './AdminLoginPage';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminLayout from './AdminLayout';
import AdminComingSoon from './components/AdminComingSoon';
import OverviewPage from './pages/OverviewPage';

// Mounted only when config/hosts.ts resolves hostMode === 'admin' (see
// App.tsx), and only via React.lazy there — so none of this, including
// every module below, is ever downloaded by a visitor on the marketing or
// app host. Bölüm C fills these in one module at a time, each its own
// commit; until then they're honest placeholders (brief D.4/C rule — never
// fake data pretending a module already works).
export default function AdminApp() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route path="/" element={<Navigate to="/admin/overview" replace />} />

      <Route element={<AdminProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin/overview" element={<OverviewPage />} />
          <Route path="/admin/clinics" element={<AdminComingSoon title="Klinikler" description="Klinik listesi, filtreler, ve klinik detay sayfası (künye, kullanıcılar, WhatsApp, AI kullanımı, faturalama, uyum, denetim sekmeleri) burada olacak." />} />
          <Route path="/admin/clinics/:id" element={<AdminComingSoon title="Klinik Detayı" description="Seçilen kliniğin künyesi ve sekmeleri burada olacak." />} />
          <Route path="/admin/onboarding" element={<AdminComingSoon title="Onboarding Takibi" description="7 adımlı onboarding hunisi, her kliniğin hangi adımda olduğu ve takılma süreleri burada olacak." />} />
          <Route path="/admin/whatsapp" element={<AdminComingSoon title="WhatsApp Hatları" description="Klinik başına WhatsApp bağlantı durumu, webhook sağlığı ve mesaj hacmi burada olacak." />} />
          <Route path="/admin/ai-usage" element={<AdminComingSoon title="AI Kullanım ve Kota" description="Klinik başına AI konuşma kotası, aşım durumu ve tahmini maliyet burada olacak." />} />
          <Route path="/admin/branches" element={<AdminComingSoon title="Branş Şablonları" description="Sistem branş şablonları, AI fiyat yetki matrisi ve kaç kliniğin hangi şablonu kullandığı burada olacak." />} />
          <Route path="/admin/compliance" element={<AdminComingSoon title="Uyum Paneli" description="Klinik başına yetki belgesi, komplikasyon sigortası, VERBİS ve Ek-1 onam durumu burada olacak." />} />
          <Route path="/admin/demo-requests" element={<AdminComingSoon title="Demo Talepleri" description="Landing formundan gelen demo talepleri burada olacak." />} />
          <Route path="/admin/billing" element={<AdminComingSoon title="Faturalama" description="Klinik abonelikleri, MRR/ARR özeti ve geciken ödemeler burada olacak." />} />
          <Route path="/admin/users" element={<AdminComingSoon title="Kullanıcılar, Roller ve Impersonation" description="Platform kullanıcıları, klinik kullanıcıları ve 'klinik olarak görüntüle' (impersonation) akışı burada olacak." />} />
          <Route path="/admin/audit" element={<AdminComingSoon title="Denetim Kaydı" description="Platform genelinde append-only olay akışı (kim, ne zaman, hangi klinik, ne yaptı) burada olacak." />} />
          <Route path="/admin/health" element={<AdminComingSoon title="Platform Sağlığı" description="Webhook başarı oranı, ortalama ilk yanıt süresi ve AI hata oranı burada olacak." />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/admin/overview" replace />} />
    </Routes>
  );
}

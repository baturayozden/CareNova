import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { isPlatformAdmin } from '../../lib/roles';
import { urlFor } from '../../config/hosts';

const appLoginUrl = urlFor('app', '/login');

// Route-level enforcement of GECE-2-BRIEFI.md Bölüm B.3 güvenlik kuralı #1:
// "Admin arayüzü hiçbir koşulda render edilmez" for a non-platform role.
// AdminLoginPage already refuses to navigate a non-platform login here in
// the first place, but that's a UX nicety, not the security boundary — a
// user could reach an /admin/* URL directly with a stale/foreign session
// (e.g. a bookmarked link, or a session started elsewhere). This component
// is the actual boundary: it never renders <Outlet/> (the admin shell and
// everything inside it) unless the current user is a platform role, no
// matter how this route was reached.
export default function AdminProtectedRoute() {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation('auth');

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-page">
        <div className="w-10 h-10 border-4 border-line border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isPlatformAdmin(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-page px-4">
        <div className="max-w-md w-full rounded-xl border border-danger/30 bg-danger-soft p-6 text-center" role="alert">
          <p className="text-ink font-semibold mb-1">{t('admin.rejectedTitle')}</p>
          <p className="text-ink-muted text-sm mb-4">{t('admin.rejectedBody')}</p>
          <a
            href={appLoginUrl}
            className="inline-block rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2.5 transition-colors"
          >
            {t('admin.rejectedLink')}
          </a>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

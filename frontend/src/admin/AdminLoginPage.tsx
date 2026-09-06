import React, { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isPlatformAdmin } from '../lib/roles';
import { urlFor } from '../config/hosts';
import AppMeta from '../components/AppMeta';
import { DEMO_MODE } from '../lib/api';
import carenovaLogoDark from '../assets/carenova-logo-transparent-dark.svg';
import carenovaLogoLight from '../assets/carenova-logo-transparent-light.svg';

const appLoginUrl = urlFor('app', '/login');

// The admin host's OWN login page — deliberately separate from the clinic
// LoginPage.tsx rather than a shared component with a mode flag, because the
// two have fundamentally different post-auth rules: this one must NEVER
// render the admin shell for a non-platform role (brief 🔴: "Admin arayüzü
// hiçbir koşulda render edilmez"), and there is no tenant-selection flow
// here — a platform user has no tenant to pick.
export default function AdminLoginPage() {
  const { t } = useTranslation('auth');
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const logoSrc = theme === 'light' ? carenovaLogoLight : carenovaLogoDark;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rejected, setRejected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setRejected(false);
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.type !== 'done') {
        // A tenant-selection response means this account belongs to a
        // clinic, not the platform — never show a clinic picker here.
        await logout();
        setRejected(true);
        return;
      }
      if (!isPlatformAdmin(result.user.role)) {
        // Session was created but the role isn't a platform one — clear it
        // immediately. The admin shell (AdminApp's protected routes) would
        // also refuse this role, but we don't even let the token sit around
        // logged-in client-side for a page that will never render anything.
        await logout();
        setRejected(true);
        return;
      }
      navigate('/admin/overview');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('login.error');
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-surface-page px-4">
      <AppMeta title="CareNova | Platform" />
      <div className="bg-surface rounded-2xl p-10 w-full max-w-md shadow-2xl border border-line">
        <div className="text-center mb-8">
          <img src={logoSrc} alt="CareNova" className="w-full max-w-[240px] h-auto mx-auto block mb-1" />
          {DEMO_MODE && (
            <span className="inline-flex items-center gap-1.5 mt-3 bg-accent/10 border border-accent/25 text-accent text-xs font-medium px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" /> {t('login.demoMode')}
            </span>
          )}
        </div>

        <h1 className="text-ink font-semibold text-lg mb-1 text-center">{t('admin.title')}</h1>
        <p className="text-ink-muted text-sm text-center mb-6">{t('admin.subtitle')}</p>

        {rejected ? (
          <div className="rounded-xl border border-danger/30 bg-danger-soft p-5 text-center" role="alert">
            <p className="text-ink font-semibold mb-1">{t('admin.rejectedTitle')}</p>
            <p className="text-ink-muted text-sm mb-4">{t('admin.rejectedBody')}</p>
            <a
              href={appLoginUrl}
              className="inline-block rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-4 py-2.5 transition-colors"
            >
              {t('admin.rejectedLink')}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('login.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-surface-sunken border border-line text-ink rounded-lg px-4 py-3 w-full focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-muted mb-1">{t('login.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-surface-sunken border border-line text-ink rounded-lg px-4 py-3 w-full focus:outline-none focus:border-accent"
              />
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('login.submitting') : t('login.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

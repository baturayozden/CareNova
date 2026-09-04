import React, { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, User, TenantChoice } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AppMeta from '../components/AppMeta';
import carenovaLogoDark  from '../assets/carenova-logo-transparent-dark.svg';
import carenovaLogoLight from '../assets/carenova-logo-transparent-light.svg';

const PLATFORM_ROLES: User['role'][] = ['super_admin', 'admin'];

const APP_URL   = process.env.REACT_APP_APP_URL   || '';
const ADMIN_URL = process.env.REACT_APP_ADMIN_URL  || '';

/**
 * After login, send the user to the correct subdomain.
 *
 * Rules:
 *   super_admin / admin  →  admin.carenova.ai/dashboard
 *   everyone else        →  app.carenova.ai/dashboard
 *
 * In local dev (env vars blank) falls back to React Router navigate('/dashboard')
 * so nothing breaks without extra env setup.
 */
function redirectAfterLogin(user: User, navigate: ReturnType<typeof useNavigate>): void {
  const isPlatformAdmin = PLATFORM_ROLES.includes(user.role);
  const targetBase = isPlatformAdmin ? ADMIN_URL : APP_URL;

  if (targetBase && !window.location.href.startsWith(targetBase)) {
    // Cross-subdomain redirect — token is already in localStorage, will be read on the other side
    window.location.href = `${targetBase}/dashboard`;
  } else {
    navigate('/dashboard');
  }
}

// ── Shared card wrapper ───────────────────────────────────────────────────────

function LoginCard({ logoSrc, children }: { logoSrc: string; children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center bg-navy-950 px-4">
      <div className="bg-navy-900 rounded-2xl p-10 w-full max-w-md shadow-2xl border border-navy-600">
        <div className="text-center mb-8">
          <img src={logoSrc} alt="CareNova AI" className="w-full max-w-[240px] h-auto mx-auto block mb-1" />
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Clinic selection screen ───────────────────────────────────────────────────

interface SelectionScreenProps {
  tenants:        TenantChoice[];
  selecting:      boolean;
  error:          string;
  onSelect:       (tenantId: string) => void;
  onBack:         () => void;
}

function ClinicSelectionScreen({ tenants, selecting, error, onSelect, onBack }: SelectionScreenProps) {
  return (
    <>
      <h2 className="text-white font-semibold text-lg mb-1 text-center">Which clinic?</h2>
      <p className="text-gray-400 text-sm text-center mb-6">
        Select the clinic you'd like to sign in to.
      </p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="space-y-3">
        {tenants.map(t => (
          <button
            key={t.tenantId}
            onClick={() => onSelect(t.tenantId)}
            disabled={selecting}
            className="w-full text-left bg-navy-800 hover:bg-navy-700 border border-navy-600 hover:border-gold rounded-xl px-5 py-4 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="block text-white font-semibold">{t.tenantName}</span>
            <span className="block text-gray-400 text-xs mt-0.5 capitalize">
              {t.role.replace(/_/g, ' ')}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={onBack}
        className="mt-6 w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        ← Back to sign in
      </button>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login, selectTenant } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const logoSrc = theme === 'light' ? carenovaLogoLight : carenovaLogoDark;

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [error,       setError]       = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tenant selection state — kept in component memory only (never localStorage)
  const [selectionData, setSelectionData] = useState<{
    selectionToken: string;
    tenants: TenantChoice[];
  } | null>(null);
  const [selecting, setSelecting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.type === 'done') {
        redirectAfterLogin(result.user, navigate);
      } else {
        // Multi-tenant: show clinic picker, do NOT store tokens yet
        setSelectionData({ selectionToken: result.selectionToken, tenants: result.tenants });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Invalid email or password';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectTenant = async (tenantId: string) => {
    if (!selectionData) return;
    setError('');
    setSelecting(true);
    try {
      const user = await selectTenant(selectionData.selectionToken, tenantId);
      redirectAfterLogin(user, navigate);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        // Selection token expired (5 min window) — send back to login
        setSelectionData(null);
        setError('Session expired. Please sign in again.');
      } else {
        setError('Could not sign in to that clinic. Please try again.');
      }
    } finally {
      setSelecting(false);
    }
  };

  const handleBack = () => {
    setSelectionData(null);
    setError('');
  };

  // ── Clinic selection screen ─────────────────────────────────────────────────

  if (selectionData) {
    return (
      <LoginCard logoSrc={logoSrc}>
        <AppMeta title="Sign in | CareNova" />
        <ClinicSelectionScreen
          tenants={selectionData.tenants}
          selecting={selecting}
          error={error}
          onSelect={handleSelectTenant}
          onBack={handleBack}
        />
      </LoginCard>
    );
  }

  // ── Standard login form ─────────────────────────────────────────────────────

  return (
    <LoginCard logoSrc={logoSrc}>
      <AppMeta title="Sign in | CareNova" />
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="bg-navy-800 border border-navy-600 text-white rounded-lg px-4 py-3 w-full focus:outline-none focus:border-gold"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="bg-navy-800 border border-navy-600 text-white rounded-lg px-4 py-3 w-full focus:outline-none focus:border-gold"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gold hover:bg-gold-light text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-sm mt-1">
          <Link to="/forgot-password" className="text-gray-400 hover:text-gold transition-colors">
            Forgot password?
          </Link>
        </p>
      </form>
    </LoginCard>
  );
}

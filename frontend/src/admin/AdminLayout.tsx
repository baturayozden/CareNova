import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Building2, ListChecks, MessageCircle, Cpu, Layers,
  ShieldCheck, Inbox, CreditCard, Users, ScrollText, Activity,
  LogOut, Sun, Moon, Menu, Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { setDefaultTitle } from '../lib/setDefaultTitle';
import { useImpersonation } from './ImpersonationContext';
import carenovaLogoDark from '../assets/carenova-logo-transparent-dark.svg';
import carenovaLogoLight from '../assets/carenova-logo-transparent-light.svg';

// Bölüm C'nin 12 modülü — hepsi burada listelenir, henüz yazılmamış olanlar
// (Part C ilerledikçe dolduruluyor) AdminApp.tsx'te ComingSoon placeholder'a
// düşer, ama sidebar HER ZAMAN tam haritayı gösterir — brief D.4'teki
// "dürüst Yakında ekranı" ilkesinin admin tarafındaki karşılığı.
const NAV_ITEMS = [
  { to: '/admin/overview', labelKey: 'overview', Icon: LayoutDashboard },
  { to: '/admin/clinics', labelKey: 'clinics', Icon: Building2 },
  { to: '/admin/onboarding', labelKey: 'onboarding', Icon: ListChecks },
  { to: '/admin/whatsapp', labelKey: 'whatsapp', Icon: MessageCircle },
  { to: '/admin/ai-usage', labelKey: 'aiUsage', Icon: Cpu },
  { to: '/admin/branches', labelKey: 'branches', Icon: Layers },
  { to: '/admin/compliance', labelKey: 'compliance', Icon: ShieldCheck },
  { to: '/admin/demo-requests', labelKey: 'demoRequests', Icon: Inbox },
  { to: '/admin/billing', labelKey: 'billing', Icon: CreditCard },
  { to: '/admin/users', labelKey: 'users', Icon: Users },
  { to: '/admin/audit', labelKey: 'audit', Icon: ScrollText },
  { to: '/admin/health', labelKey: 'health', Icon: Activity },
] as const;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t, i18n } = useTranslation('admin');
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const logoSrc = theme === 'dark' ? carenovaLogoDark : carenovaLogoLight;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-line">
        <img src={logoSrc} alt="CareNova" className="h-7 w-auto" />
        <span className="block text-[11px] font-semibold uppercase tracking-widest text-ink-subtle mt-1.5">
          {t('platformLabel')}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-2" aria-label={t('navLabel')}>
        {NAV_ITEMS.map(({ to, labelKey, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-accent-soft text-accent border-r-2 border-accent' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
              }`
            }
          >
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            {t(`nav.${labelKey}`)}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 px-1">
          <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent text-xs font-semibold shrink-0">
            {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-[11px] text-ink-subtle truncate">{t('roleLabel')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {(['tr', 'en'] as const).map(lng => (
            <button
              key={lng}
              onClick={() => i18n.changeLanguage(lng)}
              className={`px-2 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors ${
                i18n.language?.startsWith(lng) ? 'bg-accent text-white' : 'text-ink-muted border border-line hover:bg-surface-sunken'
              }`}
            >
              {lng}
            </button>
          ))}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
            title={theme === 'dark' ? t('lightMode') : t('darkMode')}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-xs text-ink-muted hover:bg-surface-sunken transition-colors"
          >
            {theme === 'dark' ? <Sun size={14} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={14} strokeWidth={1.75} aria-hidden="true" />}
          </button>
          <button
            onClick={() => logout()}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-muted hover:bg-danger-soft hover:text-danger hover:border-danger/30 transition-colors"
            aria-label={t('signOut')}
          >
            <LogOut size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { t } = useTranslation('admin');
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = NAV_ITEMS.find(item => location.pathname.startsWith(item.to));
  const { session, stop } = useImpersonation();
  // See lib/setDefaultTitle.ts for why this isn't a plain `document.title =`.
  useEffect(() => { setDefaultTitle('CareNova | Platform'); }, []);

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      {/* Brief C.10 🔴: persistently visible while impersonating — not a
          dismissible toast, a permanent strip for as long as the session
          is active, with an always-reachable exit. */}
      {session && (
        <div className="sticky top-0 z-[60] bg-warning text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium" role="status">
          <Eye size={16} strokeWidth={2} aria-hidden="true" />
          <span>{t('impersonation.viewingAs', { name: session.clinicName })}</span>
          <button onClick={stop} className="underline underline-offset-2 hover:no-underline">{t('impersonation.exit')}</button>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-line bg-surface">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-surface border-r border-line">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 md:px-6 py-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-ink"
            aria-label={t('navLabel')}
          >
            <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <nav aria-label="breadcrumb" className="text-sm">
            <span className="text-ink-subtle">{t('platformLabel')}</span>
            {current && (
              <>
                <span className="text-ink-subtle mx-1.5">/</span>
                <span className="text-ink font-medium">{t(`nav.${current.labelKey}`)}</span>
              </>
            )}
          </nav>
        </header>
        <main className="flex-1 p-4 md:p-6 min-w-0">
          <Outlet />
        </main>
      </div>
      </div>
    </div>
  );
}

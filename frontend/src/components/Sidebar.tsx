import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, TenantChoice } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import carenovaLogoDark  from '../assets/carenova-logo-transparent-dark.svg';
import carenovaLogoLight from '../assets/carenova-logo-transparent-light.svg';
import {
  LayoutGrid, Users, Bot, Building2, Settings as SettingsIcon,
  Wallet, ClipboardList, Bell, Sun, Moon, LogOut, CalendarDays, CreditCard, ChevronDown, FileText, UserSquare2,
} from 'lucide-react';

type NavItem = {
  labelKey: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  path: string;
};

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems: NavItem[] = [
  { labelKey: 'dashboard',  icon: LayoutGrid,     path: '/dashboard'      },
  { labelKey: 'leads',      icon: Users,          path: '/leads'          },
  { labelKey: 'patients',   icon: UserSquare2,    path: '/patients'       },
  { labelKey: 'aiActivity', icon: Bot,            path: '/ai-activity'    },
  { labelKey: 'appointments', icon: CalendarDays, path: '/appointments'   },
  { labelKey: 'payments',   icon: CreditCard,     path: '/payments'       },
  { labelKey: 'invoices',   icon: FileText,       path: '/invoices'       },
  { labelKey: 'clinics',    icon: Building2,      path: '/clinics'        },
  { labelKey: 'settings',   icon: SettingsIcon,   path: '/settings'       },
];

const superAdminItems: NavItem[] = [
  { labelKey: 'commission',    icon: Wallet,        path: '/commission'     },
  { labelKey: 'demoRequests',  icon: ClipboardList, path: '/demo-requests'  },
];

const COMMISSION_ROLES = ['director', 'clinic_admin'];

const commissionItems: NavItem[] = [
  { labelKey: 'commission', icon: Wallet, path: '/commission' },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t, i18n } = useTranslation('nav');
  const { user, logout, switchTenant } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const logoSrc = theme === 'light' ? carenovaLogoLight : carenovaLogoDark;
  const [escalationCount,   setEscalationCount]   = useState(0);
  const [notifications,     setNotifications]      = useState<Notification[]>([]);
  const [unreadCount,       setUnreadCount]        = useState(0);
  const [bellOpen,          setBellOpen]           = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Clinic switcher
  const [myTenants,    setMyTenants]    = useState<TenantChoice[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switching,    setSwitching]    = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Poll for escalation count every 60s
  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      try {
        const res = await api.get<{ conversations: { actionRequired: boolean }[] }>(
          '/api/activity?action_required=true&limit=100',
        );
        if (!cancelled) setEscalationCount(res.data.conversations.filter(c => c.actionRequired).length);
      } catch {}
    }
    fetchCount();
    const timer = setInterval(fetchCount, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // Poll for notifications every 30s
  useEffect(() => {
    let cancelled = false;
    async function fetchNotifications() {
      try {
        const res = await api.get<{ notifications: Notification[]; unreadCount: number }>(
          '/api/notifications?limit=10',
        );
        if (!cancelled) {
          setNotifications(res.data.notifications);
          setUnreadCount(res.data.unreadCount);
        }
      } catch {}
    }
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  // Close bell dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch tenant list for clinic switcher — re-run only when user identity changes.
  useEffect(() => {
    if (!user?.id) return;
    api.get<{ tenants: TenantChoice[] }>('/auth/my-tenants')
      .then(res => setMyTenants(res.data.tenants))
      .catch(() => setMyTenants([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Close switcher dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close drawer when Escape pressed
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  async function markRead(id: string) {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {}
  }

  async function markAllRead() {
    try {
      await api.patch('/api/notifications/read-all');
      setNotifications(ns => ns.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }

  async function handleSwitchTenant(tenantId: string) {
    if (tenantId === user?.tenantId || switching) return;
    setSwitcherOpen(false);
    setSwitching(true);
    try {
      await switchTenant(tenantId); // hard-navigates on success
    } catch {
      setSwitching(false);
    }
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return t('justNow');
    if (m < 60) return t('minutesAgo', { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('hoursAgo', { count: h });
    return t('daysAgo', { count: Math.floor(h / 24) });
  }

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : 'DC';
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Demo Clinic';
  const displayRole = user ? user.role.replace(/_/g, ' ') : 'Admin';

  return (
    <>
      {/* ── Mobile overlay (behind drawer, above page content) ─────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar / drawer ────────────────────────────────────────────── */}
      {/*
        Mobile  : fixed drawer, slides in/out on translate-x.
        Desktop : relative in flex flow, always visible (md:translate-x-0 wins).
      */}
      <aside
        className={[
          // ── Positioning ──
          'fixed inset-y-0 left-0 z-50',          // mobile: overlay drawer
          'md:relative md:inset-auto md:z-auto',   // desktop: back in flow
          // ── Size & style ──
          'w-72 shrink-0 bg-navy-900 flex flex-col h-[100dvh] border-r border-navy-600',
          // ── Slide transition ──
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',                      // always visible on desktop
        ].join(' ')}
      >
        {/* ── Header: logo + bell + mobile close ─────────────────────── */}
        <div className="px-6 py-7 border-b border-navy-600 relative" ref={bellRef}>
          <div className="flex items-center justify-center">
            <div>
              <img src={logoSrc} alt="CareNova AI" className="w-full max-w-[220px] h-auto" />
            </div>

            {/* Notification bell */}
            <div className="ml-auto">
              <button
                onClick={() => setBellOpen(v => !v)}
                className="relative w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-navy-700 transition-colors"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Close button — mobile drawer only */}
            {/* eslint-disable i18next/no-literal-string -- ✕ is a symbol, not translatable text */}
            <button
              onClick={onClose}
              className="md:hidden ml-2 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-navy-700 transition-colors text-base"
              aria-label={t('closeMenu')}
            >
              ✕
            </button>
            {/* eslint-enable i18next/no-literal-string */}
          </div>

          {/* Dropdown — anchored to header-div, fits inside sidebar */}
          {bellOpen && (
            <div className="absolute left-3 right-3 top-full bg-navy-800 border border-navy-600 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-navy-700">
                <p className="text-white text-sm font-semibold">{t('notifications')}</p>
                {unreadCount > 0 && (
                  <button onClick={markAllRead}
                    className="text-xs text-gold hover:text-gold-light transition-colors">
                    {t('markAllRead')}
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-navy-700">
                {notifications.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">{t('noNotifications')}</p>
                ) : notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => { markRead(n.id); if (n.link) { setBellOpen(false); } }}
                    className={`px-4 py-3 cursor-pointer hover:bg-navy-700 transition-colors ${!n.read ? 'bg-navy-750' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 shrink-0" />}
                      <div className={!n.read ? '' : 'ml-3.5'}>
                        <p className={`text-sm font-medium ${n.read ? 'text-gray-300' : 'text-white'}`}>{n.title}</p>
                        <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-gray-600 text-[10px] mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Nav ─────────────────────────────────────────────────────── */}
        <nav className="flex-1 min-h-0 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-l-2 border-gold text-gold bg-navy-700 pl-[10px]'
                    : 'text-gray-400 hover:text-white hover:bg-navy-700'
                }`
              }
            >
              {(() => { const Icon = item.icon; return <Icon size={18} className="shrink-0" />; })()}
              <span className="flex-1">{t(item.labelKey)}</span>
              {item.path === '/ai-activity' && escalationCount > 0 && (
                <span className="ml-auto bg-yellow-500 text-navy-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {escalationCount > 99 ? '99+' : escalationCount}
                </span>
              )}
            </NavLink>
          ))}

          {user?.role && COMMISSION_ROLES.includes(user.role) && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">{t('management')}</p>
              </div>
              {commissionItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-l-2 border-gold text-gold bg-navy-700 pl-[10px]'
                        : 'text-gray-400 hover:text-white hover:bg-navy-700'
                    }`
                  }
                >
                  {(() => { const Icon = item.icon; return <Icon size={18} className="shrink-0" />; })()}
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </>
          )}

          {user?.role === 'super_admin' && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">{t('superAdmin')}</p>
              </div>
              {superAdminItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-l-2 border-gold text-gold bg-navy-700 pl-[10px]'
                        : 'text-gray-400 hover:text-white hover:bg-navy-700'
                    }`
                  }
                >
                  {(() => { const Icon = item.icon; return <Icon size={18} className="shrink-0" />; })()}
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* ── Footer: user info, theme toggle, logout ─────────────────── */}
        <div className="shrink-0 px-4 py-5 border-t border-navy-600 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate capitalize">{displayName}</p>
              <p className="text-gray-500 text-xs truncate capitalize">{displayRole}</p>
            </div>
          </div>

          {/* ── Clinic switcher (only for multi-tenant users) ─────────── */}
          {myTenants.length > 1 && (
            <div className="relative" ref={switcherRef}>
              <button
                onClick={() => setSwitcherOpen(v => !v)}
                disabled={switching}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-navy-700 transition-colors disabled:opacity-50"
              >
                <Building2 size={16} className="shrink-0" />
                <span className="flex-1 text-left truncate">
                  {myTenants.find(tn => tn.tenantId === user?.tenantId)?.tenantName ?? t('switchClinic')}
                </span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 transition-transform duration-200 ${switcherOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {switcherOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-navy-800 border border-navy-600 rounded-xl shadow-xl overflow-hidden z-50">
                  {myTenants.map(tenant => {
                    const isActive = tenant.tenantId === user?.tenantId;
                    return (
                      <button
                        key={tenant.tenantId}
                        onClick={() => handleSwitchTenant(tenant.tenantId)}
                        disabled={isActive || switching}
                        className={[
                          'w-full text-left px-4 py-3 text-sm transition-colors',
                          isActive
                            ? 'bg-navy-700 cursor-default'
                            : 'hover:bg-navy-700',
                        ].join(' ')}
                      >
                        <span className={`block font-medium ${isActive ? 'text-white' : 'text-gray-200'}`}>
                          {tenant.tenantName}
                        </span>
                        <span className="block text-xs text-gray-500 mt-0.5 capitalize">
                          {tenant.role.replace(/_/g, ' ')}
                        </span>
                        {isActive && (
                          <span className="block text-xs text-gold mt-0.5">{t('active')}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 px-1">
            {(['tr', 'en'] as const).map(lng => (
              <button
                key={lng}
                onClick={() => i18n.changeLanguage(lng)}
                aria-current={i18n.language?.startsWith(lng)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
                  i18n.language?.startsWith(lng)
                    ? 'bg-navy-700 text-gold'
                    : 'text-gray-500 hover:text-white hover:bg-navy-700'
                }`}
              >
                {lng}
              </button>
            ))}
          </div>

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-navy-700 transition-colors"
            title={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? t('lightMode') : t('darkMode')}
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-navy-700 transition-colors"
          >
            <LogOut size={16} />
            {t('signOut')}
          </button>
        </div>
      </aside>
    </>
  );
}

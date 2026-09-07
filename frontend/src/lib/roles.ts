// Shared platform-vs-clinic role helper. `PLATFORM_ROLES`/ad-hoc
// `user.role === 'super_admin'` checks already exist independently in
// ~20 files (ProtectedRoute, LoginPage, Sidebar, Dashboard, CommissionPage,
// SettingsPage, ...) — not refactored here (out of scope for tonight, no
// functional bug in the existing duplication), but new admin-host code
// should use this single definition rather than adding a 21st copy.
import { User } from '../context/AuthContext';

export const PLATFORM_ROLES: User['role'][] = ['super_admin', 'admin'];

export function isPlatformAdmin(role: User['role'] | undefined): boolean {
  return !!role && PLATFORM_ROLES.includes(role);
}

// APP-ADMIN-EKSIKLER-KOMUTU.md Görev 1.4 — commission data (individual pay)
// must not be visible to tercuman/koordinator/doktor. `COMMISSION_ROLES` is
// who may open /commission at all — used by CommissionPage.tsx's own page
// guard, matching the page's existing MANAGE_ROLES/isPlatformAdmin logic
// (a platform admin can already use it via the clinic-selector dropdown).
// `COMMISSION_NAV_ROLES` is the narrower set Sidebar.tsx shows the link to
// under "Management" — super_admin is deliberately excluded from THAT one:
// they already get their own Commission link under the separate "Süper
// Admin" nav group, and including them here too would render it twice.
export const COMMISSION_ROLES: User['role'][] = ['super_admin', 'admin', 'operasyon_muduru', 'klinik_sahibi'];
export const COMMISSION_NAV_ROLES: User['role'][] = ['operasyon_muduru', 'klinik_sahibi'];

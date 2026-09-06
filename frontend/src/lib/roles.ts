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

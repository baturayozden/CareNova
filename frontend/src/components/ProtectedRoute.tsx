import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, User } from '../context/AuthContext';
import { PLATFORM_ROLES } from '../lib/roles';
import { hostUrls } from '../config/hosts';
import AppLoadingScreen from './AppLoadingScreen';

interface ProtectedRouteProps {
  roles?: string[];
}

/**
 * Returns the correct home base URL for a given role, or null when the app
 * and admin hosts resolve to the SAME origin (local dev with no env vars
 * and demo mode off) — enforcement would just redirect to itself in a loop.
 * Uses hosts.ts (not raw env vars) so this is exercisable locally via
 * ?host=app / ?host=admin, not only with real app.carenova.ai/admin.carenova.ai
 * domains — see docs/host-setup.md.
 */
function correctBaseForRole(role: User['role']): string | null {
  if (hostUrls.app === hostUrls.admin) return null;
  return PLATFORM_ROLES.includes(role) ? hostUrls.admin : hostUrls.app;
}

export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    // /auth/me is what this waits on, and on a sleeping free Render instance
    // that is 30-50 s. AppLoadingScreen says so rather than spinning silently.
    return <AppLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Subdomain enforcement — redirect to the correct subdomain if on the wrong one
  const correctBase = correctBaseForRole(user.role);
  if (correctBase && !window.location.href.startsWith(correctBase)) {
    window.location.href = `${correctBase}/dashboard`;
    return null; // prevent rendering while redirect happens
  }

  return <Outlet />;
}

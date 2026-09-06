import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, User } from '../context/AuthContext';
import { PLATFORM_ROLES } from '../lib/roles';
import { hostUrls } from '../config/hosts';

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
    return (
      <div className="flex h-screen items-center justify-center bg-surface-page">
        <div className="w-10 h-10 border-4 border-line border-t-accent rounded-full animate-spin" />
      </div>
    );
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

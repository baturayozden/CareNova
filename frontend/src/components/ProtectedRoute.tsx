import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, User } from '../context/AuthContext';

interface ProtectedRouteProps {
  roles?: string[];
}

const PLATFORM_ROLES: User['role'][] = ['super_admin', 'admin'];

const APP_URL   = process.env.REACT_APP_APP_URL   || '';
const ADMIN_URL = process.env.REACT_APP_ADMIN_URL || '';

/**
 * Returns the correct home base URL for a given role, or null in local dev
 * (env vars not set) where subdomain enforcement is skipped.
 */
function correctBaseForRole(role: User['role']): string | null {
  if (!APP_URL || !ADMIN_URL) return null; // local dev — no enforcement
  return PLATFORM_ROLES.includes(role) ? ADMIN_URL : APP_URL;
}

export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-navy-950">
        <div className="w-10 h-10 border-4 border-navy-600 border-t-gold rounded-full animate-spin" />
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

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { TokenStore } from '../lib/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'admin' | 'clinic_owner' | 'clinic_admin' | 'receptionist' | 'doctor' | 'director' | 'dentist' | 'nurse' | 'treatment_coordinator';
  tenantId: string | null;
  phone?:          string | null;
  avatarUrl?:      string | null;
  financeEnabled?: boolean;
}

export interface TenantChoice {
  tenantId:   string;
  tenantName: string;
  role:       string;
}

export type LoginResult =
  | { type: 'done';   user: User }
  | { type: 'select'; selectionToken: string; tenants: TenantChoice[] };

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId?: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  selectTenant: (selectionToken: string, tenantId: string) => Promise<User>;
  switchTenant: (tenantId: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Always attempt rehydration via /auth/me.
  // The browser sends the shared .carenova.ai cookie automatically
  // (withCredentials), so a session started on another subdomain
  // (e.g. app. → admin.) is recognized even when localStorage is empty.
  useEffect(() => {
    api.get<{ user: User }>('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => {
        TokenStore.clear();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const res = await api.post<
      | { needsTenantSelection: true; selectionToken: string; tenants: TenantChoice[] }
      | { user: User; accessToken: string; refreshToken: string }
    >('/auth/login', { email, password });

    if ((res.data as { needsTenantSelection?: boolean }).needsTenantSelection) {
      const d = res.data as { needsTenantSelection: true; selectionToken: string; tenants: TenantChoice[] };
      return { type: 'select', selectionToken: d.selectionToken, tenants: d.tenants };
    }

    const d = res.data as { user: User; accessToken: string; refreshToken: string };
    TokenStore.set(d.accessToken, d.refreshToken);
    setUser(d.user);
    return { type: 'done', user: d.user };
  }, []);

  const selectTenant = useCallback(async (selectionToken: string, tenantId: string): Promise<User> => {
    const res = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/select-tenant',
      { selectionToken, tenantId },
    );
    TokenStore.set(res.data.accessToken, res.data.refreshToken);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const switchTenant = useCallback(async (tenantId: string): Promise<void> => {
    const res = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/switch-tenant',
      { tenantId },
    );
    TokenStore.set(res.data.accessToken, res.data.refreshToken);
    setUser(res.data.user);
    // Hard-navigate to flush all tenant-scoped component state cleanly
    window.location.href = '/dashboard';
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', { refreshToken: TokenStore.getRefresh() });
    } catch {
      // swallow — still clear client state
    }
    TokenStore.clear();
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const register = useCallback(async (data: RegisterData) => {
    const res = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/register',
      data,
    );
    TokenStore.set(res.data.accessToken, res.data.refreshToken);
    setUser(res.data.user);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.get<{ user: User }>('/auth/me');
    setUser(res.data.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, selectTenant, switchTenant, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

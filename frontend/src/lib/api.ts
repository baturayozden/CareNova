import axios, { InternalAxiosRequestConfig } from 'axios';
import demoAdapter from './demoAdapter';

export const DEMO_MODE = process.env.REACT_APP_DEMO_MODE === 'true';

// ── Token helpers ─────────────────────────────────────────────────────────────

export const TokenStore = {
  getAccess:      ()    => localStorage.getItem('accessToken'),
  getRefresh:     ()    => localStorage.getItem('refreshToken'),
  setAccess:      (t: string) => localStorage.setItem('accessToken', t),
  setRefresh:     (t: string) => localStorage.setItem('refreshToken', t),
  set:  (access: string, refresh: string) => {
    localStorage.setItem('accessToken',  access);
    localStorage.setItem('refreshToken', refresh);
  },
  clear: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};

// ── Axios instance ────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
  // withCredentials kept so same-origin cookie fallback still works during dev
  withCredentials: true,
  // Demo mode never touches the network — no backend is deployed tonight.
  // See src/lib/demoAdapter.ts and src/data/demoData.ts.
  ...(DEMO_MODE ? { adapter: demoAdapter } : {}),
});

// ── Request interceptor — attach Bearer token ─────────────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = TokenStore.getAccess();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Protected prefixes — only these trigger /login redirect on 401 ───────────
// Public by default; add a prefix here only for routes inside <ProtectedRoute>.
const PROTECTED_PREFIXES = [
  '/dashboard', '/leads', '/ai-activity', '/appointments',
  '/clinics', '/settings', '/commission', '/demo-requests',
  '/invoices', '/patients',
];

function isPublicPath() {
  const p = window.location.pathname;
  return !PROTECTED_PREFIXES.some(prefix => p === prefix || p.startsWith(prefix + '/'));
}

function redirectToLogin() {
  // Only redirect if the user is currently on a protected page.
  // On public pages (landing, login, register) we just clear stale tokens
  // and let the page stay — no jarring redirect.
  if (!isPublicPath()) {
    window.location.href = '/login';
  }
}

// ── Response interceptor — refresh on 401, then retry once ───────────────────

let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function flushQueue(token: string | null, err: unknown = null) {
  pendingQueue.forEach(p => (token ? p.resolve(token) : p.reject(err)));
  pendingQueue = [];
}

api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh on 401, and only once per request
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Don't refresh if the failing request IS the refresh endpoint (avoid loop)
    if (original.url?.includes('/auth/refresh')) {
      TokenStore.clear();
      redirectToLogin();
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      // Another refresh is already in flight — queue this request
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (newToken) => {
            original.headers = original.headers ?? {};
            original.headers['Authorization'] = `Bearer ${newToken}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    try {
      const { data } = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        {
          accessToken:  TokenStore.getAccess(),
          refreshToken: TokenStore.getRefresh(),
        },
        { _retry: true } as object, // prevent this call from looping
      );

      TokenStore.set(data.accessToken, data.refreshToken);
      flushQueue(data.accessToken);

      original.headers = original.headers ?? {};
      original.headers['Authorization'] = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshErr) {
      flushQueue(null, refreshErr);
      TokenStore.clear();
      redirectToLogin();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;

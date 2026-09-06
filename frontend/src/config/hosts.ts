// Single source of truth for which of the three hosts (marketing / app /
// admin) this page load is serving. One Vercel project, one bundle — the
// host determines which route tree App.tsx mounts (see App.tsx) and never
// changes for the lifetime of a page load (switching hosts means a real
// navigation to a different domain, not client-side routing).
//
// Resolution order (first match wins):
//   1. Exact hostname match against REACT_APP_{MARKETING,APP,ADMIN}_URL —
//      the real production signal once DNS/domains are wired up.
//   2. Plain "app."/"admin." hostname prefix — safe fallback if an env var
//      is forgotten at build time (CRA env vars are baked in at build time,
//      easy to lose track of).
//   3. Known *.vercel.app test hostnames (carenova-app*, carenova-admin*) —
//      lets Baturay test app/admin before real domains are attached
//      (docs/host-setup.md).
//   4. DEMO-MODE-ONLY ?host=app|admin|marketing query override, persisted to
//      localStorage so it survives internal navigation; ?host=reset clears
//      it. Gated on REACT_APP_DEMO_MODE==='true' — in production this step
//      does not exist, hostname is the only signal.
//   5. Default: marketing.

export type HostMode = 'marketing' | 'app' | 'admin';

const DEMO_MODE = process.env.REACT_APP_DEMO_MODE === 'true';
const HOST_OVERRIDE_KEY = 'carenova_host_override';

function hostnameOf(url?: string): string | null {
  if (!url) return null;
  try { return new URL(url).hostname; } catch { return null; }
}

const envMarketingHost = hostnameOf(process.env.REACT_APP_MARKETING_URL);
const envAppHost = hostnameOf(process.env.REACT_APP_APP_URL);
const envAdminHost = hostnameOf(process.env.REACT_APP_ADMIN_URL);

function readQueryOverride(): HostMode | 'reset' | null {
  const val = new URLSearchParams(window.location.search).get('host');
  return val === 'app' || val === 'admin' || val === 'marketing' || val === 'reset' ? val : null;
}

function readStoredOverride(): HostMode | null {
  try {
    const v = window.localStorage.getItem(HOST_OVERRIDE_KEY);
    return v === 'app' || v === 'admin' || v === 'marketing' ? v : null;
  } catch {
    return null; // localStorage unavailable (private mode, etc.) — fall through to default
  }
}

function resolveHostMode(): HostMode {
  const hostname = window.location.hostname;

  if (envAdminHost && hostname === envAdminHost) return 'admin';
  if (envAppHost && hostname === envAppHost) return 'app';
  if (envMarketingHost && hostname === envMarketingHost) return 'marketing';

  if (hostname.startsWith('admin.')) return 'admin';
  if (hostname.startsWith('app.')) return 'app';

  if (/^carenova-admin/.test(hostname)) return 'admin';
  if (/^carenova-app/.test(hostname)) return 'app';

  if (DEMO_MODE) {
    const q = readQueryOverride();
    if (q === 'reset') {
      try { window.localStorage.removeItem(HOST_OVERRIDE_KEY); } catch { /* ignore */ }
    } else if (q) {
      try { window.localStorage.setItem(HOST_OVERRIDE_KEY, q); } catch { /* ignore */ }
      return q;
    } else {
      const stored = readStoredOverride();
      if (stored) return stored;
    }
  }

  return 'marketing';
}

// Computed once per page load — see the file header for why that's correct
// here (switching host is a real navigation, not an SPA transition).
export const hostMode: HostMode = resolveHostMode();

const envUrl: Record<HostMode, string | undefined> = {
  marketing: process.env.REACT_APP_MARKETING_URL,
  app: process.env.REACT_APP_APP_URL,
  admin: process.env.REACT_APP_ADMIN_URL,
};

// Origin-only URLs for the three hosts — kept for anything that just needs
// "which domain is this", but prefer urlFor() below for building a link to
// a specific PATH on another host: naively concatenating a path onto the
// ?host= demo fallback (e.g. `${hostUrls.app}/login`) produces a broken
// `origin/?host=app/login` (path glued after the query string).
export const hostUrls: Record<HostMode, string> = {
  marketing: envUrl.marketing || window.location.origin,
  app: envUrl.app || window.location.origin,
  admin: envUrl.admin || window.location.origin,
};

// Build a link to `path` on the given host. Real env URL set → normal
// absolute URL. Falling back to the demo-mode query override → the ?host=
// param has to come AFTER the path, on the same origin, not before it.
export function urlFor(mode: HostMode, path: string = '/'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const real = envUrl[mode];
  if (real) return `${real.replace(/\/$/, '')}${cleanPath}`;
  if (DEMO_MODE) return `${window.location.origin}${cleanPath}?host=${mode}`;
  return `${window.location.origin}${cleanPath}`;
}

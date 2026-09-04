/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    dataLayer:    any[];
    __gtmLoaded?: boolean;
  }
}

// ── Env ID ───────────────────────────────────────────────────────────────────
const GTM_ID = process.env.REACT_APP_GTM_ID;

// ── Types ────────────────────────────────────────────────────────────────────
export type Consent = {
  analytics: boolean;
  marketing: boolean;
  ts:        string;
  version:   number;
};

const STORAGE_KEY = 'cd_cookie_consent_v1';
const VERSION     = 1;

// ── Storage helpers ──────────────────────────────────────────────────────────
export function getConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Consent;
    if (parsed.version !== VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setConsent(analytics: boolean, marketing: boolean): Consent {
  const c: Consent = { analytics, marketing, ts: new Date().toISOString(), version: VERSION };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  return c;
}

// ── Consent Mode v2 helper ───────────────────────────────────────────────────
function pushConsent(update: Record<string, string>): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(['consent', 'update', update]);
}

// ── GTM loader (single load guard) ──────────────────────────────────────────
function loadGTM(): void {
  if (!GTM_ID || GTM_ID.indexOf('GTM-') !== 0) return;
  if (window.__gtmLoaded) return;
  window.__gtmLoaded = true;
  (function (w: any, d: any, s: string, l: string, i: string) {
    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    const f = d.getElementsByTagName(s)[0];
    const j = d.createElement(s) as HTMLScriptElement;
    const dl = l !== 'dataLayer' ? '&l=' + l : '';
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
    f.parentNode.insertBefore(j, f);
  })(window, document, 'script', 'dataLayer', GTM_ID);
}

// ── Update consent signals (call after any consent decision) ─────────────────
export function updateConsent(c: Consent): void {
  // Consent Mode v2 signals — picked up by GA4, Ads tags inside GTM
  pushConsent({ analytics_storage: c.analytics ? 'granted' : 'denied' });
  pushConsent({
    ad_storage:         c.marketing ? 'granted' : 'denied',
    ad_user_data:       c.marketing ? 'granted' : 'denied',
    ad_personalization: c.marketing ? 'granted' : 'denied',
  });
  // dataLayer event for non-Google tags configured in GTM
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event:             'consent_update',
    analytics_consent: c.analytics,
    marketing_consent: c.marketing,
  });
}

// ── Init — call once on app mount ─────────────────────────────────────────────
export function initConsent(): void {
  loadGTM();                        // load container (index.html defaults already denied)
  const stored = getConsent();
  if (stored) updateConsent(stored); // replay stored signals into GTM
}

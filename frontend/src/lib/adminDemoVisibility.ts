// The admin console's "show demo data" switch.
//
// Off = every platform request carries `includeDemo=false` (added in
// lib/api.ts), so the console shows only real tenants — what the platform looks
// like on day one. Screens need no code for it: the request interceptor adds
// the parameter, usePlatformQuery refetches when it flips.
//
// `?demo=hidden` / `?demo=shown` in the URL sets it on load (screenshots of the
// empty state); otherwise the viewer's last choice is remembered.
import { useSyncExternalStore } from 'react';
import { resetDemoProvenance } from './demoProvenance';

const STORAGE_KEY = 'carenova.admin.hideDemo';
const listeners = new Set<() => void>();

function initial(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('demo');
    if (q === 'hidden') return true;
    if (q === 'shown') return false;
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

let hideDemo = typeof window === 'undefined' ? false : initial();

export function isDemoHidden(): boolean {
  return hideDemo;
}

export function setDemoHidden(next: boolean): void {
  if (next === hideDemo) return;
  hideDemo = next;
  try { window.localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* private mode */ }
  // The marks describe rows the screen is about to throw away; the refetch
  // marks it again if demo rows are still in the answer.
  resetDemoProvenance();
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useDemoHidden(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(subscribe, isDemoHidden, () => false);
  return [value, setDemoHidden];
}

/** Endpoints that understand `includeDemo`. */
export function acceptsIncludeDemo(url: string | undefined): boolean {
  return !!url && (url.startsWith('/api/admin/platform') || url === '/api/demo' || url.startsWith('/api/demo?'));
}

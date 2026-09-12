import React, { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { subscribeDemoProvenance, demoSourceCount } from '../lib/demoProvenance';
import { findUnmarkedDemoNames } from '../lib/demoNameAudit';

// Development only: lets the audit be re-run by hand on any screen (and is how
// the "scan every screen again" verification step is performed).
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  (window as unknown as { __demoAudit: () => unknown }).__demoAudit = () =>
    findUnmarkedDemoNames(document.querySelector('main') ?? document.body);
}

/**
 * Page-top banner for any screen that shows fabricated records. Mounted ONCE in
 * each shell (components/Layout.tsx, admin/AdminLayout.tsx), above the routed
 * page — never inside a page. It decides on its own whether to show, from the
 * provenance store: a screen that reads a demoSource() collection gets the
 * banner; one that does not (Settings, login, a future real-data screen) does
 * not. No page can forget it, because no page places it.
 *
 * In the content flow, not sticky, and not dismissible — per the brief.
 */
export default function DemoDataBanner({ className = '' }: { className?: string }) {
  const { pathname } = useLocation();
  const { t } = useTranslation('common');
  const sources = useSyncExternalStore(
    subscribeDemoProvenance,
    () => demoSourceCount(pathname),
    () => 0,
  );

  // Development guard for the record-level marker: shout about any fabricated
  // name that reached the screen without <DemoName>. A timeout, not rAF —
  // requestAnimationFrame is suspended in automation browsers (CLAUDE.md).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || sources === 0) return undefined;
    const id = window.setTimeout(() => {
      const unmarked = findUnmarkedDemoNames(document.querySelector('main') ?? document.body);
      if (unmarked.length) {
        // eslint-disable-next-line no-console
        console.error(
          `[demo-data] ${unmarked.length} fabricated name(s) on ${pathname} rendered without <DemoName>:`,
          unmarked,
        );
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [sources, pathname]);

  if (sources === 0) return null;

  return (
    <div
      role="note"
      data-demo-banner=""
      className={`flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning ${className}`}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="leading-snug">
        <strong className="font-semibold tracking-wide">{t('demoData.bannerTitle')}</strong>
        {' — '}
        {t('demoData.bannerBody')}
      </p>
    </div>
  );
}

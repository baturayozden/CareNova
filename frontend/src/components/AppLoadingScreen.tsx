import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Full-screen loading gate for the app and admin hosts.
 *
 * Why this exists as a component rather than an inline spinner: every visit to
 * app./admin. blocks on AuthContext's /auth/me before a single pixel of the
 * panel can render, and the API runs on a free Render instance that sleeps
 * after ~15 min idle — so that first call can take 30-50 s. A bare spinner for
 * 40 s reads as a broken product, which is exactly the wrong impression in
 * front of a clinic during a demo.
 *
 * The admin screens already say this for their own data loads
 * (admin/components/QueryState.tsx → LoadingState). This is the same promise
 * one layer up, on the gate that actually eats the cold start.
 */
export default function AppLoadingScreen() {
  const { t } = useTranslation('common');
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    // Under ~5 s nobody needs an explanation; past it, silence is the problem.
    const id = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      className="flex h-screen flex-col items-center justify-center gap-4 bg-surface-page px-6"
      role="status"
      aria-live="polite"
    >
      <div className="w-10 h-10 border-4 border-line border-t-accent rounded-full animate-spin" aria-hidden="true" />
      <p className="text-sm text-ink-muted">{t('loading')}</p>
      {slow && (
        <p className="max-w-sm text-center text-xs text-ink-subtle">{t('wakingServer')}</p>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertOctagon, Inbox, RefreshCw } from 'lucide-react';
import { useDemoHidden } from '../../lib/adminDemoVisibility';

/** Loading, error and empty states shared by every admin screen. */

export function LoadingState() {
  const { t } = useTranslation('admin');
  // The API runs on a free Render instance that sleeps: the first request after
  // a quiet spell takes 30-50 s. Say so instead of spinning silently.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface py-16" role="status" aria-live="polite">
      <div className="w-8 h-8 border-4 border-line border-t-accent rounded-full animate-spin" aria-hidden="true" />
      <p className="text-sm text-ink-muted">{t('state.loading')}</p>
      {slow && <p className="text-xs text-ink-subtle max-w-sm text-center">{t('state.slow')}</p>}
    </div>
  );
}

function errorMessageKey(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401) return 'state.error401';
  if (status === 403) return 'state.error403';
  if (!status) return 'state.errorNetwork';
  return 'state.errorServer';
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation('admin');
  const status = (error as { response?: { status?: number } })?.response?.status;
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/30 bg-danger-soft py-12 px-4 text-center" role="alert">
      <AlertOctagon size={24} strokeWidth={1.75} className="text-danger" aria-hidden="true" />
      <p className="text-sm font-semibold text-ink">{t('state.errorTitle')}</p>
      <p className="text-sm text-ink-muted max-w-md">
        {t(errorMessageKey(error))}
        {status ? ` (HTTP ${status})` : ''}
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors"
      >
        <RefreshCw size={14} strokeWidth={1.75} aria-hidden="true" /> {t('common:retry')}
      </button>
    </div>
  );
}

/** Nothing to show. When demo data is hidden, says so — the list may be empty only because of that. */
export function EmptyState({ title, body }: { title: string; body?: string }) {
  const { t } = useTranslation('admin');
  const [hideDemo] = useDemoHidden();
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface py-14 px-4 text-center">
      <Inbox size={24} strokeWidth={1.5} className="text-ink-subtle" aria-hidden="true" />
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body && <p className="text-sm text-ink-muted max-w-md">{body}</p>}
      {hideDemo && <p className="text-xs text-ink-subtle max-w-md">{t('state.demoHiddenHint')}</p>}
    </div>
  );
}

/** A value the platform does not measure yet — shown instead of a number. */
export function NotMeasured({ reason }: { reason?: string }) {
  const { t } = useTranslation('admin');
  return (
    <span className="text-sm font-normal text-ink-subtle italic" title={reason}>
      {t('state.notMeasured')}
    </span>
  );
}

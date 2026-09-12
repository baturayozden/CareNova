import React from 'react';
import DemoName, { useDemoNameText } from '../../components/DemoName';
import { Download } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat, downloadText, csvRow } from '../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../components/QueryState';
import type { DemoRequestRow } from '../types';

const STATUS_TONE: Record<DemoRequestRow['status'], 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> = {
  new: 'accent', contacted: 'warning', demo_done: 'neutral', won: 'success', lost: 'danger',
};
const th = 'px-4 py-2.5 font-medium text-ink-subtle';

export default function AdminDemoRequestsPage() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const demoNameText = useDemoNameText();
  const query = usePlatformQuery<{ requests: DemoRequestRow[] }>('/api/demo');
  const requests = query.data?.requests ?? [];

  // An exported file leaves the screen and its banner behind, so every demo
  // row identifies itself inside the file.
  const exportCsv = () => {
    const header = csvRow([t('demoRequests.columns.name'), 'E-mail', t('demoRequests.columns.clinic'), t('demoRequests.columns.city'), t('demoRequests.columns.branch'), t('demoRequests.columns.phone'), t('demoRequests.columns.date'), t('demoRequests.columns.status'), t('demoRequests.columns.note')]);
    const lines = requests.map(r => csvRow([
      demoNameText(r.name, r.is_demo), r.email, demoNameText(r.clinic_name, r.is_demo), r.city, r.branch_key ? fmt.branch(r.branch_key) : '',
      r.phone, r.created_at, t(`labels.demoRequestStatus.${r.status}`), r.notes,
    ]));
    downloadText('demo-requests.csv', [header, ...lines].join('\n'));
  };

  return (
    <div className="space-y-4">
      <AppMeta title={`${t('demoRequests.title')} | CareNova Platform`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t('demoRequests.title')}</h1>
          {query.data && <p className="text-ink-muted text-sm mt-0.5">{t('demoRequests.subtitle', { count: requests.length })}</p>}
        </div>
        <button
          onClick={exportCsv}
          disabled={requests.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={14} strokeWidth={1.75} aria-hidden="true" /> {t('demoRequests.exportCsv')}
        </button>
      </div>

      {query.loading ? <LoadingState />
        : query.error ? <ErrorState error={query.error} onRetry={query.reload} />
          : requests.length === 0 ? <EmptyState title={t('demoRequests.emptyTitle')} body={t('demoRequests.emptyBody')} />
            : (
              <div className="rounded-xl border border-line bg-surface overflow-x-auto">
                <table className="w-full text-sm min-w-[860px]">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th scope="col" className={th}>{t('demoRequests.columns.name')}</th>
                      <th scope="col" className={th}>{t('demoRequests.columns.clinic')}</th>
                      <th scope="col" className={th}>{t('demoRequests.columns.city')}</th>
                      <th scope="col" className={th}>{t('demoRequests.columns.branch')}</th>
                      <th scope="col" className={th}>{t('demoRequests.columns.phone')}</th>
                      <th scope="col" className={th}>{t('demoRequests.columns.date')}</th>
                      <th scope="col" className={th}>{t('demoRequests.columns.status')}</th>
                      <th scope="col" className={th}>{t('demoRequests.columns.note')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r, i) => (
                      <tr key={r.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-ink"><DemoName when={r.is_demo}>{r.name}</DemoName></p>
                          <p className="text-ink-subtle text-xs">{r.email}</p>
                        </td>
                        <td className="px-4 py-2.5 text-ink-muted"><DemoName when={r.is_demo}>{r.clinic_name}</DemoName></td>
                        <td className="px-4 py-2.5 text-ink-muted">{r.city ?? '—'}</td>
                        <td className="px-4 py-2.5 text-ink-muted">{r.branch_key ? fmt.branch(r.branch_key) : '—'}</td>
                        <td className="px-4 py-2.5 text-ink-muted">{r.phone ?? '—'}</td>
                        <td className="px-4 py-2.5 text-ink-subtle text-xs">{fmt.date(r.created_at)}</td>
                        <td className="px-4 py-2.5"><StatusBadge tone={STATUS_TONE[r.status] ?? 'neutral'}>{t(`labels.demoRequestStatus.${r.status}`, { defaultValue: r.status })}</StatusBadge></td>
                        <td className="px-4 py-2.5 text-ink-muted text-xs max-w-[180px] truncate" title={r.notes ? demoNameText(r.notes, r.is_demo) : undefined}>
                          {r.notes ? <DemoName when={r.is_demo}>{r.notes}</DemoName> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
    </div>
  );
}

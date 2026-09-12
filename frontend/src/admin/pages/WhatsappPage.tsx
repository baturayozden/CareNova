import React from 'react';
import DemoName from '../../components/DemoName';
import { Link } from 'react-router-dom';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat } from '../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../components/QueryState';
import type { AdminClinic, DemoSplit } from '../types';

type Row = Pick<AdminClinic, 'id' | 'isDemo' | 'name' | 'whatsapp'>;
const th = 'px-4 py-2.5 font-medium text-ink-subtle';

export default function WhatsappPage() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const query = usePlatformQuery<{ counts: DemoSplit; clinics: Row[] }>('/api/admin/platform/whatsapp');

  const hasProblem = (c: Row) => !c.whatsapp || !c.whatsapp.connected || c.whatsapp.errorsLast24h > 0;
  const rows = [...(query.data?.clinics ?? [])].sort((a, b) => Number(hasProblem(b)) - Number(hasProblem(a)));

  return (
    <div className="space-y-4">
      <AppMeta title={`${t('whatsapp.title')} | CareNova Platform`} />
      <div>
        <h1 className="text-xl font-semibold text-ink">{t('whatsapp.title')}</h1>
        <p className="text-ink-muted text-sm mt-0.5">{t('whatsapp.subtitle')}</p>
      </div>

      {query.loading ? <LoadingState />
        : query.error ? <ErrorState error={query.error} onRetry={query.reload} />
          : rows.length === 0 ? <EmptyState title={t('clinics.emptyTitle')} body={t('clinics.emptyBody')} />
            : (
              <>
                <div className="rounded-xl border border-line bg-surface overflow-x-auto">
                  <table className="w-full text-sm min-w-[760px]">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th scope="col" className={th}>{t('whatsapp.columns.clinic')}</th>
                        <th scope="col" className={th}>{t('whatsapp.columns.displayNumber')}</th>
                        <th scope="col" className={th}>{t('whatsapp.columns.status')}</th>
                        <th scope="col" className={th}>{t('whatsapp.columns.lastDelivery')}</th>
                        <th scope="col" className={`${th} text-right`}>{t('whatsapp.columns.messages24h')}</th>
                        <th scope="col" className={`${th} text-right`}>{t('whatsapp.columns.errors24h')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c, i) => (
                        <tr key={c.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                          <td className="px-4 py-2.5"><Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors"><DemoName when={c.isDemo}>{c.name}</DemoName></Link></td>
                          <td className="px-4 py-2.5 text-ink-muted">{c.whatsapp?.displayNumber || '—'}</td>
                          <td className="px-4 py-2.5">
                            {!c.whatsapp ? <StatusBadge tone="neutral">{t('whatsapp.noLine')}</StatusBadge>
                              : c.whatsapp.connected ? <StatusBadge tone="success">{t('whatsapp.connected')}</StatusBadge>
                                : <StatusBadge tone="danger">{t('whatsapp.notConnected')}</StatusBadge>}
                          </td>
                          <td className="px-4 py-2.5 text-ink-subtle text-xs">{fmt.timeAgo(c.whatsapp?.lastWebhookSuccessAt)}</td>
                          <td className="px-4 py-2.5 text-right text-ink">{c.whatsapp ? c.whatsapp.messagesLast24h : '—'}</td>
                          <td className="px-4 py-2.5 text-right">
                            {c.whatsapp && c.whatsapp.errorsLast24h > 0
                              ? <span className="text-danger font-medium">{c.whatsapp.errorsLast24h}</span>
                              : <span className="text-ink-muted">{c.whatsapp ? 0 : '—'}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-ink-subtle">{t('whatsapp.derivedNote')}</p>
              </>
            )}
    </div>
  );
}

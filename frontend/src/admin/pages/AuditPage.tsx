import React, { useState } from 'react';
import DemoName, { useDemoNameText } from '../../components/DemoName';
import { Link } from 'react-router-dom';
import { Download, Lock } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import api from '../../lib/api';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat, downloadText } from '../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../components/QueryState';
import type { AdminAuditEvent, AdminClinic } from '../types';

const PAGE_SIZE = 50;
const th = 'px-4 py-2.5 font-medium text-ink-subtle';

export default function AuditPage() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const demoNameText = useDemoNameText();
  const [tenantId, setTenantId] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const clinics = usePlatformQuery<{ clinics: Array<Pick<AdminClinic, 'id' | 'name' | 'isDemo'>> }>('/api/admin/platform/clinics');
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), ...(tenantId ? { tenantId } : {}) });
  const query = usePlatformQuery<{ total: number; page: number; limit: number; events: AdminAuditEvent[] }>(`/api/admin/platform/audit?${params}`);

  // Read-only: the server builds the CSV (with a DEMO column), the screen only saves it.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api.get<string>('/api/admin/platform/audit', { params: { format: 'csv', ...(tenantId ? { tenantId } : {}) }, responseType: 'text' });
      downloadText('carenova-audit-log.csv', res.data);
    } finally {
      setExporting(false);
    }
  };

  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <AppMeta title={`${t('audit.title')} | CareNova Platform`} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t('audit.title')}</h1>
          <div className="flex items-center gap-1.5 text-ink-subtle text-xs mt-1">
            <Lock size={12} strokeWidth={2} aria-hidden="true" />
            <span>{t('audit.appendOnlyNote')}</span>
          </div>
        </div>
        <button
          onClick={exportCsv}
          disabled={exporting || total === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={14} strokeWidth={1.75} aria-hidden="true" /> {t('audit.exportCsv')}
        </button>
      </div>

      <select
        value={tenantId}
        onChange={(e) => { setTenantId(e.target.value); setPage(1); }}
        aria-label={t('audit.filterAllClinics')}
        className="rounded-lg border border-line bg-surface text-sm text-ink px-3 py-1.5"
      >
        <option value="">{t('audit.filterAllClinics')}</option>
        {(clinics.data?.clinics ?? []).map(c => <option key={c.id} value={c.id}>{demoNameText(c.name, c.isDemo)}</option>)}
      </select>

      {query.loading ? <LoadingState />
        : query.error || !query.data ? <ErrorState error={query.error} onRetry={query.reload} />
          : query.data.events.length === 0 ? <EmptyState title={t('audit.emptyTitle')} body={t('audit.emptyBody')} />
            : (
              <>
                <div className="rounded-xl border border-line bg-surface overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th scope="col" className={th}>{t('audit.columns.who')}</th>
                        <th scope="col" className={th}>{t('audit.columns.what')}</th>
                        <th scope="col" className={th}>{t('audit.columns.clinic')}</th>
                        <th scope="col" className={th}>{t('audit.columns.when')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.events.map((e, i) => (
                        <tr key={e.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                          <td className="px-4 py-2.5 font-medium text-ink" title={e.actor ? undefined : t('audit.noActor')}>{e.actor ?? '—'}</td>
                          <td className="px-4 py-2.5 text-ink-muted">{e.action}</td>
                          <td className="px-4 py-2.5">
                            {e.clinicId && e.clinicName
                              ? <Link to={`/admin/clinics/${e.clinicId}`} className="text-accent hover:underline"><DemoName when={e.isDemo}>{e.clinicName}</DemoName></Link>
                              : <span className="text-ink-subtle">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-ink-subtle text-xs">{fmt.dateTime(e.at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>{t('audit.pageInfo', { page, pages, total })}</span>
                  <div className="flex gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-line px-2.5 py-1 hover:bg-surface-sunken disabled:opacity-50">{t('common:back')}</button>
                    <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-line px-2.5 py-1 hover:bg-surface-sunken disabled:opacity-50">{t('common:next')}</button>
                  </div>
                </div>
              </>
            )}
    </div>
  );
}

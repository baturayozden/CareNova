import React, { useMemo, useState } from 'react';
import DemoName from '../../components/DemoName';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat } from '../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../components/QueryState';
import type { AdminClinic, ClinicStatus, DemoSplit, PlanKey } from '../types';

const STATUS_TONE: Record<ClinicStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success', trial: 'warning', onboarding: 'neutral', suspended: 'danger',
};

const selectClass = 'rounded-lg border border-line bg-surface text-sm text-ink px-3 py-1.5';
const th = 'px-4 py-2.5 font-medium text-ink-subtle';

export default function ClinicsPage() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const query = usePlatformQuery<{ counts: DemoSplit; clinics: AdminClinic[] }>('/api/admin/platform/clinics');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClinicStatus | 'all'>('all');
  const [planFilter, setPlanFilter] = useState<PlanKey | 'all'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'name' | 'lastActivity' | 'cases'>('lastActivity');

  const clinics = useMemo(() => query.data?.clinics ?? [], [query.data]);
  const branchKeys = useMemo(() => Array.from(new Set(clinics.flatMap(c => c.branches))).sort(), [clinics]);

  const filtered = useMemo(() => {
    const needle = search.toLocaleLowerCase(fmt.locale);
    const rows = clinics.filter(c => {
      if (needle && !c.name.toLocaleLowerCase(fmt.locale).includes(needle) && !(c.city ?? '').toLocaleLowerCase(fmt.locale).includes(needle)) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (planFilter !== 'all' && c.plan !== planFilter) return false;
      if (branchFilter !== 'all' && !c.branches.includes(branchFilter)) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, fmt.locale);
      if (sortKey === 'cases') return b.activeCases - a.activeCases;
      return new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime();
    });
  }, [clinics, search, statusFilter, planFilter, branchFilter, sortKey, fmt.locale]);

  return (
    <div className="space-y-4">
      <AppMeta title={`${t('clinics.title')} | CareNova Platform`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t('clinics.title')}</h1>
          {query.data && (
            <p className="text-ink-muted text-sm mt-0.5">
              {t('clinics.subtitle', { filtered: filtered.length, total: clinics.length })}
              {' · '}
              {t('overview.split', { demo: query.data.counts.demo, real: query.data.counts.real })}
            </p>
          )}
        </div>
        <div className="relative">
          <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('clinics.searchPlaceholder')}
            aria-label={t('clinics.searchPlaceholder')}
            className="pl-9 pr-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink w-64 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ClinicStatus | 'all')} className={selectClass} aria-label={t('clinics.columns.status')}>
          <option value="all">{t('clinics.filterAllStatuses')}</option>
          {(['active', 'trial', 'onboarding', 'suspended'] as const).map(s => <option key={s} value={s}>{fmt.clinicStatus(s)}</option>)}
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as PlanKey | 'all')} className={selectClass} aria-label={t('clinics.columns.plan')}>
          <option value="all">{t('clinics.filterAllPlans')}</option>
          {(['solo', 'klinik', 'grup'] as const).map(p => <option key={p} value={p}>{fmt.plan(p)}</option>)}
        </select>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={selectClass} aria-label={t('clinics.columns.branches')}>
          <option value="all">{t('clinics.filterAllBranches')}</option>
          {branchKeys.map(key => <option key={key} value={key}>{fmt.branch(key)}</option>)}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} className={selectClass} aria-label={t('clinics.sortLabel')}>
          <option value="lastActivity">{t('clinics.sortLastActivity')}</option>
          <option value="name">{t('clinics.sortName')}</option>
          <option value="cases">{t('clinics.sortCases')}</option>
        </select>
      </div>

      {query.loading ? <LoadingState />
        : query.error ? <ErrorState error={query.error} onRetry={query.reload} />
          : clinics.length === 0 ? <EmptyState title={t('clinics.emptyTitle')} body={t('clinics.emptyBody')} />
            : (
              <div className="rounded-xl border border-line bg-surface overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b border-line text-left">
                      <th scope="col" className={th}>{t('clinics.columns.clinic')}</th>
                      <th scope="col" className={th}>{t('clinics.columns.city')}</th>
                      <th scope="col" className={th}>{t('clinics.columns.branches')}</th>
                      <th scope="col" className={th}>{t('clinics.columns.plan')}</th>
                      <th scope="col" className={th}>{t('clinics.columns.status')}</th>
                      <th scope="col" className={`${th} text-right`}>{t('clinics.columns.users')}</th>
                      <th scope="col" className={`${th} text-right`}>{t('clinics.columns.activeCases')}</th>
                      <th scope="col" className={th}>{t('clinics.columns.lastActivity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => (
                      <tr key={c.id} className={`border-b border-line last:border-0 hover:bg-surface-sunken ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                        <td className="px-4 py-2.5">
                          <Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors"><DemoName when={c.isDemo}>{c.name}</DemoName></Link>
                        </td>
                        <td className="px-4 py-2.5 text-ink-muted">{c.city ?? '—'}</td>
                        <td className="px-4 py-2.5 text-ink-muted">{fmt.branches(c.branches)}</td>
                        <td className="px-4 py-2.5 text-ink-muted">{fmt.plan(c.plan)}</td>
                        <td className="px-4 py-2.5"><StatusBadge tone={STATUS_TONE[c.status]}>{fmt.clinicStatus(c.status)}</StatusBadge></td>
                        <td className="px-4 py-2.5 text-right text-ink">{c.userCount}</td>
                        <td className="px-4 py-2.5 text-right text-ink">{c.activeCases}</td>
                        <td className="px-4 py-2.5 text-ink-subtle text-xs">{fmt.timeAgo(c.lastActivityAt)}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-muted text-sm">{t('clinics.emptyFiltered')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
    </div>
  );
}

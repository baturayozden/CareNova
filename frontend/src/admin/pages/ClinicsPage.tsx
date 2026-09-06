import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { adminClinics, BRANCH_LABELS, PLAN_LABELS, ClinicStatus, PlanKey, DEMO_NOW_MS } from '../../data/adminDemoData';

const STATUS_TONE: Record<ClinicStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success', trial: 'warning', onboarding: 'neutral', suspended: 'danger',
};
const STATUS_LABEL: Record<ClinicStatus, string> = {
  active: 'Aktif', trial: 'Deneme', onboarding: 'Onboarding', suspended: 'Askıda',
};

export default function ClinicsPage() {
  const { t } = useTranslation('admin');
  const timeAgo = (iso: string): string => {
    const mins = Math.round((DEMO_NOW_MS - new Date(iso).getTime()) / 60000);
    if (mins < 60) return t('clinics.minutesAgo', { count: mins });
    const hours = Math.round(mins / 60);
    if (hours < 24) return t('clinics.hoursAgo', { count: hours });
    return t('clinics.daysAgo', { count: Math.round(hours / 24) });
  };
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClinicStatus | 'all'>('all');
  const [planFilter, setPlanFilter] = useState<PlanKey | 'all'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'name' | 'lastActivity' | 'cases'>('lastActivity');

  const filtered = useMemo(() => {
    let rows = adminClinics.filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.city.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (planFilter !== 'all' && c.plan !== planFilter) return false;
      if (branchFilter !== 'all' && !c.branches.includes(branchFilter)) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'tr');
      if (sortKey === 'cases') return b.activeCases - a.activeCases;
      return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    });
    return rows;
  }, [search, statusFilter, planFilter, branchFilter, sortKey]);

  return (
    <div className="space-y-4">
      <AppMeta title={`${t('clinics.title')} | CareNova Platform`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t('clinics.title')}</h1>
          <p className="text-ink-muted text-sm mt-0.5">{t('clinics.subtitle', { filtered: filtered.length, total: adminClinics.length })}</p>
        </div>
        <div className="relative">
          <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('clinics.searchPlaceholder')}
            className="pl-9 pr-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink w-64 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ClinicStatus | 'all')} className="rounded-lg border border-line bg-surface text-sm text-ink px-3 py-1.5">
          <option value="all">{t('clinics.filterAllStatuses')}</option>
          {(['active', 'trial', 'onboarding', 'suspended'] as const).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as PlanKey | 'all')} className="rounded-lg border border-line bg-surface text-sm text-ink px-3 py-1.5">
          <option value="all">{t('clinics.filterAllPlans')}</option>
          {(['solo', 'klinik', 'grup'] as const).map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
        </select>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="rounded-lg border border-line bg-surface text-sm text-ink px-3 py-1.5">
          <option value="all">{t('clinics.filterAllBranches')}</option>
          {Object.entries(BRANCH_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} className="rounded-lg border border-line bg-surface text-sm text-ink px-3 py-1.5">
          <option value="lastActivity">{t('clinics.sortLastActivity')}</option>
          <option value="name">{t('clinics.sortName')}</option>
          <option value="cases">{t('clinics.sortCases')}</option>
        </select>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('clinics.columns.clinic')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('clinics.columns.city')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('clinics.columns.branches')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('clinics.columns.plan')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('clinics.columns.status')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle text-right">{t('clinics.columns.users')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle text-right">{t('clinics.columns.activeCases')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('clinics.columns.lastActivity')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.id} className={`border-b border-line last:border-0 hover:bg-surface-sunken ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                <td className="px-4 py-2.5">
                  <Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors">{c.name}</Link>
                </td>
                <td className="px-4 py-2.5 text-ink-muted">{c.city}</td>
                <td className="px-4 py-2.5 text-ink-muted">{c.branches.map(b => BRANCH_LABELS[b]).join(', ')}</td>
                <td className="px-4 py-2.5 text-ink-muted">{PLAN_LABELS[c.plan]}</td>
                <td className="px-4 py-2.5"><StatusBadge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</StatusBadge></td>
                <td className="px-4 py-2.5 text-right text-ink">{c.userCount}</td>
                <td className="px-4 py-2.5 text-right text-ink">{c.activeCases}</td>
                <td className="px-4 py-2.5 text-ink-subtle text-xs">{timeAgo(c.lastActivityAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ink-muted text-sm">{t('clinics.emptyFiltered')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

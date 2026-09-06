import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import AppMeta from '../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { cases, CaseStatus, CASE_STATUS_LABELS, DEMO_NOW_MS } from '../data/caseData';

// GECE-2-BRIEFI.md Bölüm D.2 — "CareNova'nın merkezi kavramı". Demo-only:
// reads static caseData.ts, no API calls (mirrors the admin console's own
// data-file pattern from Bölüm C, not the older api-backed pages in this
// same folder like PatientsListPage/AIActivityPage).

const STATUS_TONE: Record<CaseStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> = {
  new: 'neutral', qualified: 'accent', pre_assessment: 'warning', awaiting_doctor: 'warning',
  quoted: 'accent', awaiting_deposit: 'accent', reserved: 'success', travel_planned: 'success',
  arrived: 'success', treated: 'success', returned: 'success', in_aftercare: 'success',
  completed: 'success', lost: 'danger', medically_ineligible: 'danger',
};

const BRANCH_LABELS: Record<string, string> = {
  hair_transplant: 'Saç Ekimi', dental: 'Diş', aesthetic_surgery: 'Estetik Cerrahi',
  eye_lasik: 'Göz (Lasik)', bariatric: 'Bariatrik', ivf: 'Tüp Bebek', orthopedics: 'Ortopedi',
  cardiology: 'Kardiyoloji', oncology: 'Onkoloji', checkup: 'Check-up',
};

function timeAgo(iso: string): string {
  const mins = Math.round((DEMO_NOW_MS - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

export default function CasesPage() {
  const { t } = useTranslation('cases');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const branches = useMemo(() => Array.from(new Set(cases.map(c => c.branch))), []);

  const filtered = useMemo(() => {
    return cases
      .filter(c => {
        const q = search.trim().toLowerCase();
        if (q && !c.patientName.toLowerCase().includes(q) && !c.caseNumber.toLowerCase().includes(q)) return false;
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (branchFilter !== 'all' && c.branch !== branchFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }, [search, statusFilter, branchFilter]);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <AppMeta title={`${t('listTitle')} | CareNova`} />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">{t('listTitle')}</h1>
            <p className="text-ink-muted text-sm mt-0.5">{filtered.length} / {cases.length} {t('listSubtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder') ?? undefined}
                className="pl-9 pr-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink w-56 focus:outline-none focus:border-accent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CaseStatus | 'all')}
              className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink focus:outline-none focus:border-accent"
              aria-label={t('filterStatus') ?? undefined}
            >
              <option value="all">{t('allStatuses')}</option>
              {(Object.keys(CASE_STATUS_LABELS) as CaseStatus[]).map(s => (
                <option key={s} value={s}>{CASE_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink focus:outline-none focus:border-accent"
              aria-label={t('filterBranch') ?? undefined}
            >
              <option value="all">{t('allBranches')}</option>
              {branches.map(b => (
                <option key={b} value={b}>{BRANCH_LABELS[b] ?? b}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-subtle uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">{t('columns.patient')}</th>
                <th className="px-4 py-3 font-medium">{t('columns.branch')}</th>
                <th className="px-4 py-3 font-medium">{t('columns.status')}</th>
                <th className="px-4 py-3 font-medium">{t('columns.consultant')}</th>
                <th className="px-4 py-3 font-medium">{t('columns.value')}</th>
                <th className="px-4 py-3 font-medium">{t('columns.lastActivity')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-surface-sunken transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/cases/${c.id}`} className="flex items-center gap-2 font-medium text-ink hover:text-accent">
                      <span aria-hidden="true">{c.patientCountryFlag}</span>
                      {c.patientName}
                      <span className="text-ink-subtle font-normal text-xs">{c.caseNumber}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{BRANCH_LABELS[c.branch] ?? c.branch}</td>
                  <td className="px-4 py-3"><StatusBadge tone={STATUS_TONE[c.status]}>{CASE_STATUS_LABELS[c.status]}</StatusBadge></td>
                  <td className="px-4 py-3 text-ink-muted">{c.assignedConsultant ?? t('notAssigned')}</td>
                  <td className="px-4 py-3 text-ink-muted">€{c.estimatedValueEur.toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-3 text-ink-subtle">{timeAgo(c.lastActivityAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-subtle">{t('noResults')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

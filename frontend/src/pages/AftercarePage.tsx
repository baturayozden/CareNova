import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import AppMeta from '../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { cases, DEMO_NOW_MS, CaseFile } from '../data/caseData';
import { adminBranchTemplates } from '../data/adminBranchTemplates';
import { BRANCH_LABELS } from '../lib/caseDisplay';
import DemoName from '../components/DemoName';

// APP-ADMIN-EKSIKLER-KOMUTU.md Görev 2 — one row per case that has reached
// treatment (aftercare tracking only makes sense once there's something to
// follow up on). "Sıradaki temas" is derived from the branch template's
// real aftercareSchedule (adminBranchTemplates.ts), per the brief's own
// instruction ("elle gün sayısı uydurma") — not invented per-case.

const AFTERCARE_STATUSES = new Set(['treated', 'returned', 'in_aftercare', 'completed']);
const scheduleByBranch = new Map(adminBranchTemplates.map(b => [b.key, b.aftercareSchedule]));

function parseScheduleDays(schedule: string | undefined): number[] {
  if (!schedule) return [];
  return Array.from(schedule.matchAll(/D\+(\d+)/g)).map(m => Number(m[1]));
}

function treatedAt(c: CaseFile): string | null {
  const entry = [...c.timeline].reverse().find(t => t.status === 'treated');
  return entry?.at ?? null;
}

type AftercareStatus = 'notStarted' | 'dueNow' | 'upToDate' | 'complete';

function analyzeAftercare(c: CaseFile): {
  treatedDate: string | null; daysPostOp: number | null;
  lastContact: { day: string; at: string } | null; nextDue: number | null; status: AftercareStatus;
} {
  const treated = treatedAt(c);
  const daysPostOp = treated ? Math.floor((DEMO_NOW_MS - new Date(treated).getTime()) / 86400000) : null;
  const scheduleDays = parseScheduleDays(scheduleByBranch.get(c.branch));

  const contactedDays = new Set(
    c.aftercare.filter(a => a.contactedAt).map(a => Number(a.day.replace('D+', ''))),
  );
  const lastContactedEntry = [...c.aftercare]
    .filter(a => a.contactedAt)
    .sort((a, b) => Number(a.day.replace('D+', '')) - Number(b.day.replace('D+', ''))).pop();

  const nextDue = scheduleDays.find(d => !contactedDays.has(d)) ?? null;

  let status: AftercareStatus = 'notStarted';
  if (daysPostOp == null) status = 'notStarted';
  else if (nextDue == null && scheduleDays.length > 0) status = 'complete';
  else if (nextDue != null && nextDue <= daysPostOp) status = 'dueNow';
  else status = 'upToDate';

  return {
    treatedDate: treated,
    daysPostOp,
    lastContact: lastContactedEntry ? { day: lastContactedEntry.day, at: lastContactedEntry.contactedAt as string } : null,
    nextDue,
    status,
  };
}

const STATUS_TONE: Record<AftercareStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> = {
  notStarted: 'neutral', dueNow: 'warning', upToDate: 'success', complete: 'accent',
};

export default function AftercarePage() {
  const { t } = useTranslation('cases');
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');

  const rows = useMemo(() => cases.filter(c => AFTERCARE_STATUSES.has(c.status)), []);
  const branches = useMemo(() => Array.from(new Set(rows.map(r => r.branch))), [rows]);

  const analyzed = useMemo(() => {
    return rows
      .map(c => ({ c, a: analyzeAftercare(c) }))
      .filter(({ c }) => {
        const q = search.trim().toLowerCase();
        if (q && !c.patientName.toLowerCase().includes(q) && !c.caseNumber.toLowerCase().includes(q)) return false;
        if (branchFilter !== 'all' && c.branch !== branchFilter) return false;
        return true;
      })
      // Due-now cases surface first — that's the actionable subset.
      .sort((x, y) => {
        const order: Record<AftercareStatus, number> = { dueNow: 0, upToDate: 1, notStarted: 2, complete: 3 };
        return order[x.a.status] - order[y.a.status];
      });
  }, [rows, search, branchFilter]);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <AppMeta title={`${t('aftercareList.title')} | CareNova`} />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">{t('aftercareList.title')}</h1>
            <p className="text-ink-muted text-sm mt-0.5">{analyzed.length} / {rows.length} {t('aftercareList.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('aftercareList.searchPlaceholder') ?? undefined}
                className="pl-9 pr-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink w-56 focus:outline-none focus:border-accent"
              />
            </div>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink focus:outline-none focus:border-accent">
              <option value="all">{t('aftercareList.allBranches')}</option>
              {branches.map(b => <option key={b} value={b}>{BRANCH_LABELS[b] ?? b}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-subtle uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">{t('aftercareList.columns.patient')}</th>
                <th className="px-4 py-3 font-medium">{t('aftercareList.columns.treatedDate')}</th>
                <th className="px-4 py-3 font-medium">{t('aftercareList.columns.dayPostOp')}</th>
                <th className="px-4 py-3 font-medium">{t('aftercareList.columns.nextContact')}</th>
                <th className="px-4 py-3 font-medium">{t('aftercareList.columns.lastContact')}</th>
                <th className="px-4 py-3 font-medium">{t('aftercareList.columns.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {analyzed.map(({ c, a }) => (
                <tr key={c.id} className="hover:bg-surface-sunken transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/cases/${c.id}?tab=aftercare`} className="flex items-center gap-2 font-medium text-ink hover:text-accent">
                      <span aria-hidden="true">{c.patientCountryFlag}</span>
                      <DemoName>{c.patientName}</DemoName>
                      <span className="text-ink-subtle font-normal text-xs">{c.caseNumber}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {a.treatedDate ? new Date(a.treatedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{a.daysPostOp != null ? `D+${a.daysPostOp}` : '—'}</td>
                  <td className="px-4 py-3 text-ink-muted">{a.nextDue != null ? `D+${a.nextDue}` : t('aftercareList.scheduleComplete')}</td>
                  <td className="px-4 py-3 text-ink-subtle">
                    {a.lastContact
                      ? `${a.lastContact.day} — ${new Date(a.lastContact.at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`
                      : t('aftercareList.noContactYet')}
                  </td>
                  <td className="px-4 py-3"><StatusBadge tone={STATUS_TONE[a.status]}>{t(`aftercareList.status.${a.status}`)}</StatusBadge></td>
                </tr>
              ))}
              {analyzed.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-subtle">{t('aftercareList.noResults')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

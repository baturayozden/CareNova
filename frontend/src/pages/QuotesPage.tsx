import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import AppMeta from '../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { cases, caseConsultants, DEMO_NOW_MS } from '../data/caseData';
import { BRANCH_LABELS } from '../lib/caseDisplay';
import DemoName, { useDemoNameText } from '../components/DemoName';

// APP-ADMIN-EKSIKLER-KOMUTU.md Görev 2 — same pattern as CasesPage.tsx
// (static caseData.ts, no API call, Klinik Beyazı design tokens). Every
// case with at least one quote gets one row, showing its latest version.

type QuoteStatus = 'draft' | 'locked' | 'accepted' | 'expired';

const ACCEPTED_STATUSES = new Set([
  'awaiting_deposit', 'reserved', 'travel_planned', 'arrived', 'treated', 'returned', 'in_aftercare', 'completed',
]);

const STATUS_TONE: Record<QuoteStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> = {
  draft: 'neutral', locked: 'accent', accepted: 'success', expired: 'danger',
};

interface QuoteRow {
  caseId: string;
  caseNumber: string;
  patientName: string;
  patientCountryFlag: string;
  branch: string;
  consultant: string | null;
  version: number;
  amountEur: number;
  locked: boolean;
  validUntil: string | null;
  status: QuoteStatus;
}

function deriveStatus(locked: boolean, validUntil: string | null, caseStatus: string): QuoteStatus {
  if (!locked) return 'draft';
  if (validUntil && new Date(validUntil).getTime() < DEMO_NOW_MS) return 'expired';
  if (ACCEPTED_STATUSES.has(caseStatus)) return 'accepted';
  return 'locked';
}

export default function QuotesPage() {
  const { t } = useTranslation('cases');
  const demoNameText = useDemoNameText();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [consultantFilter, setConsultantFilter] = useState('all');

  const rows: QuoteRow[] = useMemo(() => {
    return cases
      .filter(c => c.quotes.length > 0)
      .map(c => {
        const latest = c.quotes[c.quotes.length - 1];
        return {
          caseId: c.id,
          caseNumber: c.caseNumber,
          patientName: c.patientName,
          patientCountryFlag: c.patientCountryFlag,
          branch: c.branch,
          consultant: c.assignedConsultant,
          version: latest.version,
          amountEur: latest.amountEur,
          locked: latest.locked,
          validUntil: latest.validUntil ?? null,
          status: deriveStatus(latest.locked, latest.validUntil ?? null, c.status),
        };
      });
  }, []);

  const branches = useMemo(() => Array.from(new Set(rows.map(r => r.branch))), [rows]);

  const filtered = useMemo(() => {
    return rows
      .filter(r => {
        const q = search.trim().toLowerCase();
        if (q && !r.patientName.toLowerCase().includes(q) && !r.caseNumber.toLowerCase().includes(q)) return false;
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (branchFilter !== 'all' && r.branch !== branchFilter) return false;
        if (consultantFilter !== 'all' && r.consultant !== consultantFilter) return false;
        return true;
      })
      // Expiring-soonest first (undefined validUntil sorts last), so a
      // consultant sees what needs following up on without hunting for it —
      // Dashboard's own "Aksiyon gerektirenler" card already flags these
      // same cases as "Teklifin süresi dolmak üzere".
      .sort((a, b) => {
        if (a.validUntil && b.validUntil) return new Date(a.validUntil).getTime() - new Date(b.validUntil).getTime();
        if (a.validUntil) return -1;
        if (b.validUntil) return 1;
        return 0;
      });
  }, [rows, search, statusFilter, branchFilter, consultantFilter]);

  function isExpiringSoon(r: QuoteRow): boolean {
    if (!r.validUntil || r.status === 'expired' || r.status === 'accepted') return false;
    const hoursLeft = (new Date(r.validUntil).getTime() - DEMO_NOW_MS) / 3600000;
    return hoursLeft >= 0 && hoursLeft <= 72;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <AppMeta title={`${t('quotesList.title')} | CareNova`} />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">{t('quotesList.title')}</h1>
            <p className="text-ink-muted text-sm mt-0.5">{filtered.length} / {rows.length} {t('quotesList.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('quotesList.searchPlaceholder') ?? undefined}
                className="pl-9 pr-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink w-56 focus:outline-none focus:border-accent"
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as QuoteStatus | 'all')}
              className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink focus:outline-none focus:border-accent">
              <option value="all">{t('quotesList.allStatuses')}</option>
              {(['draft', 'locked', 'accepted', 'expired'] as QuoteStatus[]).map(s => (
                <option key={s} value={s}>{t(`quotesList.status.${s}`)}</option>
              ))}
            </select>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink focus:outline-none focus:border-accent">
              <option value="all">{t('quotesList.allBranches')}</option>
              {branches.map(b => <option key={b} value={b}>{BRANCH_LABELS[b] ?? b}</option>)}
            </select>
            <select value={consultantFilter} onChange={(e) => setConsultantFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink focus:outline-none focus:border-accent">
              <option value="all">{t('quotesList.allConsultants')}</option>
              {caseConsultants.map(c => <option key={c.id} value={c.name}>{demoNameText(c.name)}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-subtle uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">{t('quotesList.columns.patient')}</th>
                <th className="px-4 py-3 font-medium">{t('quotesList.columns.branch')}</th>
                <th className="px-4 py-3 font-medium">{t('quotesList.columns.version')}</th>
                <th className="px-4 py-3 font-medium">{t('quotesList.columns.amount')}</th>
                <th className="px-4 py-3 font-medium">{t('quotesList.columns.status')}</th>
                <th className="px-4 py-3 font-medium">{t('quotesList.columns.validUntil')}</th>
                <th className="px-4 py-3 font-medium">{t('quotesList.columns.consultant')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map(r => (
                <tr key={r.caseId} className="hover:bg-surface-sunken transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/cases/${r.caseId}`} className="flex items-center gap-2 font-medium text-ink hover:text-accent">
                      <span aria-hidden="true">{r.patientCountryFlag}</span>
                      <DemoName>{r.patientName}</DemoName>
                      <span className="text-ink-subtle font-normal text-xs">{r.caseNumber}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{BRANCH_LABELS[r.branch] ?? r.branch}</td>
                  <td className="px-4 py-3 text-ink-muted">v{r.version}</td>
                  <td className="px-4 py-3 text-ink-muted">€{r.amountEur.toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge tone={STATUS_TONE[r.status]}>{t(`quotesList.status.${r.status}`)}</StatusBadge>
                      {isExpiringSoon(r) && <StatusBadge tone="warning">{t('quotesList.expiringSoon')}</StatusBadge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-subtle">
                    {r.validUntil ? new Date(r.validUntil).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : t('quotesList.noExpiry')}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{r.consultant ? <DemoName>{r.consultant}</DemoName> : t('notAssigned')}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-subtle">{t('quotesList.noResults')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

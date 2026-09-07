import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import AppMeta from '../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { cases } from '../data/caseData';
import { BRANCH_LABELS, timeAgo } from '../lib/caseDisplay';

// APP-ADMIN-EKSIKLER-KOMUTU.md Görev 2 — one row per case that has a travel
// plan. Honest limitation, noted rather than papered over: caseData.ts's
// `travel` field carries free-text status strings ("IST 14 Eylül 09:20
// varış", "Varış tamamlandı") and day-LABEL itineraries ("Gün 1"), not
// structured arrival/departure dates — so this sorts by last activity
// (most recently updated travel status first) rather than a fabricated
// arrival date, and skips the brief's "highlight today's arrivals" bit for
// the same reason (no real date to compare against). Only 3 of 18 demo
// cases currently have a travel plan at all — this table is a real, if
// currently short, reflection of that, not artificially padded.

export default function TravelPage() {
  const { t } = useTranslation('cases');
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');

  const rows = useMemo(() => cases.filter(c => c.travel !== null), []);
  const branches = useMemo(() => Array.from(new Set(rows.map(r => r.branch))), [rows]);

  const filtered = useMemo(() => {
    return rows
      .filter(c => {
        const q = search.trim().toLowerCase();
        if (q && !c.patientName.toLowerCase().includes(q) && !c.caseNumber.toLowerCase().includes(q)) return false;
        if (branchFilter !== 'all' && c.branch !== branchFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }, [rows, search, branchFilter]);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <AppMeta title={`${t('travelList.title')} | CareNova`} />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">{t('travelList.title')}</h1>
            <p className="text-ink-muted text-sm mt-0.5">{filtered.length} / {rows.length} {t('travelList.subtitle')}</p>
            <p className="text-ink-subtle text-xs mt-1">{t('travelList.onlyPlanned', { count: rows.length, total: cases.length })}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={16} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('travelList.searchPlaceholder') ?? undefined}
                className="pl-9 pr-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink w-56 focus:outline-none focus:border-accent"
              />
            </div>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-line bg-surface text-sm text-ink focus:outline-none focus:border-accent">
              <option value="all">{t('travelList.allBranches')}</option>
              {branches.map(b => <option key={b} value={b}>{BRANCH_LABELS[b] ?? b}</option>)}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-subtle uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">{t('travelList.columns.patient')}</th>
                <th className="px-4 py-3 font-medium">{t('travelList.columns.flight')}</th>
                <th className="px-4 py-3 font-medium">{t('travelList.columns.hotel')}</th>
                <th className="px-4 py-3 font-medium">{t('travelList.columns.transfer')}</th>
                <th className="px-4 py-3 font-medium">{t('travelList.columns.companions')}</th>
                <th className="px-4 py-3 font-medium">{t('travelList.columns.coordinator')}</th>
                <th className="px-4 py-3 font-medium">{t('travelList.columns.lastUpdate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-surface-sunken transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/cases/${c.id}?tab=travel`} className="flex items-center gap-2 font-medium text-ink hover:text-accent">
                      <span aria-hidden="true">{c.patientCountryFlag}</span>
                      {c.patientName}
                      <span className="text-ink-subtle font-normal text-xs">{c.caseNumber}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={c.travel!.flight.toLowerCase().includes('tamamlandı') ? 'success' : 'accent'}>{c.travel!.flight}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{c.travel!.hotel}</td>
                  <td className="px-4 py-3 text-ink-muted">{c.travel!.transfer}</td>
                  <td className="px-4 py-3 text-ink-muted">{c.companions.length}</td>
                  <td className="px-4 py-3 text-ink-muted">{c.assignedCoordinator ?? t('notAssigned')}</td>
                  <td className="px-4 py-3 text-ink-subtle">{timeAgo(c.lastActivityAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-subtle">{t('travelList.noResults')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

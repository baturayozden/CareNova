import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppMeta from '../components/AppMeta';
import { cases, caseConsultants, CaseStatus, DEMO_NOW_MS } from '../data/caseData';
import { BRANCH_LABELS, averageFirstResponseMinutes } from '../lib/caseDisplay';

// APP-ADMIN-EKSIKLER-KOMUTU.md Görev 2 — the weekly-summary report a
// klinik_sahibi checks. Reuses averageFirstResponseMinutes (moved out of
// Dashboard.tsx into lib/caseDisplay.ts for exactly this — "zaten var,
// yeniden yazma, ortak bir yardımcıya çıkar") so this shows the SAME
// first-response figure the Dashboard KPI does, not a second calculation
// that could quietly drift from it.

type Period = 'this_week' | 'this_month' | 'last_90';

function periodStart(period: Period): Date {
  const now = new Date(DEMO_NOW_MS);
  if (period === 'this_week') {
    const diff = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }
  if (period === 'this_month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(DEMO_NOW_MS - 90 * 86400000);
}

// Cases genuinely still moving through the pipeline, in real progression
// order — lost/medically_ineligible are exits, counted separately in Loss
// Reasons rather than distorting funnel counts at whichever stage they
// were still at.
const FUNNEL_ORDER: CaseStatus[] = [
  'new', 'qualified', 'pre_assessment', 'awaiting_doctor', 'quoted', 'awaiting_deposit',
  'reserved', 'travel_planned', 'arrived', 'treated', 'returned', 'in_aftercare', 'completed',
];
const FUNNEL_STAGES: CaseStatus[] = ['new', 'qualified', 'awaiting_doctor', 'quoted', 'awaiting_deposit', 'arrived', 'completed'];

export default function ReportsPage() {
  const { t } = useTranslation('cases');
  const [period, setPeriod] = useState<Period>('this_month');

  const periodCases = useMemo(() => {
    const start = periodStart(period).getTime();
    return cases.filter(c => {
      const createdAt = c.timeline[0]?.at ?? c.lastActivityAt;
      return new Date(createdAt).getTime() >= start;
    });
  }, [period]);

  const activeCases = useMemo(() => periodCases.filter(c => FUNNEL_ORDER.includes(c.status)), [periodCases]);
  const lostCases = useMemo(() => periodCases.filter(c => c.status === 'lost' || c.status === 'medically_ineligible'), [periodCases]);

  const funnel = useMemo(() => FUNNEL_STAGES.map(stage => {
    const stageIdx = FUNNEL_ORDER.indexOf(stage);
    const count = activeCases.filter(c => FUNNEL_ORDER.indexOf(c.status) >= stageIdx).length;
    return { stage, count };
  }), [activeCases]);
  const funnelMax = Math.max(1, ...funnel.map(f => f.count));

  const byBranch = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const c of periodCases) {
      const entry = map.get(c.branch) ?? { count: 0, value: 0 };
      entry.count += 1;
      entry.value += c.estimatedValueEur;
      map.set(c.branch, entry);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [periodCases]);

  const byConsultant = useMemo(() => {
    return caseConsultants.map(consultant => {
      const theirCases = periodCases.filter(c => c.assignedConsultant === consultant.name);
      return {
        name: consultant.name,
        count: theirCases.length,
        value: theirCases.reduce((s, c) => s + c.estimatedValueEur, 0),
        avgResponse: averageFirstResponseMinutes(theirCases),
      };
    }).filter(c => c.count > 0).sort((a, b) => b.value - a.value);
  }, [periodCases]);

  const avgResponse = useMemo(() => averageFirstResponseMinutes(periodCases), [periodCases]);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <AppMeta title={`${t('reportsPage.title')} | CareNova`} />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">{t('reportsPage.title')}</h1>
            <p className="text-ink-muted text-sm mt-0.5">{t('reportsPage.subtitle')}</p>
          </div>
          <div className="flex gap-1">
            {(['this_week', 'this_month', 'last_90'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  period === p ? 'bg-accent text-white border-accent' : 'border-line text-ink-muted hover:text-ink'
                }`}>
                {t(`reportsPage.periods.${p}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Avg first response — same figure as the Dashboard KPI */}
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-ink-subtle text-xs uppercase tracking-wide mb-1">{t('reportsPage.avgResponseTime.title')}</p>
          <p className="text-2xl font-semibold text-ink">{avgResponse != null ? `${avgResponse} dk` : '—'}</p>
        </div>

        {/* Funnel */}
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-ink font-medium text-sm mb-4">{t('reportsPage.funnel.title')}</p>
          <div className="space-y-2.5">
            {funnel.map(f => (
              <div key={f.stage} className="flex items-center gap-3">
                <span className="text-ink-muted text-xs w-32 shrink-0">{t(`reportsPage.funnel.${f.stage}`)}</span>
                <div className="flex-1 h-5 bg-surface-sunken rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(f.count / funnelMax) * 100}%` }} />
                </div>
                <span className="text-ink text-sm font-medium w-8 text-right">{f.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Branch breakdown */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="text-ink font-medium text-sm mb-4">{t('reportsPage.byBranch.title')}</p>
            <div className="space-y-3">
              {byBranch.map(([branch, d]) => (
                <div key={branch} className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">{BRANCH_LABELS[branch] ?? branch}</span>
                  <span className="text-ink">
                    {d.count} {t('reportsPage.byBranch.cases')} · €{d.value.toLocaleString('tr-TR')} {t('reportsPage.byBranch.value')}
                  </span>
                </div>
              ))}
              {byBranch.length === 0 && <p className="text-ink-subtle text-sm">—</p>}
            </div>
          </div>

          {/* Loss reasons */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="text-ink font-medium text-sm mb-4">{t('reportsPage.lossReasons.title')}</p>
            {lostCases.length === 0 ? (
              <p className="text-ink-subtle text-sm">{t('reportsPage.lossReasons.empty')}</p>
            ) : (
              <div className="space-y-3">
                {(['lost', 'medically_ineligible'] as const).map(reason => {
                  const count = lostCases.filter(c => c.status === reason).length;
                  if (count === 0) return null;
                  return (
                    <div key={reason} className="flex items-center justify-between text-sm">
                      <span className="text-ink-muted">{t(`reportsPage.lossReasons.${reason}`)}</span>
                      <span className="text-ink font-medium">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Consultant performance */}
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <div className="px-5 py-4 border-b border-line">
            <p className="text-ink font-medium text-sm">{t('reportsPage.byConsultant.title')}</p>
          </div>
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-subtle uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">{t('reportsPage.byConsultant.columns.consultant')}</th>
                <th className="px-5 py-3 font-medium">{t('reportsPage.byConsultant.columns.cases')}</th>
                <th className="px-5 py-3 font-medium">{t('reportsPage.byConsultant.columns.value')}</th>
                <th className="px-5 py-3 font-medium">{t('reportsPage.byConsultant.columns.avgResponse')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {byConsultant.map(c => (
                <tr key={c.name}>
                  <td className="px-5 py-3 text-ink font-medium">{c.name}</td>
                  <td className="px-5 py-3 text-ink-muted">{c.count}</td>
                  <td className="px-5 py-3 text-ink-muted">€{c.value.toLocaleString('tr-TR')}</td>
                  <td className="px-5 py-3 text-ink-muted">{c.avgResponse != null ? `${c.avgResponse} dk` : '—'}</td>
                </tr>
              ))}
              {byConsultant.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-ink-subtle">—</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

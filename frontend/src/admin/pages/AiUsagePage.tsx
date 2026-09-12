import React from 'react';
import DemoName from '../../components/DemoName';
import { Link } from 'react-router-dom';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat } from '../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../components/QueryState';
import type { AdminClinic, AiPricing, DemoRealAmount, DemoSplit } from '../types';

interface AiUsageResponse {
  counts: DemoSplit;
  clinics: Array<Pick<AdminClinic, 'id' | 'isDemo' | 'name' | 'aiUsage'>>;
  totals: { costUsdThisMonth: DemoRealAmount };
  pricing: AiPricing;
}

const th = 'px-4 py-2.5 font-medium text-ink-subtle';
const POLICY_TONE = { block: 'neutral', notify: 'warning', allow: 'accent' } as const;

export default function AiUsagePage() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const query = usePlatformQuery<AiUsageResponse>('/api/admin/platform/ai-usage');
  const pct = (c: AiUsageResponse['clinics'][number]) => (c.aiUsage.monthlyQuota > 0 ? c.aiUsage.usedThisMonth / c.aiUsage.monthlyQuota : 0);
  const rows = [...(query.data?.clinics ?? [])].sort((a, b) => pct(b) - pct(a));
  const totals = query.data?.totals.costUsdThisMonth;

  return (
    <div className="space-y-4">
      <AppMeta title={`${t('aiUsage.title')} | CareNova Platform`} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t('aiUsage.title')}</h1>
          <p className="text-ink-muted text-sm mt-0.5">{t('aiUsage.subtitle')}</p>
        </div>
        {totals && (
          <div className="rounded-xl border border-line bg-surface px-4 py-2.5">
            <p className="text-xs text-ink-subtle">{t('aiUsage.totalCostLabel')}</p>
            <p className="font-display text-xl text-ink">{fmt.usd(totals.demo + totals.real)}</p>
            <p className="text-xs text-ink-muted">{t('overview.splitEur', { demo: fmt.usd(totals.demo), real: fmt.usd(totals.real) })}</p>
          </div>
        )}
      </div>

      {query.loading ? <LoadingState />
        : query.error || !query.data ? <ErrorState error={query.error} onRetry={query.reload} />
          : rows.length === 0 ? <EmptyState title={t('clinics.emptyTitle')} body={t('clinics.emptyBody')} />
            : (
              <>
                <div className="rounded-xl border border-line bg-surface overflow-x-auto">
                  <table className="w-full text-sm min-w-[860px]">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th scope="col" className={th}>{t('aiUsage.columns.clinic')}</th>
                        <th scope="col" className={th}>{t('aiUsage.columns.quota')}</th>
                        <th scope="col" className={th}>{t('aiUsage.columns.usage')}</th>
                        <th scope="col" className={th}>{t('aiUsage.columns.overagePolicy')}</th>
                        <th scope="col" className={`${th} text-right`}>{t('aiUsage.columns.tokens')}</th>
                        <th scope="col" className={`${th} text-right`}>{t('aiUsage.columns.estimatedCost')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c, i) => {
                        const p = Math.round(pct(c) * 100);
                        const warn = p >= 85;
                        return (
                          <tr key={c.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                            <td className="px-4 py-2.5"><Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors"><DemoName when={c.isDemo}>{c.name}</DemoName></Link></td>
                            <td className="px-4 py-2.5 text-ink-muted">{fmt.num(c.aiUsage.monthlyQuota)}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-1.5 rounded-full bg-surface-sunken overflow-hidden" aria-hidden="true">
                                  <div className={`h-full rounded-full ${warn ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${Math.min(p, 100)}%` }} />
                                </div>
                                <span className={`text-xs ${warn ? 'text-warning font-medium' : 'text-ink-muted'}`}>{fmt.num(c.aiUsage.usedThisMonth)} · {fmt.pct(p)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <StatusBadge tone={POLICY_TONE[c.aiUsage.overagePolicy]}>{t(`aiUsage.policy.${c.aiUsage.overagePolicy}`)}</StatusBadge>
                            </td>
                            <td className="px-4 py-2.5 text-right text-ink-muted text-xs whitespace-nowrap">
                              {t('aiUsage.tokensValue', { input: fmt.num(c.aiUsage.promptTokensThisMonth), output: fmt.num(c.aiUsage.completionTokensThisMonth) })}
                            </td>
                            <td className="px-4 py-2.5 text-right text-ink">{fmt.usd(c.aiUsage.costUsdThisMonth)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-ink-subtle">
                  {t('aiUsage.formula', { model: query.data.pricing.model, input: query.data.pricing.inputUsdPerMTok, output: query.data.pricing.outputUsdPerMTok })}
                </p>
              </>
            )}
    </div>
  );
}

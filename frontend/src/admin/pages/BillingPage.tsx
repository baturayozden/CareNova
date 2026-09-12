import React from 'react';
import DemoName from '../../components/DemoName';
import { Link } from 'react-router-dom';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat } from '../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../components/QueryState';
import type { AdminClinic, DemoRealAmount, DemoSplit, DerivationBasis } from '../types';

interface BillingResponse {
  counts: DemoSplit;
  clinics: Array<Pick<AdminClinic, 'id' | 'isDemo' | 'name' | 'plan' | 'mrrEur' | 'billing'>>;
  totals: { mrrEur: DemoRealAmount };
  basis: DerivationBasis;
}

const th = 'px-4 py-2.5 font-medium text-ink-subtle';

export default function BillingPage() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const query = usePlatformQuery<BillingResponse>('/api/admin/platform/billing');

  const header = (
    <div>
      <AppMeta title={`${t('billing.title')} | CareNova Platform`} />
      <h1 className="text-xl font-semibold text-ink">{t('billing.title')}</h1>
      <p className="text-ink-muted text-sm mt-0.5">{t('billing.subtitle')}</p>
    </div>
  );

  if (query.loading) return <div className="space-y-4">{header}<LoadingState /></div>;
  if (query.error || !query.data) return <div className="space-y-4">{header}<ErrorState error={query.error} onRetry={query.reload} /></div>;

  const { clinics, totals, basis } = query.data;
  const mrr = totals.mrrEur.demo + totals.mrrEur.real;
  const rank = (c: BillingResponse['clinics'][number]) => (c.billing?.status === 'overdue' ? 0 : c.billing ? 1 : 2);
  const rows = [...clinics].sort((a, b) => rank(a) - rank(b));

  return (
    <div className="space-y-4">
      {header}

      <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-ink-subtle uppercase tracking-wide mb-1">{t('billing.mrr')}</p>
          <p className="font-display text-2xl text-ink">{fmt.eur(mrr)}</p>
          <p className="text-xs text-ink-muted">{t('overview.splitEur', { demo: fmt.eur(totals.mrrEur.demo), real: fmt.eur(totals.mrrEur.real) })}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-ink-subtle uppercase tracking-wide mb-1">{t('billing.arr')}</p>
          <p className="font-display text-2xl text-ink">{fmt.eur(mrr * 12)}</p>
          <p className="text-xs text-ink-muted">{t('overview.splitEur', { demo: fmt.eur(totals.mrrEur.demo * 12), real: fmt.eur(totals.mrrEur.real * 12) })}</p>
        </div>
      </div>

      {rows.length === 0 ? <EmptyState title={t('clinics.emptyTitle')} body={t('clinics.emptyBody')} /> : (
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className={th}>{t('billing.columns.clinic')}</th>
                <th scope="col" className={th}>{t('billing.columns.plan')}</th>
                <th scope="col" className={th}>{t('billing.columns.period')}</th>
                <th scope="col" className={`${th} text-right`}>{t('billing.columns.amount')}</th>
                <th scope="col" className={th}>{t('billing.columns.status')}</th>
                <th scope="col" className={th}>{t('billing.columns.nextCharge')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={c.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                  <td className="px-4 py-2.5"><Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors"><DemoName when={c.isDemo}>{c.name}</DemoName></Link></td>
                  <td className="px-4 py-2.5 text-ink-muted">{fmt.plan(c.plan)}</td>
                  {c.billing ? (
                    <>
                      <td className="px-4 py-2.5 text-ink-muted">{t(`billing.${c.billing.periodicity}`)}</td>
                      <td className="px-4 py-2.5 text-right text-ink whitespace-nowrap">{t('billing.perMonth', { amount: fmt.eur(c.billing.amountEur) })}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge tone={c.billing.status === 'current' ? 'success' : c.billing.status === 'overdue' ? 'danger' : 'warning'}>{t(`billing.${c.billing.status}`)}</StatusBadge>
                      </td>
                      <td className="px-4 py-2.5 text-ink-subtle text-xs">{fmt.date(c.billing.nextChargeAt)}</td>
                    </>
                  ) : (
                    <td colSpan={4} className="px-4 py-2.5 text-ink-subtle text-xs">{t('billing.noSubscription')}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-ink-subtle">{t('billing.basisNote', { solo: basis.planPriceEur.solo, klinik: basis.planPriceEur.klinik, grup: basis.planPriceEur.grup })}</p>
    </div>
  );
}

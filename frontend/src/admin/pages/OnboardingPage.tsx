import React from 'react';
import DemoName from '../../components/DemoName';
import { Link } from 'react-router-dom';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat } from '../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../components/QueryState';
import type { AdminClinic, DerivationBasis, DemoSplit } from '../types';

type Row = Pick<AdminClinic, 'id' | 'isDemo' | 'name' | 'status' | 'onboarding'>;
const th = 'px-4 py-2.5 font-medium text-ink-subtle';
const IN_PROGRESS_STEPS = [0, 1, 2, 3, 4, 5, 6];

export default function OnboardingPage() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const query = usePlatformQuery<{ counts: DemoSplit; clinics: Row[]; basis: DerivationBasis }>('/api/admin/platform/onboarding');

  const header = (
    <div>
      <AppMeta title={`${t('onboarding.title')} | CareNova Platform`} />
      <h1 className="text-xl font-semibold text-ink">{t('onboarding.title')}</h1>
      {query.data && (
        <p className="text-ink-muted text-sm mt-0.5">
          {t('onboarding.subtitle', {
            live: query.data.clinics.filter(c => c.onboarding.step >= 7).length,
            inProgress: query.data.clinics.filter(c => c.onboarding.step < 7).length,
          })}
        </p>
      )}
    </div>
  );

  if (query.loading) return <div className="space-y-5">{header}<LoadingState /></div>;
  if (query.error || !query.data) return <div className="space-y-5">{header}<ErrorState error={query.error} onRetry={query.reload} /></div>;

  const { clinics, basis } = query.data;
  if (clinics.length === 0) return <div className="space-y-5">{header}<EmptyState title={t('clinics.emptyTitle')} body={t('clinics.emptyBody')} /></div>;

  const inProgress = clinics.filter(c => c.onboarding.step < 7);
  const live = clinics.length - inProgress.length;

  return (
    <div className="space-y-5">
      {header}

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {[...IN_PROGRESS_STEPS, 7].map(step => {
            const count = step === 7 ? live : inProgress.filter(c => c.onboarding.step === step).length;
            return (
              <div key={step} className="text-center">
                <div className={`h-16 rounded-lg flex items-end justify-center pb-1 ${count > 0 ? 'bg-accent-soft' : 'bg-surface-sunken'}`}>
                  <span className={`text-lg font-semibold ${count > 0 ? 'text-accent' : 'text-ink-subtle'}`}>{count}</span>
                </div>
                <p className="text-[11px] text-ink-subtle mt-1 leading-tight">{fmt.onboardingStep(step)}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className={th}>{t('onboarding.columns.clinic')}</th>
              <th scope="col" className={th}>{t('onboarding.columns.step')}</th>
              <th scope="col" className={th}>{t('onboarding.columns.timeInStep')}</th>
              <th scope="col" className={th}>{t('onboarding.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {inProgress.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-muted text-sm">{t('onboarding.emptyFunnel')}</td></tr>
            ) : inProgress.map(c => {
              const days = fmt.daysSince(c.onboarding.stepStartedAt);
              return (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5"><Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors"><DemoName when={c.isDemo}>{c.name}</DemoName></Link></td>
                  <td className="px-4 py-2.5 text-ink-muted">{fmt.onboardingStep(c.onboarding.step)}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{days === null ? '—' : t('onboarding.daysInStep', { count: days })}</td>
                  <td className="px-4 py-2.5">
                    {c.onboarding.stuck ? <StatusBadge tone="danger">{t('onboarding.stuck')}</StatusBadge> : <StatusBadge tone="neutral">{t('onboarding.inProgress')}</StatusBadge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-subtle">{t('onboarding.stuckRule', { days: basis.stuckAfterDays })}</p>
    </div>
  );
}

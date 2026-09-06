import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { adminClinics, ONBOARDING_STEPS, DEMO_NOW_MS } from '../../data/adminDemoData';

function daysSince(iso: string): number {
  return Math.floor((DEMO_NOW_MS - new Date(iso).getTime()) / 86400000);
}

export default function OnboardingPage() {
  const { t } = useTranslation('admin');
  const inProgress = adminClinics.filter(c => c.onboarding.step < 7);
  const live = adminClinics.filter(c => c.onboarding.step === 7);

  return (
    <div className="space-y-5">
      <AppMeta title={`${t('onboarding.title')} | CareNova Platform`} />
      <div>
        <h1 className="text-xl font-semibold text-ink">{t('onboarding.title')}</h1>
        <p className="text-ink-muted text-sm mt-0.5">
          {t('onboarding.subtitle', { live: live.length, inProgress: inProgress.length })}
        </p>
      </div>

      {/* Funnel — 7 steps, count per step */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {ONBOARDING_STEPS.map((label, i) => {
            const count = inProgress.filter(c => c.onboarding.step === i).length;
            return (
              <div key={label} className="text-center">
                <div className={`h-16 rounded-lg flex items-end justify-center pb-1 ${count > 0 ? 'bg-accent-soft' : 'bg-surface-sunken'}`}>
                  <span className={`text-lg font-semibold ${count > 0 ? 'text-accent' : 'text-ink-subtle'}`}>{count}</span>
                </div>
                <p className="text-[10px] text-ink-subtle mt-1 leading-tight">{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('onboarding.columns.clinic')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('onboarding.columns.step')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('onboarding.columns.timeInStep')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('onboarding.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {inProgress.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-muted text-sm">{t('onboarding.emptyFunnel')}</td></tr>
            ) : inProgress.map(c => {
              const days = daysSince(c.onboarding.stepStartedAt);
              return (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5"><Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors">{c.name}</Link></td>
                  <td className="px-4 py-2.5 text-ink-muted">{ONBOARDING_STEPS[c.onboarding.step]}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{t('onboarding.daysInStep', { count: days })}</td>
                  <td className="px-4 py-2.5">
                    {c.onboarding.stuck ? <StatusBadge tone="danger">{t('onboarding.stuck')}</StatusBadge> : <StatusBadge tone="neutral">{t('onboarding.inProgress')}</StatusBadge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

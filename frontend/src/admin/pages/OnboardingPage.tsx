import React from 'react';
import { Link } from 'react-router-dom';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { adminClinics, ONBOARDING_STEPS, DEMO_NOW_MS } from '../../data/adminDemoData';

function daysSince(iso: string): number {
  return Math.floor((DEMO_NOW_MS - new Date(iso).getTime()) / 86400000);
}

export default function OnboardingPage() {
  const inProgress = adminClinics.filter(c => c.onboarding.step < 7);
  const live = adminClinics.filter(c => c.onboarding.step === 7);

  return (
    <div className="space-y-5">
      <AppMeta title="Onboarding Takibi | CareNova Platform" />
      <div>
        <h1 className="text-xl font-semibold text-ink">Onboarding Takibi</h1>
        <p className="text-ink-muted text-sm mt-0.5">
          Hedef: klinik 45 dk, solo 15 dk. {live.length} klinik canlıda, {inProgress.length} klinik hunide.
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
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Klinik</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Adım</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Bu Adımda Geçen Süre</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Durum</th>
            </tr>
          </thead>
          <tbody>
            {inProgress.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-muted text-sm">Hunide bekleyen klinik yok — hepsi canlıda.</td></tr>
            ) : inProgress.map(c => {
              const days = daysSince(c.onboarding.stepStartedAt);
              return (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5"><Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors">{c.name}</Link></td>
                  <td className="px-4 py-2.5 text-ink-muted">{ONBOARDING_STEPS[c.onboarding.step]}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{days} gün</td>
                  <td className="px-4 py-2.5">
                    {c.onboarding.stuck ? <StatusBadge tone="danger">Takıldı</StatusBadge> : <StatusBadge tone="neutral">Devam ediyor</StatusBadge>}
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

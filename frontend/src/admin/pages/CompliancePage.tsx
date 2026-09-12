import React from 'react';
import DemoName from '../../components/DemoName';
import { Link } from 'react-router-dom';
import AppMeta from '../../components/AppMeta';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat } from '../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../components/QueryState';
import {
  LicenseBadge, InsuranceBadge, VerbisBadge, CrossBorderBadge, Ek1Cell, LanguageRatio, isFullyCompliant,
} from '../components/ComplianceBadges';
import type { AdminClinic, DemoSplit } from '../types';

type Row = Pick<AdminClinic, 'id' | 'isDemo' | 'name' | 'licenseNumber' | 'licenseExpiry' | 'compliance'>;
interface ComplianceResponse {
  counts: DemoSplit;
  clinics: Row[];
  recentEvents: Array<{ id: string; isDemo: boolean; clinicId: string; clinicName: string; rule: string; language: string | null; actor: string | null; at: string }>;
}

const th = 'px-4 py-2.5 font-medium text-ink-subtle';

export default function CompliancePage() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const query = usePlatformQuery<ComplianceResponse>('/api/admin/platform/compliance');

  const header = (
    <div>
      <AppMeta title={`${t('compliance.title')} | CareNova Platform`} />
      <h1 className="text-xl font-semibold text-ink">{t('compliance.title')}</h1>
      <p className="text-ink-muted text-sm mt-0.5">{t('compliance.subtitle')}</p>
    </div>
  );

  if (query.loading) return <div className="space-y-4">{header}<LoadingState /></div>;
  if (query.error || !query.data) return <div className="space-y-4">{header}<ErrorState error={query.error} onRetry={query.reload} /></div>;

  const { clinics, recentEvents } = query.data;
  if (clinics.length === 0) return <div className="space-y-4">{header}<EmptyState title={t('clinics.emptyTitle')} body={t('clinics.emptyBody')} /></div>;

  const fully = clinics.filter(isFullyCompliant).length;
  const notAssessed = clinics.filter(c => !c.compliance.assessed).length;
  const withGaps = clinics.length - fully - notAssessed;

  return (
    <div className="space-y-4">
      {header}

      <div className="grid sm:grid-cols-3 gap-3 max-w-2xl">
        <div className="rounded-xl border border-success/30 bg-success-soft p-4">
          <p className="text-xs font-medium text-success uppercase tracking-wide mb-1">{t('compliance.fullyCompliant')}</p>
          <p className="font-display text-2xl text-ink">{fully} / {clinics.length}</p>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning-soft p-4">
          <p className="text-xs font-medium text-warning uppercase tracking-wide mb-1">{t('compliance.withGaps')}</p>
          <p className="font-display text-2xl text-ink">{withGaps} / {clinics.length}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-medium text-ink-subtle uppercase tracking-wide mb-1">{t('compliance.notAssessed')}</p>
          <p className="font-display text-2xl text-ink">{notAssessed} / {clinics.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className={th}>{t('compliance.columns.clinic')}</th>
              <th scope="col" className={th}>{t('compliance.columns.license')}</th>
              <th scope="col" className={th}>{t('compliance.columns.insurance')}</th>
              <th scope="col" className={th}>{t('compliance.columns.verbis')}</th>
              <th scope="col" className={th}>{t('compliance.columns.langStaff')}</th>
              <th scope="col" className={th}>{t('compliance.columns.ek1Consent')}</th>
              <th scope="col" className={th}>{t('compliance.columns.crossBorder')}</th>
            </tr>
          </thead>
          <tbody>
            {clinics.map((c, i) => {
              const insuranceDays = c.compliance.complicationInsurance === 'active' ? fmt.daysUntil(c.compliance.complicationInsuranceExpiry) : null;
              const insuranceSoon = insuranceDays !== null && insuranceDays <= 60;
              const licenseDays = c.licenseNumber ? fmt.daysUntil(c.licenseExpiry) : null;
              const licenseSoon = licenseDays !== null && licenseDays <= 60;
              return (
                <tr key={c.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                  <td className="px-4 py-2.5">
                    <Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors"><DemoName when={c.isDemo}>{c.name}</DemoName></Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <LicenseBadge licenseNumber={c.licenseNumber} assessed={c.compliance.assessed} />
                      {licenseSoon && licenseDays !== null && (
                        <span className={`text-xs ${licenseDays < 0 ? 'text-danger' : 'text-warning'}`}>
                          {licenseDays < 0 ? t('compliance.daysOverdue', { count: Math.abs(licenseDays) }) : t('compliance.daysLeft', { count: licenseDays })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <InsuranceBadge status={c.compliance.complicationInsurance} />
                      {insuranceSoon && insuranceDays !== null && (
                        <span className={`text-xs ${insuranceDays < 0 ? 'text-danger' : 'text-warning'}`}>
                          {insuranceDays < 0 ? t('compliance.daysOverdue', { count: Math.abs(insuranceDays) }) : t('compliance.daysLeft', { count: insuranceDays })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><VerbisBadge status={c.compliance.verbis} /></td>
                  <td className="px-4 py-2.5"><LanguageRatio ratio={c.compliance.foreignLanguageStaffRatio} /></td>
                  <td className="px-4 py-2.5"><Ek1Cell compliance={c.compliance} /></td>
                  <td className="px-4 py-2.5"><CrossBorderBadge status={c.compliance.crossBorderContract} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-subtle">{t('compliance.footerNote')}</p>

      <div>
        <h2 className="text-sm font-semibold text-ink mb-2">{t('compliance.recentEventsTitle')}</h2>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('compliance.recentEventsEmpty')}</p>
        ) : (
          <ul className="rounded-xl border border-line bg-surface divide-y divide-line">
            {recentEvents.map(e => (
              <li key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <span><DemoName when={e.isDemo}>{e.clinicName}</DemoName> — <span className="text-ink-muted">{e.rule}</span></span>
                <span className="text-xs text-ink-subtle shrink-0">{fmt.dateTime(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

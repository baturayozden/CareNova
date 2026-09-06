import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { adminClinics, DEMO_NOW_MS } from '../../data/adminDemoData';

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - DEMO_NOW_MS) / 86400000);
}

function Check({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return ok ? <StatusBadge tone="success">{yes}</StatusBadge> : <StatusBadge tone="danger">{no}</StatusBadge>;
}

export default function CompliancePage() {
  const { t } = useTranslation('admin');
  const fullyCompliant = adminClinics.filter(c =>
    c.compliance.licenseOnFile && c.compliance.complicationInsurance && c.compliance.verbisRegistered &&
    !c.compliance.ek1HasUnconsentedMedia && c.compliance.crossBorderNotified,
  ).length;
  const withGaps = adminClinics.length - fullyCompliant;

  return (
    <div className="space-y-4">
      <AppMeta title={`${t('compliance.title')} | CareNova Platform`} />
      <div>
        <h1 className="text-xl font-semibold text-ink">{t('compliance.title')}</h1>
        <p className="text-ink-muted text-sm mt-0.5">{t('compliance.subtitle')}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
        <div className="rounded-xl border border-success/30 bg-success-soft p-4">
          <p className="text-xs font-medium text-success uppercase tracking-wide mb-1">{t('compliance.fullyCompliant')}</p>
          <p className="font-display text-2xl text-ink">{fullyCompliant} / {adminClinics.length}</p>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning-soft p-4">
          <p className="text-xs font-medium text-warning uppercase tracking-wide mb-1">{t('compliance.withGaps')}</p>
          <p className="font-display text-2xl text-ink">{withGaps} / {adminClinics.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('compliance.columns.clinic')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('compliance.columns.license')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('compliance.columns.insurance')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('compliance.columns.verbis')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('compliance.columns.langStaff')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('compliance.columns.ek1Consent')}</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('compliance.columns.crossBorder')}</th>
            </tr>
          </thead>
          <tbody>
            {adminClinics.map((c, i) => {
              const insuranceDays = daysUntil(c.compliance.complicationInsuranceExpiry);
              const insuranceSoon = insuranceDays !== null && insuranceDays <= 60 && insuranceDays >= 0;
              const licenseDays = daysUntil(c.licenseExpiry);
              const licenseSoon = licenseDays !== null && licenseDays <= 60;
              return (
                <tr key={c.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                  <td className="px-4 py-2.5">
                    <Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors">{c.name}</Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Check ok={c.compliance.licenseOnFile} yes={t('compliance.yes')} no={t('compliance.no')} />
                      {licenseSoon && licenseDays !== null && (
                        <span className={`text-xs ${licenseDays < 0 ? 'text-danger' : 'text-warning'}`}>
                          {licenseDays < 0 ? t('compliance.daysOverdue', { count: Math.abs(licenseDays) }) : t('compliance.daysLeft', { count: licenseDays })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Check ok={c.compliance.complicationInsurance} yes={t('compliance.yes')} no={t('compliance.no')} />
                      {insuranceSoon && <span className="text-xs text-warning">{t('compliance.daysLeft', { count: insuranceDays })}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><Check ok={c.compliance.verbisRegistered} yes={t('compliance.yes')} no={t('compliance.no')} /></td>
                  <td className="px-4 py-2.5">
                    <span className={c.compliance.foreignLanguageStaffRatio < 20 ? 'text-warning' : 'text-ink'}>%{c.compliance.foreignLanguageStaffRatio}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink-muted text-xs">{c.compliance.ek1TotalConsents} / {c.compliance.ek1RevokedConsents} {t('compliance.revokedSuffix')}</span>
                      {c.compliance.ek1HasUnconsentedMedia && <StatusBadge tone="danger">{t('compliance.unconsentedMedia')}</StatusBadge>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><Check ok={c.compliance.crossBorderNotified} yes={t('compliance.yes')} no={t('compliance.no')} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-subtle">
        {t('compliance.footerNote')}
      </p>
    </div>
  );
}

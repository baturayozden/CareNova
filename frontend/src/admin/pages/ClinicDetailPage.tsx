import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, CheckCircle2, PauseCircle, PlusCircle, ArrowLeftRight } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { adminClinics, adminAuditEvents, BRANCH_LABELS, PLAN_LABELS, ONBOARDING_STEPS } from '../../data/adminDemoData';
import { useImpersonation } from '../ImpersonationContext';

const TABS = ['Genel', 'Kullanıcılar', 'WhatsApp', 'AI Kullanım', 'Faturalama', 'Uyum', 'Denetim'] as const;
const TAB_KEYS: Record<typeof TABS[number], string> = {
  Genel: 'general',
  Kullanıcılar: 'users',
  WhatsApp: 'whatsapp',
  'AI Kullanım': 'aiUsage',
  Faturalama: 'billing',
  Uyum: 'compliance',
  Denetim: 'audit',
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-subtle mb-0.5">{label}</p>
      <p className="text-sm text-ink font-medium">{value}</p>
    </div>
  );
}

export default function ClinicDetailPage() {
  const { t } = useTranslation('admin');
  const { id } = useParams();
  const clinic = adminClinics.find(c => c.id === id);
  const [tab, setTab] = useState<typeof TABS[number]>('Genel');
  const [impersonateReason, setImpersonateReason] = useState('');
  const [showImpersonateForm, setShowImpersonateForm] = useState(false);
  const { session, start } = useImpersonation();

  if (!clinic) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-muted text-sm">{t('clinicDetail.notFound')}</p>
        <Link to="/admin/clinics" className="text-accent text-sm hover:underline">{t('clinicDetail.backToList')}</Link>
      </div>
    );
  }

  const auditForClinic = adminAuditEvents.filter(e => e.clinicId === clinic.id);
  const isImpersonatingThis = session?.clinicId === clinic.id;

  return (
    <div className="space-y-5">
      <AppMeta title={`${clinic.name} | CareNova Platform`} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/clinics" className="text-xs text-ink-subtle hover:text-ink transition-colors">{t('clinicDetail.backLink')}</Link>
          <h1 className="text-xl font-semibold text-ink mt-1">{clinic.name}</h1>
          <p className="text-ink-muted text-sm">{clinic.legalName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors">
            <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true" /> {t('clinicDetail.actions.approve')}
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft transition-colors">
            <PauseCircle size={14} strokeWidth={1.75} aria-hidden="true" /> {t('clinicDetail.actions.suspend')}
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors">
            <ArrowLeftRight size={14} strokeWidth={1.75} aria-hidden="true" /> {t('clinicDetail.actions.changePlan')}
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors">
            <PlusCircle size={14} strokeWidth={1.75} aria-hidden="true" /> {t('clinicDetail.actions.addQuota')}
          </button>
          {isImpersonatingThis ? (
            <StatusBadge tone="warning">{t('clinicDetail.actions.viewingNow')}</StatusBadge>
          ) : (
            <button
              onClick={() => setShowImpersonateForm(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
            >
              <Eye size={14} strokeWidth={1.75} aria-hidden="true" /> {t('clinicDetail.actions.viewAsClinic')}
            </button>
          )}
        </div>
      </div>

      {showImpersonateForm && !isImpersonatingThis && (
        <div className="rounded-xl border border-accent/30 bg-accent-soft p-4">
          <p className="text-sm font-medium text-ink mb-2">{t('clinicDetail.impersonateForm.reasonLabel')}</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={impersonateReason}
              onChange={(e) => setImpersonateReason(e.target.value)}
              placeholder={t('clinicDetail.impersonateForm.reasonPlaceholder')}
              className="flex-1 min-w-[240px] rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
            />
            <button
              disabled={!impersonateReason.trim()}
              onClick={() => { start(clinic.id, impersonateReason); setShowImpersonateForm(false); setImpersonateReason(''); }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('clinicDetail.impersonateForm.start')}
            </button>
          </div>
          <p className="text-xs text-ink-muted mt-2">{t('clinicDetail.impersonateForm.note')}</p>
        </div>
      )}

      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {TABS.map(tabItem => (
          <button
            key={tabItem}
            onClick={() => setTab(tabItem)}
            className={`px-3.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === tabItem ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t(`clinicDetail.tabs.${TAB_KEYS[tabItem]}`)}
          </button>
        ))}
      </div>

      {tab === 'Genel' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label={t('clinicDetail.fields.title')} value={clinic.legalName} />
          <Field label={t('clinicDetail.fields.licenseNumber')} value={clinic.licenseNumber || '—'} />
          <Field label={t('clinicDetail.fields.city')} value={clinic.city} />
          <Field label={t('clinicDetail.fields.branches')} value={clinic.branches.map(b => BRANCH_LABELS[b]).join(', ')} />
          <Field label={t('clinicDetail.fields.plan')} value={PLAN_LABELS[clinic.plan]} />
          <Field label={t('clinicDetail.fields.contact')} value={<>{clinic.contactEmail}<br />{clinic.contactPhone}</>} />
          <Field label={t('clinicDetail.fields.timezone')} value={clinic.timezone} />
          <Field label={t('clinicDetail.fields.currency')} value={clinic.currency} />
          <Field label={t('clinicDetail.fields.onboardingStep')} value={`${clinic.onboarding.step}/7 — ${ONBOARDING_STEPS[Math.min(clinic.onboarding.step, 7) - 1] || t('clinicDetail.onboardingLive')}`} />
        </div>
      )}

      {tab === 'Kullanıcılar' && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-sm text-ink-muted">{t('clinicDetail.usersTabPrefix', { count: clinic.userCount })}<Link to="/admin/users" className="text-accent hover:underline">{t('nav.users')}</Link>{t('clinicDetail.usersTabSuffix')}</p>
        </div>
      )}

      {tab === 'WhatsApp' && (
        <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label={t('clinicDetail.whatsappTab.displayNumber')} value={clinic.whatsapp.displayNumber || '—'} />
          <Field label={t('clinicDetail.whatsappTab.connectionStatus')} value={clinic.whatsapp.connected ? <StatusBadge tone="success">{t('clinicDetail.whatsappTab.connected')}</StatusBadge> : <StatusBadge tone="danger">{t('clinicDetail.whatsappTab.notConnected')}</StatusBadge>} />
          <Field label={t('clinicDetail.whatsappTab.messages24h')} value={clinic.whatsapp.messagesLast24h} />
          <Field label={t('clinicDetail.whatsappTab.errors24h')} value={clinic.whatsapp.errorsLast24h} />
        </div>
      )}

      {tab === 'AI Kullanım' && (
        <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label={t('clinicDetail.aiUsageTab.monthlyQuota')} value={clinic.aiUsage.monthlyQuota.toLocaleString('tr-TR')} />
          <Field label={t('clinicDetail.aiUsageTab.used')} value={`${clinic.aiUsage.usedThisMonth.toLocaleString('tr-TR')} (%${Math.round(clinic.aiUsage.usedThisMonth / clinic.aiUsage.monthlyQuota * 100)})`} />
          <Field label={t('clinicDetail.aiUsageTab.overagePolicy')} value={clinic.aiUsage.overagePolicy === 'block' ? t('clinicDetail.aiUsageTab.block') : t('clinicDetail.aiUsageTab.allow')} />
          <Field label={t('clinicDetail.aiUsageTab.estimatedCost')} value={`€${clinic.aiUsage.estimatedCostEur}`} />
        </div>
      )}

      {tab === 'Faturalama' && (
        <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label={t('clinicDetail.billingTab.period')} value={clinic.billing.periodicity === 'annual' ? t('clinicDetail.billingTab.annual') : t('clinicDetail.billingTab.monthly')} />
          <Field label={t('clinicDetail.billingTab.amount')} value={`€${clinic.billing.amountEur}`} />
          <Field label={t('clinicDetail.billingTab.status')} value={clinic.billing.status === 'current' ? <StatusBadge tone="success">{t('clinicDetail.billingTab.current')}</StatusBadge> : clinic.billing.status === 'overdue' ? <StatusBadge tone="danger">{t('clinicDetail.billingTab.overdue')}</StatusBadge> : <StatusBadge tone="warning">{t('clinicDetail.billingTab.trial')}</StatusBadge>} />
          <Field label={t('clinicDetail.billingTab.nextCharge')} value={new Date(clinic.billing.nextChargeAt).toLocaleDateString('tr-TR')} />
        </div>
      )}

      {tab === 'Uyum' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label={t('clinicDetail.complianceTab.license')} value={clinic.compliance.licenseOnFile ? <StatusBadge tone="success">{t('clinicDetail.complianceTab.yes')}</StatusBadge> : <StatusBadge tone="danger">{t('clinicDetail.complianceTab.no')}</StatusBadge>} />
          <Field label={t('clinicDetail.complianceTab.complicationInsurance')} value={clinic.compliance.complicationInsurance ? <StatusBadge tone="success">{t('clinicDetail.complianceTab.yes')}</StatusBadge> : <StatusBadge tone="danger">{t('clinicDetail.complianceTab.no')}</StatusBadge>} />
          <Field label={t('clinicDetail.complianceTab.verbis')} value={clinic.compliance.verbisRegistered ? <StatusBadge tone="success">{t('clinicDetail.complianceTab.yes')}</StatusBadge> : <StatusBadge tone="danger">{t('clinicDetail.complianceTab.no')}</StatusBadge>} />
          <Field label={t('clinicDetail.complianceTab.foreignLangRatio')} value={`%${clinic.compliance.foreignLanguageStaffRatio}`} />
          <Field label={t('clinicDetail.complianceTab.ek1Consents')} value={`${clinic.compliance.ek1TotalConsents} / ${clinic.compliance.ek1RevokedConsents}`} />
          <Field label={t('clinicDetail.complianceTab.unconsentedMedia')} value={clinic.compliance.ek1HasUnconsentedMedia ? <StatusBadge tone="danger">{t('clinicDetail.complianceTab.yes')}</StatusBadge> : <StatusBadge tone="success">{t('clinicDetail.complianceTab.no')}</StatusBadge>} />
          <Field label={t('clinicDetail.complianceTab.crossBorder')} value={clinic.compliance.crossBorderNotified ? <StatusBadge tone="success">{t('clinicDetail.complianceTab.done')}</StatusBadge> : <StatusBadge tone="danger">{t('clinicDetail.complianceTab.notDone')}</StatusBadge>} />
        </div>
      )}

      {tab === 'Denetim' && (
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('clinicDetail.auditTab.who')}</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('clinicDetail.auditTab.what')}</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('clinicDetail.auditTab.when')}</th>
              </tr>
            </thead>
            <tbody>
              {auditForClinic.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-ink-muted text-sm">{t('clinicDetail.auditTab.empty')}</td></tr>
              ) : auditForClinic.map(e => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 text-ink">{e.actor}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{e.action}</td>
                  <td className="px-4 py-2.5 text-ink-subtle text-xs">{new Date(e.at).toLocaleString('tr-TR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

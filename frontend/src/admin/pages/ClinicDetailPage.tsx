import React, { useState } from 'react';
import DemoName, { useDemoNameText } from '../../components/DemoName';
import { useParams, Link } from 'react-router-dom';
import { Eye, CheckCircle2, PauseCircle, PlusCircle, ArrowLeftRight } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { useImpersonation } from '../ImpersonationContext';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat } from '../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../components/QueryState';
import { LicenseBadge, InsuranceBadge, VerbisBadge, CrossBorderBadge, Ek1Cell, LanguageRatio } from '../components/ComplianceBadges';
import type { AdminAuditEvent, AdminClinic, AdminClinicUser, DerivationBasis } from '../types';

interface DetailResponse {
  clinic: AdminClinic;
  users: AdminClinicUser[];
  auditEvents: AdminAuditEvent[];
  basis: DerivationBasis;
}

const TABS = ['general', 'users', 'whatsapp', 'aiUsage', 'billing', 'compliance', 'audit'] as const;
type Tab = typeof TABS[number];

const th = 'px-4 py-2.5 font-medium text-ink-subtle';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-subtle mb-0.5">{label}</p>
      <div className="text-sm text-ink font-medium">{value}</div>
    </div>
  );
}

export default function ClinicDetailPage() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const { id } = useParams();
  const query = usePlatformQuery<DetailResponse>(id ? `/api/admin/platform/clinics/${id}` : null);
  const [tab, setTab] = useState<Tab>('general');
  const [impersonateReason, setImpersonateReason] = useState('');
  const [showImpersonateForm, setShowImpersonateForm] = useState(false);
  const demoNameText = useDemoNameText();
  const { session, start } = useImpersonation();

  const notFound = (query.error as { response?: { status?: number } })?.response?.status === 404;
  if (query.loading) return <LoadingState />;
  if (notFound || (!query.error && !query.data)) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-muted text-sm">{t('clinicDetail.notFound')}</p>
        <Link to="/admin/clinics" className="text-accent text-sm hover:underline">{t('clinicDetail.backToList')}</Link>
      </div>
    );
  }
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={query.reload} />;

  const { clinic, users, auditEvents, basis } = query.data;
  const isImpersonatingThis = session?.clinicId === clinic.id;
  const quotaPct = clinic.aiUsage.monthlyQuota > 0 ? Math.round(clinic.aiUsage.usedThisMonth / clinic.aiUsage.monthlyQuota * 100) : null;
  const disabledAction = 'inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-subtle cursor-not-allowed';

  return (
    <div className="space-y-5">
      <AppMeta title={`${demoNameText(clinic.name, clinic.isDemo)} | CareNova Platform`} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/clinics" className="text-xs text-ink-subtle hover:text-ink transition-colors">{t('clinicDetail.backLink')}</Link>
          <h1 className="text-xl font-semibold text-ink mt-1"><DemoName when={clinic.isDemo}>{clinic.name}</DemoName></h1>
          {clinic.legalName && <p className="text-ink-muted text-sm"><DemoName when={clinic.isDemo}>{clinic.legalName}</DemoName></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Write actions are out of scope this round (read-only console); shown disabled, not faked. */}
          <button disabled title={t('clinicDetail.actions.notAvailable')} className={disabledAction}>
            <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true" /> {t('clinicDetail.actions.approve')}
          </button>
          <button disabled title={t('clinicDetail.actions.notAvailable')} className={disabledAction}>
            <PauseCircle size={14} strokeWidth={1.75} aria-hidden="true" /> {t('clinicDetail.actions.suspend')}
          </button>
          <button disabled title={t('clinicDetail.actions.notAvailable')} className={disabledAction}>
            <ArrowLeftRight size={14} strokeWidth={1.75} aria-hidden="true" /> {t('clinicDetail.actions.changePlan')}
          </button>
          <button disabled title={t('clinicDetail.actions.notAvailable')} className={disabledAction}>
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
          <label htmlFor="impersonate-reason" className="block text-sm font-medium text-ink mb-2">{t('clinicDetail.impersonateForm.reasonLabel')}</label>
          <div className="flex flex-wrap gap-2">
            <input
              id="impersonate-reason"
              value={impersonateReason}
              onChange={(e) => setImpersonateReason(e.target.value)}
              placeholder={t('clinicDetail.impersonateForm.reasonPlaceholder')}
              className="flex-1 min-w-[240px] rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
            />
            <button
              disabled={!impersonateReason.trim()}
              onClick={() => { start(clinic.id, clinic.name, impersonateReason); setShowImpersonateForm(false); setImpersonateReason(''); }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('clinicDetail.impersonateForm.start')}
            </button>
          </div>
          <p className="text-xs text-ink-muted mt-2">{t('clinicDetail.impersonateForm.note')}</p>
        </div>
      )}

      <div className="flex gap-1 border-b border-line overflow-x-auto" role="tablist">
        {TABS.map(tabKey => (
          <button
            key={tabKey}
            role="tab"
            aria-selected={tab === tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-3.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === tabKey ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t(`clinicDetail.tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label={t('clinicDetail.fields.title')} value={clinic.legalName ? <DemoName when={clinic.isDemo}>{clinic.legalName}</DemoName> : '—'} />
          <Field label={t('clinicDetail.fields.licenseNumber')} value={clinic.licenseNumber || '—'} />
          <Field label={t('clinicDetail.fields.city')} value={clinic.city ?? '—'} />
          <Field label={t('clinicDetail.fields.branches')} value={fmt.branches(clinic.branches)} />
          <Field label={t('clinicDetail.fields.plan')} value={fmt.plan(clinic.plan)} />
          <Field label={t('clinicDetail.fields.status')} value={fmt.clinicStatus(clinic.status)} />
          <Field label={t('clinicDetail.fields.contact')} value={<>{clinic.contactEmail ?? '—'}<br />{clinic.contactPhone ?? ''}</>} />
          <Field label={t('clinicDetail.fields.timezone')} value={clinic.timezone ?? '—'} />
          <Field label={t('clinicDetail.fields.currency')} value={clinic.currency ?? '—'} />
          <Field label={t('clinicDetail.fields.onboardingStep')} value={`${clinic.onboarding.step}/7 — ${fmt.onboardingStep(clinic.onboarding.step)}`} />
          <Field label={t('clinicDetail.fields.activeCases')} value={clinic.activeCases} />
          <Field label={t('clinicDetail.fields.createdAt')} value={fmt.date(clinic.createdAt)} />
        </div>
      )}

      {tab === 'users' && (
        users.length === 0 ? <EmptyState title={t('clinicDetail.usersTab.empty')} /> : (
          <div className="rounded-xl border border-line bg-surface overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className={th}>{t('users.columnsClinic.name')}</th>
                  <th scope="col" className={th}>{t('users.columnsClinic.role')}</th>
                  <th scope="col" className={th}>{t('users.columnsClinic.lastLogin')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-ink"><DemoName when={u.isDemo}>{u.name}</DemoName></p>
                      <p className="text-ink-subtle text-xs">{u.email}</p>
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{fmt.role(u.role)}</td>
                    <td className="px-4 py-2.5 text-ink-subtle text-xs">{fmt.dateTime(u.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'whatsapp' && (
        clinic.whatsapp === null ? <EmptyState title={t('whatsapp.noLine')} body={t('clinicDetail.whatsappTab.noLineBody')} /> : (
          <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-5">
            <Field label={t('clinicDetail.whatsappTab.displayNumber')} value={clinic.whatsapp.displayNumber || '—'} />
            <Field label={t('clinicDetail.whatsappTab.connectionStatus')} value={clinic.whatsapp.connected ? <StatusBadge tone="success">{t('whatsapp.connected')}</StatusBadge> : <StatusBadge tone="danger">{t('whatsapp.notConnected')}</StatusBadge>} />
            <Field label={t('clinicDetail.whatsappTab.messages24h')} value={clinic.whatsapp.messagesLast24h} />
            <Field label={t('clinicDetail.whatsappTab.errors24h')} value={clinic.whatsapp.errorsLast24h} />
            <Field label={t('whatsapp.columns.lastDelivery')} value={fmt.timeAgo(clinic.whatsapp.lastWebhookSuccessAt)} />
          </div>
        )
      )}

      {tab === 'aiUsage' && (
        <div className="space-y-2">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-xl border border-line bg-surface p-5">
            <Field label={t('clinicDetail.aiUsageTab.monthlyQuota')} value={fmt.num(clinic.aiUsage.monthlyQuota)} />
            <Field label={t('clinicDetail.aiUsageTab.used')} value={`${fmt.num(clinic.aiUsage.usedThisMonth)}${quotaPct === null ? '' : ` (${fmt.pct(quotaPct)})`}`} />
            <Field label={t('clinicDetail.aiUsageTab.overagePolicy')} value={t(`aiUsage.policy.${clinic.aiUsage.overagePolicy}`)} />
            <Field label={t('aiUsage.columns.tokens')} value={t('aiUsage.tokensValue', { input: fmt.num(clinic.aiUsage.promptTokensThisMonth), output: fmt.num(clinic.aiUsage.completionTokensThisMonth) })} />
            <Field label={t('clinicDetail.aiUsageTab.estimatedCost')} value={fmt.usd(clinic.aiUsage.costUsdThisMonth)} />
          </div>
          <p className="text-xs text-ink-subtle">{t('aiUsage.formula', { model: basis.aiPricing.model, input: basis.aiPricing.inputUsdPerMTok, output: basis.aiPricing.outputUsdPerMTok })}</p>
        </div>
      )}

      {tab === 'billing' && (
        clinic.billing === null ? <EmptyState title={t('billing.noSubscription')} /> : (
          <div className="space-y-2">
            <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-5">
              <Field label={t('clinicDetail.billingTab.period')} value={t(`billing.${clinic.billing.periodicity}`)} />
              <Field label={t('clinicDetail.billingTab.amount')} value={t('billing.perMonth', { amount: fmt.eur(clinic.billing.amountEur) })} />
              <Field label={t('clinicDetail.billingTab.status')} value={<StatusBadge tone={clinic.billing.status === 'current' ? 'success' : clinic.billing.status === 'overdue' ? 'danger' : 'warning'}>{t(`billing.${clinic.billing.status}`)}</StatusBadge>} />
              <Field label={t('clinicDetail.billingTab.nextCharge')} value={fmt.date(clinic.billing.nextChargeAt)} />
            </div>
            <p className="text-xs text-ink-subtle">{t('billing.basisNote', { solo: basis.planPriceEur.solo, klinik: basis.planPriceEur.klinik, grup: basis.planPriceEur.grup })}</p>
          </div>
        )
      )}

      {tab === 'compliance' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label={t('clinicDetail.complianceTab.license')} value={<LicenseBadge licenseNumber={clinic.licenseNumber} assessed={clinic.compliance.assessed} />} />
          <Field label={t('clinicDetail.complianceTab.complicationInsurance')} value={<InsuranceBadge status={clinic.compliance.complicationInsurance} />} />
          <Field label={t('clinicDetail.complianceTab.verbis')} value={<VerbisBadge status={clinic.compliance.verbis} />} />
          <Field label={t('clinicDetail.complianceTab.foreignLangRatio')} value={<LanguageRatio ratio={clinic.compliance.foreignLanguageStaffRatio} />} />
          <Field label={t('clinicDetail.complianceTab.ek1Consents')} value={<Ek1Cell compliance={clinic.compliance} />} />
          <Field label={t('clinicDetail.complianceTab.crossBorder')} value={<CrossBorderBadge status={clinic.compliance.crossBorderContract} />} />
        </div>
      )}

      {tab === 'audit' && (
        auditEvents.length === 0 ? <EmptyState title={t('clinicDetail.auditTab.empty')} body={t('audit.emptyBody')} /> : (
          <div className="rounded-xl border border-line bg-surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className={th}>{t('clinicDetail.auditTab.who')}</th>
                  <th scope="col" className={th}>{t('clinicDetail.auditTab.what')}</th>
                  <th scope="col" className={th}>{t('clinicDetail.auditTab.when')}</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map(e => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-ink" title={e.actor ? undefined : t('audit.noActor')}>{e.actor ?? '—'}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{e.action}</td>
                    <td className="px-4 py-2.5 text-ink-subtle text-xs">{fmt.dateTime(e.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

import React from 'react';
import DemoName from '../../components/DemoName';
import { Building2, Sparkles, MessageCircle, Wallet, Clock3, AlertTriangle, Briefcase } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat } from '../lib/format';
import { LoadingState, ErrorState, EmptyState, NotMeasured } from '../components/QueryState';
import type { AdminClinic, DemoSplit, DemoRealAmount, DerivationBasis, HealthResponse } from '../types';

interface OverviewResponse {
  counts: { clinics: DemoSplit; activeCases: DemoRealAmount; mrrEur: DemoRealAmount };
  clinics: AdminClinic[];
  basis: DerivationBasis;
}

function KpiCard({ Icon, label, value, sub }: { Icon: typeof Building2; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-ink-subtle mb-2">
        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-display text-2xl text-ink">{value}</p>
      {sub && <p className="text-xs text-ink-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function AttentionCard({ tone, title, items }: { tone: 'warning' | 'danger'; title: string; items: React.ReactNode[] }) {
  const { t } = useAdminFormat();
  const box = tone === 'danger' ? 'border-danger/30 bg-danger-soft' : 'border-warning/30 bg-warning-soft';
  const text = tone === 'danger' ? 'text-danger' : 'text-warning';
  return (
    <div className={`rounded-xl border p-4 ${box}`}>
      <div className={`flex items-center gap-2 mb-2 ${text}`}>
        <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className="text-xs font-semibold">{title}</span>
      </div>
      {items.length === 0
        ? <p className="text-xs text-ink-muted">{t('overview.empty')}</p>
        : <ul className="space-y-1">{items}</ul>}
    </div>
  );
}

export default function OverviewPage() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const overview = usePlatformQuery<OverviewResponse>('/api/admin/platform/overview');
  // Health feeds one KPI only; if it fails that KPI says "not measured", the page still renders.
  const health = usePlatformQuery<HealthResponse>('/api/admin/platform/health');

  const header = (subtitle?: string) => (
    <div>
      <AppMeta title={`${t('overview.title')} | CareNova Platform`} />
      <h1 className="text-xl font-semibold text-ink">{t('overview.title')}</h1>
      {subtitle && <p className="text-ink-muted text-sm mt-0.5">{subtitle}</p>}
    </div>
  );

  if (overview.loading) return <div className="space-y-6">{header()}<LoadingState /></div>;
  if (overview.error || !overview.data) return <div className="space-y-6">{header()}<ErrorState error={overview.error} onRetry={overview.reload} /></div>;

  const { clinics, counts } = overview.data;
  const split = (demo: number, real: number) => t('overview.split', { demo: fmt.num(demo), real: fmt.num(real) });
  const splitOf = (rows: AdminClinic[]) => split(rows.filter(c => c.isDemo).length, rows.filter(c => !c.isDemo).length);

  if (clinics.length === 0) {
    return (
      <div className="space-y-6">
        {header(t('overview.subtitle', { real: 0, demo: 0 }))}
        <EmptyState title={t('overview.emptyTitle')} body={t('overview.emptyBody')} />
      </div>
    );
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const activeClinics = clinics.filter(c => c.status === 'active');
  const newThisMonth = clinics.filter(c => c.createdAt && new Date(c.createdAt).getTime() >= monthStart);
  const withWhatsapp = clinics.filter(c => c.whatsapp?.connected);
  const aiDemo = clinics.filter(c => c.isDemo).reduce((s, c) => s + c.aiUsage.usedThisMonth, 0);
  const aiReal = clinics.filter(c => !c.isDemo).reduce((s, c) => s + c.aiUsage.usedThisMonth, 0);

  const quotaWarnings = clinics.filter(c => c.aiUsage.monthlyQuota > 0 && c.aiUsage.usedThisMonth / c.aiUsage.monthlyQuota > 0.85);
  const stuck = clinics.filter(c => c.onboarding.step < 7 && c.onboarding.stuck);
  const overdue = clinics.filter(c => c.billing?.status === 'overdue');
  const avgFirstReply = health.data?.avgFirstReplySeconds ?? null;

  return (
    <div className="space-y-6">
      {header(t('overview.subtitle', { real: counts.clinics.real, demo: counts.clinics.demo }))}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard Icon={Building2} label={t('overview.kpi.activeClinic')} value={fmt.num(activeClinics.length)} sub={splitOf(activeClinics)} />
        <KpiCard Icon={Sparkles} label={t('overview.kpi.newThisMonth')} value={fmt.num(newThisMonth.length)} sub={splitOf(newThisMonth)} />
        <KpiCard Icon={Briefcase} label={t('overview.kpi.activeCases')} value={fmt.num(counts.activeCases.demo + counts.activeCases.real)} sub={split(counts.activeCases.demo, counts.activeCases.real)} />
        <KpiCard Icon={MessageCircle} label={t('overview.kpi.activeWhatsapp')} value={`${withWhatsapp.length}/${clinics.length}`} sub={splitOf(withWhatsapp)} />
        <KpiCard Icon={Sparkles} label={t('overview.kpi.aiConversations')} value={fmt.num(aiDemo + aiReal)} sub={split(aiDemo, aiReal)} />
        <KpiCard Icon={Wallet} label={t('overview.kpi.mrr')} value={fmt.eur(counts.mrrEur.demo + counts.mrrEur.real)} sub={t('overview.splitEur', { demo: fmt.eur(counts.mrrEur.demo), real: fmt.eur(counts.mrrEur.real) })} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-ink-subtle mb-1">
            <Clock3 size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wide">{t('overview.avgFirstReplyLabel')}</span>
          </div>
          <p className="font-display text-2xl text-ink">
            {avgFirstReply === null ? <NotMeasured /> : t('overview.avgFirstReplyValue', { value: fmt.num(avgFirstReply, 1) })}
          </p>
          {health.data && avgFirstReply !== null && (
            <p className="text-xs text-ink-muted mt-0.5">{t('overview.avgFirstReplySample', { count: health.data.sampleSizes.firstReplyLeads7d })}</p>
          )}
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle mb-1">{t('overview.trendLabel')}</p>
          <p className="font-display text-2xl"><NotMeasured /></p>
          <p className="text-xs text-ink-muted mt-0.5">{t('overview.trendNotMeasured')}</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink mb-3">{t('overview.attentionNeeded')}</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <AttentionCard
            tone="warning"
            title={t('overview.quotaWarning', { count: quotaWarnings.length })}
            items={quotaWarnings.map(c => (
              <li key={c.id} className="text-xs text-ink"><DemoName when={c.isDemo}>{c.name}</DemoName> — {fmt.pct(Math.round(c.aiUsage.usedThisMonth / c.aiUsage.monthlyQuota * 100))}</li>
            ))}
          />
          <AttentionCard
            tone="warning"
            title={t('overview.onboardingStuck', { count: stuck.length })}
            items={stuck.map(c => (
              <li key={c.id} className="text-xs text-ink"><DemoName when={c.isDemo}>{c.name}</DemoName> — {fmt.onboardingStep(c.onboarding.step)}</li>
            ))}
          />
          <AttentionCard
            tone="danger"
            title={t('overview.billingOverdue', { count: overdue.length })}
            items={overdue.map(c => (
              <li key={c.id} className="text-xs text-ink"><DemoName when={c.isDemo}>{c.name}</DemoName> — {fmt.eur(c.billing?.amountEur ?? 0)}</li>
            ))}
          />
        </div>
      </div>
    </div>
  );
}

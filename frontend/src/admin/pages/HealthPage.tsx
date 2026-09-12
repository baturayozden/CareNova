import React from 'react';
import DemoName from '../../components/DemoName';
import { Activity, Clock3, AlertOctagon } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat } from '../lib/format';
import { LoadingState, ErrorState, NotMeasured } from '../components/QueryState';
import type { HealthResponse } from '../types';

function KpiCard({ Icon, label, value, good, sample }: { Icon: typeof Activity; label: string; value: string | null; good: boolean; sample: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-ink-subtle mb-2">
        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`font-display text-2xl ${good ? 'text-success' : 'text-warning'}`}>{value === null ? <NotMeasured /> : value}</p>
      <p className="text-xs text-ink-muted mt-0.5">{sample}</p>
    </div>
  );
}

export default function HealthPage() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const query = usePlatformQuery<HealthResponse>('/api/admin/platform/health');

  const header = (
    <div>
      <AppMeta title={`${t('health.title')} | CareNova Platform`} />
      <h1 className="text-xl font-semibold text-ink">{t('health.title')}</h1>
      <p className="text-ink-muted text-sm mt-0.5">{t('health.subtitle')}</p>
    </div>
  );

  if (query.loading) return <div className="space-y-5">{header}<LoadingState /></div>;
  if (query.error || !query.data) return <div className="space-y-5">{header}<ErrorState error={query.error} onRetry={query.reload} /></div>;

  const h = query.data;
  return (
    <div className="space-y-5">
      {header}

      <div className="grid sm:grid-cols-3 gap-3">
        <KpiCard
          Icon={Activity}
          label={t('health.deliverySuccessRate')}
          value={h.deliverySuccessRate === null ? null : fmt.pct(h.deliverySuccessRate, 1)}
          good={(h.deliverySuccessRate ?? 100) >= 95}
          sample={t('health.sampleOutbound', { count: h.sampleSizes.outbound24h })}
        />
        <KpiCard
          Icon={Clock3}
          label={t('health.avgFirstReply')}
          value={h.avgFirstReplySeconds === null ? null : t('health.avgFirstReplyValue', { value: fmt.num(h.avgFirstReplySeconds, 1) })}
          good
          sample={t('health.sampleFirstReply', { count: h.sampleSizes.firstReplyLeads7d })}
        />
        <KpiCard
          Icon={AlertOctagon}
          label={t('health.aiErrorRate')}
          value={h.aiErrorRate === null ? null : fmt.pct(h.aiErrorRate, 1)}
          good={(h.aiErrorRate ?? 0) <= 2}
          sample={t('health.sampleAi', { count: h.sampleSizes.aiMessages24h })}
        />
      </div>
      <p className="text-xs text-ink-subtle">{t('health.definitions')}</p>

      <div>
        <h2 className="text-sm font-semibold text-ink mb-3">{t('health.recentErrors')}</h2>
        {h.recentErrors.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('health.noErrors')}</p>
        ) : (
          <div className="rounded-xl border border-line bg-surface divide-y divide-line">
            {h.recentErrors.map(err => (
              <div key={err.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-ink font-medium"><DemoName when={err.isDemo}>{err.clinicName}</DemoName></p>
                  <p className="text-xs text-ink-muted">{err.message ?? err.code ?? '—'}</p>
                </div>
                <span className="text-xs text-ink-subtle shrink-0">{fmt.dateTime(err.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

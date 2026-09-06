import React from 'react';
import { Activity, Clock3, AlertOctagon } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import { adminHealth } from '../../data/adminDemoData';

function KpiCard({ Icon, label, value, tone }: { Icon: typeof Activity; label: string; value: string; tone: 'success' | 'warning' }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-ink-subtle mb-2">
        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`font-display text-2xl ${tone === 'success' ? 'text-success' : 'text-warning'}`}>{value}</p>
    </div>
  );
}

export default function HealthPage() {
  return (
    <div className="space-y-5">
      <AppMeta title="Platform Sağlığı | CareNova Platform" />
      <div>
        <h1 className="text-xl font-semibold text-ink">Platform Sağlığı</h1>
        <p className="text-ink-muted text-sm mt-0.5">Demo verisiyle — yapı gerçek metriklere bağlanmaya hazır.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <KpiCard Icon={Activity} label="Webhook Başarı Oranı" value={`%${adminHealth.webhookSuccessRate}`} tone={adminHealth.webhookSuccessRate >= 95 ? 'success' : 'warning'} />
        <KpiCard Icon={Clock3} label="Ort. İlk Yanıt Süresi" value={`${adminHealth.avgFirstReplySeconds}sn`} tone="success" />
        <KpiCard Icon={AlertOctagon} label="AI Hata Oranı" value={`%${adminHealth.aiErrorRate}`} tone={adminHealth.aiErrorRate <= 2 ? 'success' : 'warning'} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink mb-3">Son hatalar</h2>
        <div className="rounded-xl border border-line bg-surface divide-y divide-line">
          {adminHealth.recentErrors.map(err => (
            <div key={err.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink font-medium">{err.clinicName}</p>
                <p className="text-xs text-ink-muted">{err.message}</p>
              </div>
              <span className="text-xs text-ink-subtle shrink-0">{new Date(err.at).toLocaleString('tr-TR')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

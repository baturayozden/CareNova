import React from 'react';
import { Building2, Sparkles, MessageCircle, Wallet, Clock3, AlertTriangle } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import { adminClinics, ONBOARDING_STEPS } from '../../data/adminDemoData';

function KpiCard({ Icon, label, value, sub }: { Icon: typeof Building2; label: string; value: string; sub?: string }) {
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

// Inline SVG sparkline — no charting library installed, and a 30-point line
// doesn't need one. Static demo trend, not wired to a real time series.
function Sparkline({ points }: { points: number[] }) {
  const w = 280, h = 56, pad = 4;
  const max = Math.max(...points), min = Math.min(...points);
  const range = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const d = points.map((p, i) => {
    const x = pad + i * step;
    const y = h - pad - ((p - min) / range) * (h - pad * 2);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" role="img" aria-label="Son 30 gün trend">
      <path d={d} fill="none" stroke="rgb(var(--accent))" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function OverviewPage() {
  const activeClinics = adminClinics.filter(c => c.status === 'active');
  const newThisMonth = adminClinics.filter(c => new Date(c.onboarding.stepStartedAt) > new Date('2026-08-07')).length;
  const totalCases = adminClinics.reduce((sum, c) => sum + c.activeCases, 0);
  const activeWhatsapp = adminClinics.filter(c => c.whatsapp.connected).length;
  const aiConversationsThisMonth = adminClinics.reduce((sum, c) => sum + c.aiUsage.usedThisMonth, 0);
  const mrr = adminClinics.reduce((sum, c) => sum + c.mrrEur, 0);
  const avgFirstReply = 4.2; // seconds, platform-wide — see adminHealth for source

  const quotaWarnings = adminClinics.filter(c => c.aiUsage.usedThisMonth / c.aiUsage.monthlyQuota > 0.85);
  const stuckOnboarding = adminClinics.filter(c => c.onboarding.step < 7 && c.onboarding.stuck);
  const overdueBilling = adminClinics.filter(c => c.billing.status === 'overdue');

  // Demo-only illustrative trend — not a real aggregation, matches the
  // honesty rule already established on the landing page (RoiSection etc.):
  // never present fabricated data as if it were a real platform result.
  const trend = [18, 20, 19, 22, 24, 23, 26, 28, 27, 30, 29, 31, 34, 33, 36];

  return (
    <div className="space-y-6">
      <AppMeta title="Genel Bakış | CareNova Platform" />
      <div>
        <h1 className="text-xl font-semibold text-ink">Genel Bakış</h1>
        <p className="text-ink-muted text-sm mt-0.5">Platform genelinde özet — demo verisiyle, {adminClinics.length} klinik.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard Icon={Building2} label="Aktif Klinik" value={String(activeClinics.length)} sub={`${adminClinics.length} toplam`} />
        <KpiCard Icon={Sparkles} label="Bu Ay Yeni" value={String(newThisMonth)} />
        <KpiCard Icon={MessageCircle} label="Aktif Vaka" value={String(totalCases)} />
        <KpiCard Icon={MessageCircle} label="Aktif WhatsApp Hattı" value={`${activeWhatsapp}/${adminClinics.length}`} />
        <KpiCard Icon={Sparkles} label="Bu Ay AI Konuşması" value={aiConversationsThisMonth.toLocaleString('tr-TR')} />
        <KpiCard Icon={Wallet} label="MRR (demo)" value={`€${mrr.toLocaleString('tr-TR')}`} />
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2 text-ink-subtle mb-1">
          <Clock3 size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-wide">Ortalama İlk Yanıt Süresi (platform geneli)</span>
        </div>
        <p className="font-display text-2xl text-ink mb-3">{avgFirstReply}sn</p>
        <p className="text-xs font-medium text-ink-subtle mb-1">Son 30 gün — aktif vaka trendi (örnek veri)</p>
        <Sparkline points={trend} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink mb-3">Dikkat gerektirenler</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-warning/30 bg-warning-soft p-4">
            <div className="flex items-center gap-2 text-warning mb-2">
              <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-xs font-semibold">Kotası dolmak üzere ({quotaWarnings.length})</span>
            </div>
            {quotaWarnings.length === 0 ? (
              <p className="text-xs text-ink-muted">Yok.</p>
            ) : (
              <ul className="space-y-1">
                {quotaWarnings.map(c => (
                  <li key={c.id} className="text-xs text-ink">{c.name} — %{Math.round(c.aiUsage.usedThisMonth / c.aiUsage.monthlyQuota * 100)}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-warning/30 bg-warning-soft p-4">
            <div className="flex items-center gap-2 text-warning mb-2">
              <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-xs font-semibold">Onboarding'de takılan ({stuckOnboarding.length})</span>
            </div>
            {stuckOnboarding.length === 0 ? (
              <p className="text-xs text-ink-muted">Yok.</p>
            ) : (
              <ul className="space-y-1">
                {stuckOnboarding.map(c => (
                  <li key={c.id} className="text-xs text-ink">{c.name} — {ONBOARDING_STEPS[c.onboarding.step]}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-danger/30 bg-danger-soft p-4">
            <div className="flex items-center gap-2 text-danger mb-2">
              <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="text-xs font-semibold">Ödemesi geciken ({overdueBilling.length})</span>
            </div>
            {overdueBilling.length === 0 ? (
              <p className="text-xs text-ink-muted">Yok.</p>
            ) : (
              <ul className="space-y-1">
                {overdueBilling.map(c => (
                  <li key={c.id} className="text-xs text-ink">{c.name} — €{c.billing.amountEur}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

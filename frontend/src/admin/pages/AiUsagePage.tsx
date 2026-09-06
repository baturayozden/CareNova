import React from 'react';
import { Link } from 'react-router-dom';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { adminClinics } from '../../data/adminDemoData';

export default function AiUsagePage() {
  const totalCost = adminClinics.reduce((sum, c) => sum + c.aiUsage.estimatedCostEur, 0);
  const rows = [...adminClinics].sort((a, b) => (b.aiUsage.usedThisMonth / b.aiUsage.monthlyQuota) - (a.aiUsage.usedThisMonth / a.aiUsage.monthlyQuota));

  return (
    <div className="space-y-4">
      <AppMeta title="AI Kullanım ve Kota | CareNova Platform" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">AI Kullanım ve Kota</h1>
          <p className="text-ink-muted text-sm mt-0.5">Klinik bazında bu ayki kullanım.</p>
        </div>
        <div className="rounded-xl border border-line bg-surface px-4 py-2.5">
          <p className="text-xs text-ink-subtle">Toplam Platform Maliyeti (bu ay, demo)</p>
          <p className="font-display text-xl text-ink">€{totalCost.toLocaleString('tr-TR')}</p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Klinik</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Kota</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Kullanım</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Aşım Politikası</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle text-right">Tahmini Maliyet</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const pct = Math.round(c.aiUsage.usedThisMonth / c.aiUsage.monthlyQuota * 100);
              const warn = pct >= 85;
              return (
                <tr key={c.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                  <td className="px-4 py-2.5"><Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors">{c.name}</Link></td>
                  <td className="px-4 py-2.5 text-ink-muted">{c.aiUsage.monthlyQuota.toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                        <div className={`h-full rounded-full ${warn ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className={`text-xs ${warn ? 'text-warning font-medium' : 'text-ink-muted'}`}>%{pct}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge tone={c.aiUsage.overagePolicy === 'block' ? 'neutral' : 'accent'}>
                      {c.aiUsage.overagePolicy === 'block' ? 'Durdur' : 'İzin ver'}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink">€{c.aiUsage.estimatedCostEur}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { adminClinics } from '../../data/adminDemoData';

export default function BillingPage() {
  const overdue = adminClinics.filter(c => c.billing.status === 'overdue');
  const others = adminClinics.filter(c => c.billing.status !== 'overdue');
  const mrr = adminClinics.filter(c => c.billing.status === 'current').reduce((sum, c) => {
    return sum + (c.billing.periodicity === 'annual' ? c.billing.amountEur / 12 : c.billing.amountEur);
  }, 0);
  const arr = mrr * 12;

  const rows = [...overdue, ...others];

  return (
    <div className="space-y-4">
      <AppMeta title="Faturalama | CareNova Platform" />
      <div>
        <h1 className="text-xl font-semibold text-ink">Faturalama</h1>
        <p className="text-ink-muted text-sm mt-0.5">Gecikenler üstte listelenir.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-ink-subtle uppercase tracking-wide mb-1">MRR (demo)</p>
          <p className="font-display text-2xl text-ink">€{Math.round(mrr).toLocaleString('tr-TR')}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-ink-subtle uppercase tracking-wide mb-1">ARR (demo)</p>
          <p className="font-display text-2xl text-ink">€{Math.round(arr).toLocaleString('tr-TR')}</p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Klinik</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Dönem</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle text-right">Tutar</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Durum</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Sonraki Tahsilat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                <td className="px-4 py-2.5"><Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors">{c.name}</Link></td>
                <td className="px-4 py-2.5 text-ink-muted">{c.billing.periodicity === 'annual' ? 'Yıllık' : 'Aylık'}</td>
                <td className="px-4 py-2.5 text-right text-ink">€{c.billing.amountEur}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge tone={c.billing.status === 'current' ? 'success' : c.billing.status === 'overdue' ? 'danger' : 'warning'}>
                    {c.billing.status === 'current' ? 'Güncel' : c.billing.status === 'overdue' ? 'Gecikmiş' : 'Deneme'}
                  </StatusBadge>
                </td>
                <td className="px-4 py-2.5 text-ink-subtle text-xs">{new Date(c.billing.nextChargeAt).toLocaleDateString('tr-TR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

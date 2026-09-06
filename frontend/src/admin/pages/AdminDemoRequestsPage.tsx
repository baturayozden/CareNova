import React, { useState } from 'react';
import { Download } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { adminDemoRequests } from '../../data/adminDemoData';
import { BRANCH_LABELS } from '../../data/adminDemoData';

const STATUS_LABEL: Record<string, string> = {
  new: 'Yeni', contacted: 'İletişime geçildi', demo_done: 'Demo yapıldı', won: 'Kazanıldı', lost: 'Kaybedildi',
};
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> = {
  new: 'accent', contacted: 'warning', demo_done: 'neutral', won: 'success', lost: 'danger',
};

function toCsv(rows: typeof adminDemoRequests): string {
  const header = 'Ad,E-posta,Klinik,Şehir,Branş,Telefon,Tarih,Durum,Not';
  const lines = rows.map(r => [r.name, r.email, r.clinic, r.city, BRANCH_LABELS[r.branch] || r.branch, r.phone, r.createdAt, STATUS_LABEL[r.status], r.note].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [header, ...lines].join('\n');
}

export default function AdminDemoRequestsPage() {
  const [requests] = useState(adminDemoRequests);

  const exportCsv = () => {
    const blob = new Blob([toCsv(requests)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'demo-talepleri.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <AppMeta title="Demo Talepleri | CareNova Platform" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Demo Talepleri</h1>
          <p className="text-ink-muted text-sm mt-0.5">{requests.length} talep — landing formundan.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors">
          <Download size={14} strokeWidth={1.75} aria-hidden="true" /> CSV dışa aktar
        </button>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Ad</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Klinik</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Şehir</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Branş</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Telefon</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Tarih</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Durum</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Not</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r, i) => (
              <tr key={r.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-ink">{r.name}</p>
                  <p className="text-ink-subtle text-xs">{r.email}</p>
                </td>
                <td className="px-4 py-2.5 text-ink-muted">{r.clinic}</td>
                <td className="px-4 py-2.5 text-ink-muted">{r.city}</td>
                <td className="px-4 py-2.5 text-ink-muted">{BRANCH_LABELS[r.branch] || r.branch}</td>
                <td className="px-4 py-2.5 text-ink-muted">{r.phone}</td>
                <td className="px-4 py-2.5 text-ink-subtle text-xs">{new Date(r.createdAt).toLocaleDateString('tr-TR')}</td>
                <td className="px-4 py-2.5"><StatusBadge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusBadge></td>
                <td className="px-4 py-2.5 text-ink-muted text-xs max-w-[160px] truncate" title={r.note}>{r.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

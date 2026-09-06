import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { adminClinics, DEMO_NOW_MS } from '../../data/adminDemoData';

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const mins = Math.round((DEMO_NOW_MS - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

export default function WhatsappPage() {
  const [testedId, setTestedId] = useState<string | null>(null);
  const rows = [...adminClinics].sort((a, b) => {
    const aProblem = !a.whatsapp.connected || a.whatsapp.errorsLast24h > 0;
    const bProblem = !b.whatsapp.connected || b.whatsapp.errorsLast24h > 0;
    return aProblem === bProblem ? 0 : aProblem ? -1 : 1;
  });

  return (
    <div className="space-y-4">
      <AppMeta title="WhatsApp Hatları | CareNova Platform" />
      <div>
        <h1 className="text-xl font-semibold text-ink">WhatsApp Hatları</h1>
        <p className="text-ink-muted text-sm mt-0.5">Sorunlu hatlar üstte listelenir.</p>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Klinik</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Görünen Numara</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Durum</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Son Webhook Başarısı</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle text-right">Son 24s Mesaj</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle text-right">Son 24s Hata</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                <td className="px-4 py-2.5"><Link to={`/admin/clinics/${c.id}`} className="font-medium text-ink hover:text-accent transition-colors">{c.name}</Link></td>
                <td className="px-4 py-2.5 text-ink-muted">{c.whatsapp.displayNumber || '—'}</td>
                <td className="px-4 py-2.5">{c.whatsapp.connected ? <StatusBadge tone="success">Bağlı</StatusBadge> : <StatusBadge tone="danger">Bağlı değil</StatusBadge>}</td>
                <td className="px-4 py-2.5 text-ink-subtle text-xs">{timeAgo(c.whatsapp.lastWebhookSuccessAt)}</td>
                <td className="px-4 py-2.5 text-right text-ink">{c.whatsapp.messagesLast24h}</td>
                <td className="px-4 py-2.5 text-right">
                  {c.whatsapp.errorsLast24h > 0 ? <span className="text-danger font-medium">{c.whatsapp.errorsLast24h}</span> : <span className="text-ink-muted">0</span>}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => setTestedId(c.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors"
                  >
                    {testedId === c.id && <Check size={12} strokeWidth={2.5} className="text-success" aria-hidden="true" />}
                    {testedId === c.id ? 'Test başarılı (demo)' : 'Webhook testi'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

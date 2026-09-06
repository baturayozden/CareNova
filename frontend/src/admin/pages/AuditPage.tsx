import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Lock } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import { adminAuditEvents } from '../../data/adminDemoData';

function toCsv(rows: typeof adminAuditEvents): string {
  const header = 'Kim,Ne yaptı,Klinik,Ne zaman';
  const lines = rows.map(r => [r.actor, r.action, r.clinicName || '—', r.at].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [header, ...lines].join('\n');
}

export default function AuditPage() {
  const [clinicFilter, setClinicFilter] = useState('all');
  const clinics = useMemo(() => Array.from(new Set(adminAuditEvents.filter(e => e.clinicName).map(e => e.clinicName!))), []);
  const rows = useMemo(() => {
    const filtered = clinicFilter === 'all' ? adminAuditEvents : adminAuditEvents.filter(e => e.clinicName === clinicFilter);
    return [...filtered].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [clinicFilter]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'denetim-kaydi.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <AppMeta title="Denetim Kaydı | CareNova Platform" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Denetim Kaydı</h1>
          <div className="flex items-center gap-1.5 text-ink-subtle text-xs mt-1">
            <Lock size={12} strokeWidth={2} aria-hidden="true" />
            <span>Append-only — bu kayıtlar silinemez (KVKK denetim izi).</span>
          </div>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors">
          <Download size={14} strokeWidth={1.75} aria-hidden="true" /> CSV dışa aktar
        </button>
      </div>

      <select value={clinicFilter} onChange={(e) => setClinicFilter(e.target.value)} className="rounded-lg border border-line bg-surface text-sm text-ink px-3 py-1.5">
        <option value="all">Tüm klinikler</option>
        {clinics.map(name => <option key={name} value={name}>{name}</option>)}
      </select>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Kim</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Ne yaptı</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Klinik</th>
              <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Ne zaman</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => (
              <tr key={e.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                <td className="px-4 py-2.5 font-medium text-ink">{e.actor}</td>
                <td className="px-4 py-2.5 text-ink-muted">{e.action}</td>
                <td className="px-4 py-2.5">
                  {e.clinicId ? <Link to={`/admin/clinics/${e.clinicId}`} className="text-accent hover:underline">{e.clinicName}</Link> : <span className="text-ink-subtle">—</span>}
                </td>
                <td className="px-4 py-2.5 text-ink-subtle text-xs">{new Date(e.at).toLocaleString('tr-TR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

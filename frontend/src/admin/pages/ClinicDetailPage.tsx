import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Eye, CheckCircle2, PauseCircle, PlusCircle, ArrowLeftRight } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { adminClinics, adminAuditEvents, BRANCH_LABELS, PLAN_LABELS, ONBOARDING_STEPS } from '../../data/adminDemoData';
import { useImpersonation } from '../ImpersonationContext';

const TABS = ['Genel', 'Kullanıcılar', 'WhatsApp', 'AI Kullanım', 'Faturalama', 'Uyum', 'Denetim'] as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-subtle mb-0.5">{label}</p>
      <p className="text-sm text-ink font-medium">{value}</p>
    </div>
  );
}

export default function ClinicDetailPage() {
  const { id } = useParams();
  const clinic = adminClinics.find(c => c.id === id);
  const [tab, setTab] = useState<typeof TABS[number]>('Genel');
  const [impersonateReason, setImpersonateReason] = useState('');
  const [showImpersonateForm, setShowImpersonateForm] = useState(false);
  const { session, start } = useImpersonation();

  if (!clinic) {
    return (
      <div className="text-center py-12">
        <p className="text-ink-muted text-sm">Klinik bulunamadı.</p>
        <Link to="/admin/clinics" className="text-accent text-sm hover:underline">← Klinik listesine dön</Link>
      </div>
    );
  }

  const auditForClinic = adminAuditEvents.filter(e => e.clinicId === clinic.id);
  const isImpersonatingThis = session?.clinicId === clinic.id;

  return (
    <div className="space-y-5">
      <AppMeta title={`${clinic.name} | CareNova Platform`} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/clinics" className="text-xs text-ink-subtle hover:text-ink transition-colors">← Klinikler</Link>
          <h1 className="text-xl font-semibold text-ink mt-1">{clinic.name}</h1>
          <p className="text-ink-muted text-sm">{clinic.legalName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors">
            <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true" /> Onayla
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft transition-colors">
            <PauseCircle size={14} strokeWidth={1.75} aria-hidden="true" /> Askıya al
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors">
            <ArrowLeftRight size={14} strokeWidth={1.75} aria-hidden="true" /> Plan değiştir
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors">
            <PlusCircle size={14} strokeWidth={1.75} aria-hidden="true" /> Kota ekle
          </button>
          {isImpersonatingThis ? (
            <StatusBadge tone="warning">Şu an görüntülüyorsunuz</StatusBadge>
          ) : (
            <button
              onClick={() => setShowImpersonateForm(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
            >
              <Eye size={14} strokeWidth={1.75} aria-hidden="true" /> Klinik olarak görüntüle
            </button>
          )}
        </div>
      </div>

      {showImpersonateForm && !isImpersonatingThis && (
        <div className="rounded-xl border border-accent/30 bg-accent-soft p-4">
          <p className="text-sm font-medium text-ink mb-2">Görüntüleme gerekçesi (zorunlu)</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={impersonateReason}
              onChange={(e) => setImpersonateReason(e.target.value)}
              placeholder="Örn: Destek talebi #4821 — WhatsApp bağlantı sorunu inceleniyor"
              className="flex-1 min-w-[240px] rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
            />
            <button
              disabled={!impersonateReason.trim()}
              onClick={() => { start(clinic.id, impersonateReason); setShowImpersonateForm(false); setImpersonateReason(''); }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Başlat
            </button>
          </div>
          <p className="text-xs text-ink-muted mt-2">Aktifken tüm yazma işlemleri salt-okunura döner ve denetim kaydına düşer.</p>
        </div>
      )}

      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Genel' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label="Unvan" value={clinic.legalName} />
          <Field label="Yetki Belgesi No" value={clinic.licenseNumber || '—'} />
          <Field label="Şehir" value={clinic.city} />
          <Field label="Branşlar" value={clinic.branches.map(b => BRANCH_LABELS[b]).join(', ')} />
          <Field label="Plan" value={PLAN_LABELS[clinic.plan]} />
          <Field label="İletişim" value={<>{clinic.contactEmail}<br />{clinic.contactPhone}</>} />
          <Field label="Saat Dilimi" value={clinic.timezone} />
          <Field label="Para Birimi" value={clinic.currency} />
          <Field label="Onboarding Adımı" value={`${clinic.onboarding.step}/7 — ${ONBOARDING_STEPS[Math.min(clinic.onboarding.step, 7) - 1] || 'Canlı'}`} />
        </div>
      )}

      {tab === 'Kullanıcılar' && (
        <div className="rounded-xl border border-line bg-surface p-5">
          <p className="text-sm text-ink-muted">{clinic.userCount} kullanıcı. Detaylı kullanıcı listesi ve rol yönetimi için bkz. <Link to="/admin/users" className="text-accent hover:underline">Kullanıcılar</Link>.</p>
        </div>
      )}

      {tab === 'WhatsApp' && (
        <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label="Görünen Numara" value={clinic.whatsapp.displayNumber || '—'} />
          <Field label="Bağlantı Durumu" value={clinic.whatsapp.connected ? <StatusBadge tone="success">Bağlı</StatusBadge> : <StatusBadge tone="danger">Bağlı değil</StatusBadge>} />
          <Field label="Son 24s Mesaj" value={clinic.whatsapp.messagesLast24h} />
          <Field label="Son 24s Hata" value={clinic.whatsapp.errorsLast24h} />
        </div>
      )}

      {tab === 'AI Kullanım' && (
        <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label="Aylık Kota" value={clinic.aiUsage.monthlyQuota.toLocaleString('tr-TR')} />
          <Field label="Kullanılan" value={`${clinic.aiUsage.usedThisMonth.toLocaleString('tr-TR')} (%${Math.round(clinic.aiUsage.usedThisMonth / clinic.aiUsage.monthlyQuota * 100)})`} />
          <Field label="Aşım Politikası" value={clinic.aiUsage.overagePolicy === 'block' ? 'Durdur' : 'İzin ver'} />
          <Field label="Tahmini Maliyet (bu ay)" value={`€${clinic.aiUsage.estimatedCostEur}`} />
        </div>
      )}

      {tab === 'Faturalama' && (
        <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label="Dönem" value={clinic.billing.periodicity === 'annual' ? 'Yıllık' : 'Aylık'} />
          <Field label="Tutar" value={`€${clinic.billing.amountEur}`} />
          <Field label="Durum" value={clinic.billing.status === 'current' ? <StatusBadge tone="success">Güncel</StatusBadge> : clinic.billing.status === 'overdue' ? <StatusBadge tone="danger">Gecikmiş</StatusBadge> : <StatusBadge tone="warning">Deneme</StatusBadge>} />
          <Field label="Sonraki Tahsilat" value={new Date(clinic.billing.nextChargeAt).toLocaleDateString('tr-TR')} />
        </div>
      )}

      {tab === 'Uyum' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-xl border border-line bg-surface p-5">
          <Field label="Yetki Belgesi" value={clinic.compliance.licenseOnFile ? <StatusBadge tone="success">Var</StatusBadge> : <StatusBadge tone="danger">Yok</StatusBadge>} />
          <Field label="Komplikasyon Sigortası" value={clinic.compliance.complicationInsurance ? <StatusBadge tone="success">Var</StatusBadge> : <StatusBadge tone="danger">Yok</StatusBadge>} />
          <Field label="VERBİS Kaydı" value={clinic.compliance.verbisRegistered ? <StatusBadge tone="success">Var</StatusBadge> : <StatusBadge tone="danger">Yok</StatusBadge>} />
          <Field label="Yabancı Dil Personel Oranı" value={`%${clinic.compliance.foreignLanguageStaffRatio}`} />
          <Field label="Ek-1 Onam (toplam / geri alınan)" value={`${clinic.compliance.ek1TotalConsents} / ${clinic.compliance.ek1RevokedConsents}`} />
          <Field label="Onamsız Görsel" value={clinic.compliance.ek1HasUnconsentedMedia ? <StatusBadge tone="danger">Var</StatusBadge> : <StatusBadge tone="success">Yok</StatusBadge>} />
          <Field label="Yurt Dışı Aktarım Bildirimi" value={clinic.compliance.crossBorderNotified ? <StatusBadge tone="success">Yapıldı</StatusBadge> : <StatusBadge tone="danger">Yapılmadı</StatusBadge>} />
        </div>
      )}

      {tab === 'Denetim' && (
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Kim</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Ne yaptı</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">Ne zaman</th>
              </tr>
            </thead>
            <tbody>
              {auditForClinic.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-ink-muted text-sm">Bu klinik için kayıt yok.</td></tr>
              ) : auditForClinic.map(e => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 text-ink">{e.actor}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{e.action}</td>
                  <td className="px-4 py-2.5 text-ink-subtle text-xs">{new Date(e.at).toLocaleString('tr-TR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

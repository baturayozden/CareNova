import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Lock, Mic, Image as ImageIcon, Check } from 'lucide-react';
import AppMeta from '../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { cases, CaseStatus, CASE_STATUS_LABELS } from '../data/caseData';

const STATUS_TONE: Record<CaseStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> = {
  new: 'neutral', qualified: 'accent', pre_assessment: 'warning', awaiting_doctor: 'warning',
  quoted: 'accent', awaiting_deposit: 'accent', reserved: 'success', travel_planned: 'success',
  arrived: 'success', treated: 'success', returned: 'success', in_aftercare: 'success',
  completed: 'success', lost: 'danger', medically_ineligible: 'danger',
};

type TabKey = 'summary' | 'chat' | 'medical' | 'quote' | 'travel' | 'aftercare' | 'audit';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function CaseFileDetailPage() {
  const { t } = useTranslation('cases');
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<TabKey>('summary');
  const item = cases.find(c => c.id === id);

  if (!item) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <AppMeta title={`${t('listTitle')} | CareNova`} />
        <Link to="/cases" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-accent">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />{t('backToList')}
        </Link>
        <p className="text-ink-subtle mt-6">{t('noResults')}</p>
      </div>
    );
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'summary', label: t('tabs.summary') },
    { key: 'chat', label: t('tabs.chat') },
    { key: 'medical', label: t('tabs.medical') },
    { key: 'quote', label: t('tabs.quote') },
    { key: 'travel', label: t('tabs.travel') },
    { key: 'aftercare', label: t('tabs.aftercare') },
    { key: 'audit', label: t('tabs.audit') },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <AppMeta title={`${item.patientName} | ${t('listTitle')} | CareNova`} />
        <div>
          <Link to="/cases" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-accent mb-3">
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />{t('backToList')}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden="true">{item.patientCountryFlag}</span>
              <div>
                <h1 className="text-xl font-semibold text-ink">{item.patientName}</h1>
                <p className="text-ink-subtle text-xs">{item.caseNumber} · {item.patientCountry}</p>
              </div>
            </div>
            <StatusBadge tone={STATUS_TONE[item.status]}>{CASE_STATUS_LABELS[item.status]}</StatusBadge>
          </div>
        </div>

        <div className="border-b border-line flex flex-wrap gap-1 -mb-px overflow-x-auto">
          {TABS.map(tabDef => (
            <button
              key={tabDef.key}
              onClick={() => setTab(tabDef.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === tabDef.key ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {tabDef.label}
            </button>
          ))}
        </div>

        {tab === 'summary' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink mb-3">{t('summary.patient')}</h2>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-muted">{t('summary.estimatedValue')}</dt><dd className="text-ink font-medium">€{item.estimatedValueEur.toLocaleString('tr-TR')}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">{t('summary.companions')}</dt><dd className="text-ink">{item.companions.length ? item.companions.map(c => `${c.name} (${c.relation})`).join(', ') : t('summary.noCompanions')}</dd></div>
              </dl>
              <h3 className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mt-4 mb-2">{t('summary.assigned')}</h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-muted">{t('summary.consultant')}</dt><dd className="text-ink">{item.assignedConsultant ?? t('notAssigned')}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">{t('summary.doctor')}</dt><dd className="text-ink">{item.assignedDoctor ?? t('notAssigned')}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">{t('summary.coordinator')}</dt><dd className="text-ink">{item.assignedCoordinator ?? t('notAssigned')}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-muted">{t('summary.interpreter')}</dt><dd className="text-ink">{item.assignedInterpreter ?? t('notAssigned')}</dd></div>
              </dl>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink mb-3">{t('summary.timeline')}</h2>
              <ol className="space-y-3">
                {item.timeline.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-ink font-medium">{CASE_STATUS_LABELS[step.status]}</p>
                      <p className="text-ink-subtle text-xs">{fmtDateTime(step.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {tab === 'chat' && (
          <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
            {item.messages.length === 0 && <p className="text-ink-subtle text-sm">{t('chat.empty')}</p>}
            {item.messages.map((m, i) => (
              <div key={i} className={`flex ${m.side === 'out' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-md rounded-xl px-3.5 py-2.5 text-sm ${m.side === 'out' ? 'bg-accent-soft text-ink' : 'bg-surface-sunken text-ink'}`}>
                  <p>{m.text}</p>
                  {m.translation && (
                    <p className="mt-1.5 pt-1.5 border-t border-line/60 text-ink-muted text-xs">
                      <span className="font-medium">{t('chat.translation')}: </span>{m.translation}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    {m.hasVoiceNote && <span className="inline-flex items-center gap-1 text-xs text-ink-subtle"><Mic size={12} strokeWidth={1.75} aria-hidden="true" />{t('chat.voiceNote')}</span>}
                    {m.hasPhoto && <span className="inline-flex items-center gap-1 text-xs text-ink-subtle"><ImageIcon size={12} strokeWidth={1.75} aria-hidden="true" />{t('chat.photo')}</span>}
                    <span className="text-[11px] text-ink-subtle ml-auto">{fmtDateTime(m.at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'medical' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink mb-3">{t('medical.preAssessment')}</h2>
              {item.medicalFile.preAssessment.length === 0 ? (
                <p className="text-ink-subtle text-sm">—</p>
              ) : (
                <dl className="space-y-1.5 text-sm">
                  {item.medicalFile.preAssessment.map((qa, i) => (
                    <div key={i} className="flex justify-between gap-4"><dt className="text-ink-muted">{qa.q}</dt><dd className="text-ink font-medium text-right">{qa.a}</dd></div>
                  ))}
                </dl>
              )}
              <p className="text-ink-muted text-sm mt-3">{t('medical.images')}: <span className="text-ink font-medium">{item.medicalFile.uploadedImages || t('medical.noImages')}</span></p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold text-ink mb-2">{t('medical.doctorDecision')}</h2>
              <p className="text-ink font-medium mb-2">{t(`medical.decision.${item.medicalFile.doctorDecision}`)}</p>
              {item.medicalFile.doctorNote && <p className="text-ink-muted text-sm">{t('medical.doctorNote')}: {item.medicalFile.doctorNote}</p>}
            </div>
            {item.medicalFile.aiExtraction && (
              <div className="rounded-xl border border-warning/30 bg-warning-soft p-4">
                <p className="text-xs font-semibold text-warning uppercase tracking-wide mb-1">{t('medical.aiNote')}</p>
                <p className="text-sm text-ink">{item.medicalFile.aiExtraction}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'quote' && (
          <div className="space-y-3">
            {item.quotes.length === 0 && <p className="text-ink-subtle text-sm">{t('quote.empty')}</p>}
            {item.quotes.map(q => (
              <div key={q.version} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-ink">{t('quote.version')} {q.version}</h3>
                  <div className="flex items-center gap-2">
                    {q.locked && <span className="inline-flex items-center gap-1 text-xs text-ink-subtle"><Lock size={12} strokeWidth={1.75} aria-hidden="true" />{t('quote.locked')}</span>}
                    <span className="text-sm font-semibold text-ink">€{q.amountEur.toLocaleString('tr-TR')}</span>
                  </div>
                </div>
                <p className="text-xs text-ink-subtle uppercase tracking-wide mb-1">{t('quote.items')}</p>
                <ul className="text-sm text-ink-muted list-disc list-inside space-y-0.5">
                  {q.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
                {q.changeReason && <p className="text-xs text-ink-subtle mt-2">{t('quote.changeReason')}: {q.changeReason}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === 'travel' && (
          !item.travel ? (
            <p className="text-ink-subtle text-sm">{t('travel.empty')}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-line bg-surface p-4"><p className="text-xs text-ink-subtle uppercase tracking-wide mb-1">{t('travel.flight')}</p><p className="text-sm text-ink">{item.travel.flight}</p></div>
                <div className="rounded-xl border border-line bg-surface p-4"><p className="text-xs text-ink-subtle uppercase tracking-wide mb-1">{t('travel.hotel')}</p><p className="text-sm text-ink">{item.travel.hotel}</p></div>
                <div className="rounded-xl border border-line bg-surface p-4"><p className="text-xs text-ink-subtle uppercase tracking-wide mb-1">{t('travel.transfer')}</p><p className="text-sm text-ink">{item.travel.transfer}</p></div>
              </div>
              <div className="rounded-xl border border-line bg-surface p-4">
                <h2 className="text-sm font-semibold text-ink mb-3">{t('travel.itinerary')}</h2>
                <ol className="space-y-2">
                  {item.travel.itinerary.map((d, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="text-ink-subtle w-16 shrink-0">{d.day}</span>
                      <span className="text-ink">{d.plan}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )
        )}

        {tab === 'aftercare' && (
          <div className="rounded-xl border border-line bg-surface divide-y divide-line">
            {item.aftercare.length === 0 && <p className="text-ink-subtle text-sm p-4">{t('aftercare.empty')}</p>}
            {item.aftercare.map((tp, i) => (
              <div key={i} className="p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{tp.day}</p>
                  <p className="text-ink-muted text-sm mt-0.5">{tp.response ?? t('aftercare.notContacted')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs text-ink-subtle">
                  {tp.contactedAt && <span>{fmtDateTime(tp.contactedAt)}</span>}
                  {tp.photoUploaded && <span className="inline-flex items-center gap-1 text-success"><Check size={12} strokeWidth={2} aria-hidden="true" />{t('aftercare.photo')}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'audit' && (
          <div className="rounded-xl border border-line bg-surface divide-y divide-line">
            {item.auditLog.length === 0 && <p className="text-ink-subtle text-sm p-4">{t('audit.empty')}</p>}
            {item.auditLog.map((e, i) => (
              <div key={i} className="p-4 flex items-center justify-between gap-3 text-sm">
                <div><span className="text-ink font-medium">{e.actor}</span><span className="text-ink-muted"> — {e.action}</span></div>
                <span className="text-ink-subtle text-xs shrink-0">{fmtDateTime(e.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

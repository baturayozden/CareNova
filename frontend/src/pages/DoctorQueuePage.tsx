import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Image as ImageIcon, ShieldAlert } from 'lucide-react';
import AppMeta from '../components/AppMeta';
import { cases, DEMO_NOW_MS } from '../data/caseData';

// GECE-2-BRIEFI.md Bölüm D.3 — mobile-first, doctor role's default landing
// page. 🔴 AI's visual inference (Norwood estimate etc., stored in
// medicalFile.aiExtraction) is rendered ONLY on this page and the case-file
// Tıbbi dosya tab (both clinic-internal, doctor/staff-only routes) — never
// on any patient-facing surface. No quote can be issued without a decision
// recorded here (medicalFile.doctorDecision starts 'pending').

const BRANCH_LABELS: Record<string, string> = {
  hair_transplant: 'Saç Ekimi', dental: 'Diş', aesthetic_surgery: 'Estetik Cerrahi',
  eye_lasik: 'Göz (Lasik)', bariatric: 'Bariatrik', ivf: 'Tüp Bebek', orthopedics: 'Ortopedi',
  cardiology: 'Kardiyoloji', oncology: 'Onkoloji', checkup: 'Check-up',
};

type Decision = 'eligible' | 'conditional' | 'ineligible';

function waitingSince(iso: string): string {
  const hours = Math.round((DEMO_NOW_MS - new Date(iso).getTime()) / 3600000);
  if (hours < 24) return `${hours} sa`;
  return `${Math.round(hours / 24)} gün`;
}

function DoctorDecisionCard({ item }: { item: (typeof cases)[number] }) {
  const { t } = useTranslation('cases');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [graftCount, setGraftCount] = useState('');
  const [implantCount, setImplantCount] = useState('');
  const [priceBand, setPriceBand] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const isHair = item.branch === 'hair_transplant';
  const isDental = item.branch === 'dental';
  const redFlag = item.medicalFile.preAssessment.some(qa => /kronik|risk/i.test(qa.q) && !/yok/i.test(qa.a));

  return (
    <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">{item.patientCountryFlag}</span>
            <Link to={`/cases/${item.id}`} className="font-medium text-ink hover:text-accent">{item.patientName}</Link>
          </div>
          <p className="text-ink-subtle text-xs mt-0.5">{item.patientCountry} · {item.patientAge} yaş · {BRANCH_LABELS[item.branch] ?? item.branch}</p>
        </div>
        <span className="text-xs text-ink-subtle shrink-0">{t('doctorQueue.waiting')}: {waitingSince(item.timeline[item.timeline.length - 1].at)}</span>
      </div>

      {redFlag && (
        <div className="flex items-start gap-2 rounded-lg bg-danger-soft border border-danger/30 px-3 py-2">
          <AlertTriangle size={16} strokeWidth={1.75} className="text-danger shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-danger">Hasta geçmişinde dikkat gerektiren bir işaret var.</p>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <ImageIcon size={16} strokeWidth={1.75} aria-hidden="true" />
        {item.medicalFile.uploadedImages > 0 ? `${item.medicalFile.uploadedImages} görsel` : t('doctorQueue.noImages')}
      </div>

      {item.medicalFile.aiExtraction && (
        <div className="rounded-lg bg-warning-soft border border-warning/30 px-3 py-2.5">
          <p className="text-xs font-semibold text-warning uppercase tracking-wide mb-1 flex items-center gap-1.5">
            <ShieldAlert size={13} strokeWidth={1.75} aria-hidden="true" />{t('doctorQueue.aiSummary')}
          </p>
          <p className="text-sm text-ink">{item.medicalFile.aiExtraction}</p>
        </div>
      )}

      {item.medicalFile.preAssessment.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1.5">{t('doctorQueue.preAssessment')}</p>
          <dl className="space-y-1 text-sm">
            {item.medicalFile.preAssessment.map((qa, i) => (
              <div key={i} className="flex justify-between gap-4"><dt className="text-ink-muted">{qa.q}</dt><dd className="text-ink font-medium text-right">{qa.a}</dd></div>
            ))}
          </dl>
        </div>
      )}

      <div className="border-t border-line pt-3 space-y-3">
        <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide">{t('doctorQueue.decision')}</p>
        <div className="flex gap-2">
          {(['eligible', 'conditional', 'ineligible'] as Decision[]).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDecision(d)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                decision === d
                  ? d === 'eligible' ? 'bg-success text-white border-success' : d === 'conditional' ? 'bg-warning text-white border-warning' : 'bg-danger text-white border-danger'
                  : 'border-line text-ink-muted hover:border-line-strong'
              }`}
            >
              {t(`doctorQueue.${d}`)}
            </button>
          ))}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('doctorQueue.notePlaceholder') ?? undefined}
          rows={2}
          className="w-full rounded-lg border border-line bg-surface-page px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent resize-none"
        />

        {decision === 'eligible' && (
          <div className="grid grid-cols-2 gap-2">
            {isHair && (
              <input
                value={graftCount}
                onChange={(e) => setGraftCount(e.target.value)}
                placeholder={t('doctorQueue.graftCount') ?? undefined}
                className="rounded-lg border border-line bg-surface-page px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
              />
            )}
            {isDental && (
              <input
                value={implantCount}
                onChange={(e) => setImplantCount(e.target.value)}
                placeholder={t('doctorQueue.implantCount') ?? undefined}
                className="rounded-lg border border-line bg-surface-page px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent"
              />
            )}
            <input
              value={priceBand}
              onChange={(e) => setPriceBand(e.target.value)}
              placeholder={t('doctorQueue.priceBandPlaceholder') ?? undefined}
              className={`rounded-lg border border-line bg-surface-page px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent ${(isHair || isDental) ? '' : 'col-span-2'}`}
            />
          </div>
        )}

        <p className="text-xs text-ink-subtle">{t('doctorQueue.noQuoteWarning')}</p>

        <button
          type="button"
          disabled={!decision}
          onClick={() => setSubmitted(true)}
          className="w-full py-2 rounded-lg text-sm font-medium bg-accent text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
        >
          {submitted ? t('doctorQueue.submitted') : t('doctorQueue.submit')}
        </button>
      </div>
    </div>
  );
}

export default function DoctorQueuePage() {
  const { t } = useTranslation('cases');
  const queue = cases.filter(c => c.status === 'awaiting_doctor');

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <AppMeta title={`${t('doctorQueue.title')} | CareNova`} />
        <div>
          <h1 className="text-xl font-semibold text-ink">{t('doctorQueue.title')}</h1>
          <p className="text-ink-muted text-sm mt-0.5">{t('doctorQueue.subtitle')}</p>
        </div>

        {queue.length === 0 ? (
          <p className="text-ink-subtle text-sm">{t('doctorQueue.empty')}</p>
        ) : (
          <div className="space-y-4">
            {queue.map(item => <DoctorDecisionCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}

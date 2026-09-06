import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Image as ImageIcon, ShieldAlert, X, CheckCircle2 } from 'lucide-react';
import AppMeta from '../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { cases, CaseFile, DEMO_NOW_MS } from '../data/caseData';

// GECE-2-BRIEFI.md Bölüm D.3, derinleştirildi GECE-3-BRIEFI.md Bölüm D
// (Bulgu 4): mobile-first, doctor role's default landing page. 🔴 AI's
// visual inference (Norwood estimate etc., stored in medicalFile.
// aiExtraction) is rendered ONLY on this page and the case-file Tıbbi
// dosya tab (both clinic-internal, doctor/staff-only routes) — never on
// any patient-facing surface. No quote can be issued without a decision
// recorded here (medicalFile.doctorDecision starts 'pending').

const BRANCH_LABELS: Record<string, string> = {
  hair_transplant: 'Saç Ekimi', dental: 'Diş', aesthetic_surgery: 'Estetik Cerrahi',
  eye_lasik: 'Göz (Lasik)', bariatric: 'Bariatrik', ivf: 'Tüp Bebek', orthopedics: 'Ortopedi',
  cardiology: 'Kardiyoloji', oncology: 'Onkoloji', checkup: 'Check-up',
};

type Decision = 'eligible' | 'conditional' | 'ineligible';

function waitingSince(iso: string): string {
  const mins = Math.round((DEMO_NOW_MS - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} dk`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} sa`;
  return `${Math.round(hours / 24)} gün`;
}

function ImageGalleryModal({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-surface rounded-xl p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-ink">{label}</p>
          <button onClick={onClose} aria-label="Kapat" className="text-ink-subtle hover:text-ink">
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        {/* Demo-only placeholder — no real patient photo files exist in this
            environment; a fabricated "realistic" image would be more
            misleading than an honest placeholder tile. */}
        <div className="aspect-square rounded-lg bg-surface-sunken flex flex-col items-center justify-center gap-2 text-ink-subtle">
          <ImageIcon size={40} strokeWidth={1.25} aria-hidden="true" />
          <span className="text-xs">{label} (demo — gerçek görsel yok)</span>
        </div>
      </div>
    </div>
  );
}

function ImageGallery({ item }: { item: CaseFile }) {
  const { t } = useTranslation('cases');
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const slots = item.medicalFile.imageSlots;
  if (!slots || slots.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <ImageIcon size={16} strokeWidth={1.75} aria-hidden="true" />
        {t('doctorQueue.noImages')}
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {slots.map((slotLabel, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpenSlot(slotLabel)}
            className="aspect-square rounded-lg bg-surface-sunken border border-line flex flex-col items-center justify-center gap-1 text-ink-subtle hover:border-accent/50 transition-colors"
          >
            <ImageIcon size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="text-[9px] text-center px-0.5 leading-tight">{slotLabel}</span>
          </button>
        ))}
      </div>
      {openSlot && <ImageGalleryModal label={openSlot} onClose={() => setOpenSlot(null)} />}
    </>
  );
}

function DoctorDecisionCard({ item }: { item: CaseFile }) {
  const { t } = useTranslation('cases');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [graftCount, setGraftCount] = useState('');
  const [implantCount, setImplantCount] = useState('');
  const [procedures, setProcedures] = useState('');
  const [priceBand, setPriceBand] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const isHair = item.branch === 'hair_transplant';
  const isDental = item.branch === 'dental';
  const isAesthetic = item.branch === 'aesthetic_surgery';
  const needsScope = decision === 'eligible' || decision === 'conditional';
  const redFlags = item.medicalFile.redFlags ?? [];

  const scopeFilled = !needsScope || Boolean(
    (isHair ? graftCount : isDental ? implantCount : isAesthetic ? procedures : priceBand) && priceBand,
  );
  const noteFilled = decision !== 'ineligible' || note.trim().length > 0;
  const canSubmit = decision !== null && scopeFilled && noteFilled;

  function handleSubmit() {
    setAttempted(true);
    if (!canSubmit) return;
    setSubmitted(true);
  }

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

      {redFlags.map((flag, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg bg-danger-soft border border-danger/30 px-3 py-2">
          <AlertTriangle size={16} strokeWidth={1.75} className="text-danger shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-danger">{flag}</p>
        </div>
      ))}

      <ImageGallery item={item} />

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

      {submitted ? (
        <div className="border-t border-line pt-3">
          <div className="flex items-center gap-2 rounded-lg bg-success-soft border border-success/30 px-3 py-2.5">
            <CheckCircle2 size={16} strokeWidth={1.75} className="text-success shrink-0" aria-hidden="true" />
            <p className="text-sm text-success font-medium">
              {decision === 'ineligible' ? t('doctorQueue.submitted') : t('doctorQueue.readyForQuote')}
            </p>
          </div>
        </div>
      ) : (
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

          <div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={(decision === 'ineligible' ? t('doctorQueue.notePlaceholderRequired') : t('doctorQueue.notePlaceholder')) ?? undefined}
              rows={2}
              className={`w-full rounded-lg border bg-surface-page px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent resize-none ${
                attempted && !noteFilled ? 'border-danger' : 'border-line'
              }`}
            />
            {attempted && !noteFilled && <p className="text-xs text-danger mt-1">{t('doctorQueue.noteRequiredError')}</p>}
          </div>

          {needsScope && (
            <div>
              <div className="grid grid-cols-2 gap-2">
                {isHair && (
                  <input
                    value={graftCount}
                    onChange={(e) => setGraftCount(e.target.value)}
                    placeholder={t('doctorQueue.graftCount') ?? undefined}
                    className={`rounded-lg border bg-surface-page px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent ${attempted && !scopeFilled ? 'border-danger' : 'border-line'}`}
                  />
                )}
                {isDental && (
                  <input
                    value={implantCount}
                    onChange={(e) => setImplantCount(e.target.value)}
                    placeholder={t('doctorQueue.implantCount') ?? undefined}
                    className={`rounded-lg border bg-surface-page px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent ${attempted && !scopeFilled ? 'border-danger' : 'border-line'}`}
                  />
                )}
                {isAesthetic && (
                  <input
                    value={procedures}
                    onChange={(e) => setProcedures(e.target.value)}
                    placeholder={t('doctorQueue.procedures') ?? undefined}
                    className={`rounded-lg border bg-surface-page px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent ${attempted && !scopeFilled ? 'border-danger' : 'border-line'}`}
                  />
                )}
                <input
                  value={priceBand}
                  onChange={(e) => setPriceBand(e.target.value)}
                  placeholder={t('doctorQueue.priceBandPlaceholder') ?? undefined}
                  className={`rounded-lg border bg-surface-page px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent ${(isHair || isDental || isAesthetic) ? '' : 'col-span-2'} ${attempted && !scopeFilled ? 'border-danger' : 'border-line'}`}
                />
              </div>
              {attempted && !scopeFilled && <p className="text-xs text-danger mt-1">{t('doctorQueue.scopeRequiredError')}</p>}
            </div>
          )}

          <p className="text-xs text-ink-subtle">{t('doctorQueue.noQuoteWarning')}</p>

          <button
            type="button"
            onClick={handleSubmit}
            className="w-full py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            {t('doctorQueue.submit')}
          </button>
        </div>
      )}
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink">{t('doctorQueue.title')}</h1>
            <p className="text-ink-muted text-sm mt-0.5">{t('doctorQueue.subtitle')}</p>
          </div>
          {queue.length > 0 && <StatusBadge tone="warning">{queue.length}</StatusBadge>}
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

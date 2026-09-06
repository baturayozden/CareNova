import React, { useState } from 'react';
import { Lock, ChevronDown } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { adminBranchTemplates, AUTHORITY_LABELS, AiPricingAuthority } from '../../data/adminBranchTemplates';
import { adminClinics } from '../../data/adminDemoData';

function clinicsUsing(branchKey: string): number {
  return adminClinics.filter(c => c.branches.includes(branchKey)).length;
}

export default function BranchesPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <AppMeta title="Branş Şablonları | CareNova Platform" />
      <div>
        <h1 className="text-xl font-semibold text-ink">Branş Şablonları</h1>
        <p className="text-ink-muted text-sm mt-0.5">
          Sistem şablonları — AI fiyat yetki matrisi burada değiştirilebilir ama
          <code className="mx-1 text-xs bg-surface-sunken px-1.5 py-0.5 rounded">ai_pricing_authority</code>
          enum'unun dışına çıkamaz (dropdown, serbest metin değil).
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface divide-y divide-line">
        {adminBranchTemplates.map(t => {
          const isOpen = expanded === t.key;
          const usage = clinicsUsing(t.key);
          return (
            <div key={t.key}>
              <button
                onClick={() => setExpanded(isOpen ? null : t.key)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-surface-sunken transition-colors"
                aria-expanded={isOpen}
              >
                <ChevronDown size={16} strokeWidth={1.75} className={`text-ink-subtle shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                <span className="font-medium text-ink w-40 shrink-0">{t.displayName}</span>
                <StatusBadge tone={t.fullyAuthored ? 'success' : 'neutral'}>{t.fullyAuthored ? 'Hazır şablon' : 'Yapılandırılabilir'}</StatusBadge>
                <span className="text-xs text-ink-muted">{AUTHORITY_LABELS[t.aiPricingAuthority]}</span>
                <span className="ml-auto text-xs text-ink-subtle">{usage} klinik kullanıyor</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pl-14 space-y-3 text-sm">
                  {t.knowledgeSeedNote && (
                    <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 flex items-start gap-2">
                      <Lock size={14} strokeWidth={2} className="text-danger shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="text-xs font-semibold text-danger mb-0.5">Kilitli kural — silinemez</p>
                        <p className="text-xs text-ink">{t.knowledgeSeedNote}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">AI Fiyat Yetkisi</p>
                    <select defaultValue={t.aiPricingAuthority} className="rounded-lg border border-line bg-surface text-sm text-ink px-3 py-1.5">
                      {(Object.keys(AUTHORITY_LABELS) as AiPricingAuthority[]).map(a => (
                        <option key={a} value={a}>{AUTHORITY_LABELS[a]}</option>
                      ))}
                    </select>
                  </div>
                  {t.preAssessmentQuestions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">Ön-değerlendirme Soruları</p>
                      <ul className="list-disc list-inside text-ink-muted text-xs space-y-0.5">
                        {t.preAssessmentQuestions.map(q => <li key={q}>{q}</li>)}
                      </ul>
                    </div>
                  )}
                  {t.requiredMedia.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">Gerekli Görseller</p>
                      <p className="text-ink-muted text-xs">{t.requiredMedia.join(' · ')}</p>
                    </div>
                  )}
                  {t.redFlags.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">Kırmızı Bayraklar</p>
                      <p className="text-danger text-xs">{t.redFlags.join(' · ')}</p>
                    </div>
                  )}
                  {t.branchObjections.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">Branş İtirazları</p>
                      <p className="text-ink-muted text-xs">{t.branchObjections.join(' · ')}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">Bakım Hattı Takvimi</p>
                    <p className="text-ink-muted text-xs">{t.aftercareSchedule}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

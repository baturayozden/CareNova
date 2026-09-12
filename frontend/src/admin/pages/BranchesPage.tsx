import React, { useState } from 'react';
import { Lock, ChevronDown } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat } from '../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../components/QueryState';
import type { AdminClinic, BranchTemplateRow } from '../types';

const AUTHORITIES = ['full', 'range_from_photo', 'range_after_imaging', 'qualification_only', 'logistics_only'] as const;

/** Keys like "kontrolsuz_diyabet" are stored as identifiers; shown readable, not translated. */
const humanize = (key: string) => key.replace(/_/g, ' ');

export default function BranchesPage() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const lang = fmt.locale.startsWith('en') ? 'en' : 'tr';
  const [expanded, setExpanded] = useState<string | null>(null);
  // Branch templates are product configuration (system rows), not tenant data.
  const templates = usePlatformQuery<{ templates: BranchTemplateRow[] }>('/api/branch-templates');
  const clinics = usePlatformQuery<{ clinics: Array<Pick<AdminClinic, 'id' | 'branches'>> }>('/api/admin/platform/clinics');

  const localized = (value: Record<string, string> | undefined, fallback: string) => value?.[lang] ?? value?.tr ?? value?.en ?? fallback;
  const usage = (key: string) => (clinics.data?.clinics ?? []).filter(c => c.branches.includes(key)).length;

  return (
    <div className="space-y-4">
      <AppMeta title={`${t('branches.title')} | CareNova Platform`} />
      <div>
        <h1 className="text-xl font-semibold text-ink">{t('branches.title')}</h1>
        <p className="text-ink-muted text-sm mt-0.5">
          {t('branches.subtitleBefore')}
          <code className="mx-1 text-xs bg-surface-sunken px-1.5 py-0.5 rounded">ai_pricing_authority</code>
          {t('branches.subtitleAfter')}
        </p>
      </div>

      {templates.loading ? <LoadingState />
        : templates.error || !templates.data ? <ErrorState error={templates.error} onRetry={templates.reload} />
          : templates.data.templates.length === 0 ? <EmptyState title={t('branches.empty')} />
            : (
              <div className="rounded-xl border border-line bg-surface divide-y divide-line">
                {templates.data.templates.map(tpl => {
                  const isOpen = expanded === tpl.key;
                  const authored = tpl.pre_assessment_questions.length > 0;
                  const lockedRule = tpl.knowledge_seed?.donor_gamete_rule;
                  return (
                    <div key={tpl.key}>
                      <button
                        onClick={() => setExpanded(isOpen ? null : tpl.key)}
                        className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-surface-sunken transition-colors"
                        aria-expanded={isOpen}
                      >
                        <ChevronDown size={16} strokeWidth={1.75} className={`text-ink-subtle shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                        <span className="font-medium text-ink w-40 shrink-0">{localized(tpl.display_name, tpl.key)}</span>
                        <StatusBadge tone={authored ? 'success' : 'neutral'}>{authored ? t('branches.readyTemplate') : t('branches.configurable')}</StatusBadge>
                        <span className="text-xs text-ink-muted">{t(`labels.authority.${tpl.ai_pricing_authority}`)}</span>
                        <span className="ml-auto text-xs text-ink-subtle">{clinics.data ? t('branches.usageCount', { count: usage(tpl.key) }) : ''}</span>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pl-14 space-y-3 text-sm">
                          {lockedRule && (
                            <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 flex items-start gap-2">
                              <Lock size={14} strokeWidth={2} className="text-danger shrink-0 mt-0.5" aria-hidden="true" />
                              <div>
                                <p className="text-xs font-semibold text-danger mb-0.5">{t('branches.lockedRuleTitle')}</p>
                                <p className="text-xs text-ink">{lockedRule}</p>
                              </div>
                            </div>
                          )}
                          <div>
                            <label htmlFor={`authority-${tpl.key}`} className="block text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">{t('branches.aiPricingAuthorityLabel')}</label>
                            {/* Closed enum, shown as a select so the full set is visible; editing is off in this read-only round. */}
                            <select id={`authority-${tpl.key}`} value={tpl.ai_pricing_authority} disabled title={t('branches.readOnly')} className="rounded-lg border border-line bg-surface text-sm text-ink px-3 py-1.5 disabled:opacity-80">
                              {AUTHORITIES.map(a => <option key={a} value={a}>{t(`labels.authority.${a}`)}</option>)}
                            </select>
                          </div>
                          {tpl.pre_assessment_questions.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">{t('branches.preAssessmentQuestionsLabel')}</p>
                              <ul className="list-disc list-inside text-ink-muted text-xs space-y-0.5">
                                {tpl.pre_assessment_questions.map(q => <li key={q.id}>{localized(q.label, humanize(q.id))}</li>)}
                              </ul>
                            </div>
                          )}
                          {tpl.required_media.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">{t('branches.requiredMediaLabel')}</p>
                              <p className="text-ink-muted text-xs">{tpl.required_media.map(m => localized(m.capture_instruction, humanize(m.id))).join(' · ')}</p>
                            </div>
                          )}
                          {tpl.red_flags.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">{t('branches.redFlagsLabel')}</p>
                              <p className="text-danger text-xs">{tpl.red_flags.map(humanize).join(' · ')}</p>
                            </div>
                          )}
                          {tpl.branch_objections.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">{t('branches.branchObjectionsLabel')}</p>
                              <p className="text-ink-muted text-xs">{tpl.branch_objections.map(humanize).join(' · ')}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">{t('branches.aftercareScheduleLabel')}</p>
                            <p className="text-ink-muted text-xs">
                              {tpl.aftercare_schedule.length
                                ? tpl.aftercare_schedule.map(s => `D+${s.day_offset}${s.note ? ` (${s.note})` : ''}`).join(', ')
                                : '—'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
    </div>
  );
}

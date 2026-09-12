import { useTranslation } from 'react-i18next';

/**
 * Locale-aware formatting and code->label lookups for the admin screens. The
 * API returns codes (plan 'klinik', branch 'hair_transplant', status
 * 'onboarding'); the words come from admin.json, so EN mode shows English.
 */
export function useAdminFormat() {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'tr-TR';

  const num = (n: number, digits = 0) => n.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const eur = (n: number) => `€${num(Math.round(n))}`;
  const usd = (n: number) => `$${num(n, 2)}`;
  // Turkish writes the sign first (%97), English after (97%).
  const pct = (n: number, digits = 0) => (locale === 'tr-TR' ? `%${num(n, digits)}` : `${num(n, digits)}%`);
  const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(locale) : '—');
  const dateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(locale) : '—');
  const timeAgo = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return t('time.minutesAgo', { count: mins });
    const hours = Math.round(mins / 60);
    if (hours < 24) return t('time.hoursAgo', { count: hours });
    return t('time.daysAgo', { count: Math.round(hours / 24) });
  };
  const daysUntil = (iso: string | null | undefined) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null);
  const daysSince = (iso: string | null | undefined) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);

  const branch = (key: string) => t(`labels.branches.${key}`, { defaultValue: key });
  const branches = (keys: string[]) => (keys.length ? keys.map(branch).join(', ') : '—');
  const plan = (key: string) => t(`labels.plans.${key}`, { defaultValue: key });
  const clinicStatus = (key: string) => t(`labels.clinicStatus.${key}`, { defaultValue: key });
  const onboardingStep = (step: number) => t(`labels.onboardingSteps.${step}`, { defaultValue: String(step) });
  const role = (key: string) => t(`common:roles.${key}`, { defaultValue: key });

  return { t, locale, num, eur, usd, pct, date, dateTime, timeAgo, daysUntil, daysSince, branch, branches, plan, clinicStatus, onboardingStep, role };
}

/** Browser download of text the screen already holds (CSV exports). */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function csvRow(values: Array<string | number | null | undefined>): string {
  return values.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
}

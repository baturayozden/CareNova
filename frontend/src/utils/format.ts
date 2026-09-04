import i18n from '../i18n';

/**
 * Intl-based date/time/number/currency helpers, locale-aware via the active
 * i18next language ('tr' | 'en'). CareNova is multi-currency/multi-locale by
 * design (Turkish clinics, international patients) — never hardcode a date
 * format or currency symbol in a component; use these instead.
 */

const INTL_LOCALE: Record<string, string> = { tr: 'tr-TR', en: 'en-GB' };

function activeLocale(): string {
  return INTL_LOCALE[i18n.language?.slice(0, 2)] || 'en-GB';
}

/** "21 Haz 2026" (tr) / "21 Jun 2026" (en) */
export function formatDateIntl(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(activeLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/** "21 Haz 2026, 14:30" (tr) / "21 Jun 2026, 2:30 PM" (en) */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(activeLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

/** Locale-aware thousands separator: "12.500" (tr) / "12,500" (en) */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(activeLocale()).format(value);
}

/** Locale + currency aware amount. Default EUR (CareNova's default, Bölüm 2.5) —
 *  pass the tenant's own currency once tenants.currency lands (see docs/dental-cleanup-inventory.md TODO). */
export function formatCurrency(value: number | null | undefined, currency: string = 'EUR'): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(activeLocale(), { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

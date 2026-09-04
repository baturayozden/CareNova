/**
 * Format a date value as DD/MM/YYYY without timezone shift.
 * Splits the ISO string directly rather than parsing with new Date(),
 * so "2026-06-21" always yields "21/06/2026" regardless of local timezone.
 *
 * This fixed-format helper stays for existing call sites that need exactly
 * DD/MM/YYYY (both tr-TR and en-GB happen to agree on that order). For new,
 * locale-aware formatting (month names, time, numbers, currency) use
 * src/utils/format.ts instead — it reacts to the active i18next language.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  let s: string;
  if (value instanceof Date) {
    s = value.toISOString().slice(0, 10);
  } else {
    s = String(value).slice(0, 10);
  }
  const parts = s.split('-');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return '—';
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

export { formatDateIntl, formatDateTime, formatNumber, formatCurrency } from './format';

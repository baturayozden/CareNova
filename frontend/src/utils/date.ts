/**
 * Format a date value as DD/MM/YYYY without timezone shift.
 * Splits the ISO string directly rather than parsing with new Date(),
 * so "2026-06-21" always yields "21/06/2026" regardless of local timezone.
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

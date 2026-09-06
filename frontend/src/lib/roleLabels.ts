// GECE-3-BRIEFI.md Bölüm E.6: a user should see "Klinik Sahibi", never the
// raw enum value "klinik_sahibi". Covers CareNova's target roles AND the
// CareDental role strings still live in demo data / the backend until
// migration 059 actually runs against a real database (BLOKAJLAR.md B7) —
// both need a real label, not just the new ones, since today's demo user
// still carries an old-style role string.
export function roleLabel(t: (key: string) => string, role: string): string {
  const key = `roles.${role}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return role.replace(/_/g, ' ');
}

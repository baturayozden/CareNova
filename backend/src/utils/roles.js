'use strict';

// CareNova's 7 clinic roles (CARENOVA-STRATEJI.md Bölüm 7/M8, migration
// 059). Platform roles (SUPER_ADMIN/ADMIN) are separate and unchanged —
// M8 only redefines clinic-level roles.
const KLINIK_SAHIBI = 'klinik_sahibi';
const OPERASYON_MUDURU = 'operasyon_muduru';
const HASTA_DANISMANI = 'hasta_danismani';
const DOKTOR = 'doktor';
const KOORDINATOR = 'koordinator';
const TERCUMAN = 'tercuman';
const MUHASEBE = 'muhasebe';

const SUPER_ADMIN = 'super_admin';
const ADMIN = 'admin';

const CLINIC_ROLES = [KLINIK_SAHIBI, OPERASYON_MUDURU, HASTA_DANISMANI, DOKTOR, KOORDINATOR, TERCUMAN, MUHASEBE];
const PLATFORM_ROLES = [SUPER_ADMIN, ADMIN];
const ALL_ROLES = [...PLATFORM_ROLES, ...CLINIC_ROLES];

// Roles broad enough to act on behalf of the whole clinic (billing +
// day-to-day case management), used where CareDental's old checks lumped
// 'director'/'clinic_admin'/'super_admin'/'admin' together.
const CLINIC_MANAGEMENT_ROLES = [KLINIK_SAHIBI, OPERASYON_MUDURU, ...PLATFORM_ROLES];

module.exports = {
  KLINIK_SAHIBI, OPERASYON_MUDURU, HASTA_DANISMANI, DOKTOR, KOORDINATOR, TERCUMAN, MUHASEBE,
  SUPER_ADMIN, ADMIN,
  CLINIC_ROLES, PLATFORM_ROLES, ALL_ROLES, CLINIC_MANAGEMENT_ROLES,
};

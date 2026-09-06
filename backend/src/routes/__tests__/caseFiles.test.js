'use strict';

// GECE-3-BRIEFI.md Bölüm E.4/E.5: unit tests for caseFiles.js's role-based
// authorization matrix. No DB needed — these are pure functions of a role
// string, same pattern as branchTemplates.test.js's canEditTemplate.
// Explicitly covers the two scenarios the brief calls out by name:
// "doktor olmayan biri uygunluk kararı veremez" and "tercüman tıbbi
// dosyayı okuyamaz".

jest.mock('../../db/index', () => ({ pool: { query: jest.fn() } }));
const {
  _internal: { canReadMedicalFile, canDecideEligibility, canLeaveAwaitingDoctor, canEditTravel },
} = require('../caseFiles');

const ALL_ROLES = [
  'klinik_sahibi', 'operasyon_muduru', 'hasta_danismani', 'doktor',
  'koordinator', 'tercuman', 'muhasebe', 'super_admin', 'admin',
];

describe('caseFiles — canReadMedicalFile ("tercüman tıbbi dosyayı okuyamaz")', () => {
  test('tercuman is the only role denied', () => {
    for (const role of ALL_ROLES) {
      expect(canReadMedicalFile(role)).toBe(role !== 'tercuman');
    }
  });
});

describe('caseFiles — canDecideEligibility ("doktor olmayan biri uygunluk kararı veremez")', () => {
  test('only doktor and platform roles may decide eligibility', () => {
    const allowed = ['doktor', 'super_admin', 'admin'];
    for (const role of ALL_ROLES) {
      expect(canDecideEligibility(role)).toBe(allowed.includes(role));
    }
  });

  test('klinik_sahibi (the clinic owner) still cannot decide eligibility', () => {
    expect(canDecideEligibility('klinik_sahibi')).toBe(false);
  });
});

describe('caseFiles — canLeaveAwaitingDoctor', () => {
  test('only doktor and platform roles may move a case out of awaiting_doctor', () => {
    const allowed = ['doktor', 'super_admin', 'admin'];
    for (const role of ALL_ROLES) {
      expect(canLeaveAwaitingDoctor(role)).toBe(allowed.includes(role));
    }
  });
});

describe('caseFiles — canEditTravel', () => {
  test('koordinator, operasyon_muduru, klinik_sahibi and platform roles may edit travel/schedule', () => {
    const allowed = ['koordinator', 'operasyon_muduru', 'klinik_sahibi', 'super_admin', 'admin'];
    for (const role of ALL_ROLES) {
      expect(canEditTravel(role)).toBe(allowed.includes(role));
    }
  });

  test('doktor and tercuman cannot edit travel', () => {
    expect(canEditTravel('doktor')).toBe(false);
    expect(canEditTravel('tercuman')).toBe(false);
  });
});

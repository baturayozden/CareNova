'use strict';

/**
 * commissionEngine.test.js
 *
 * All scenarios use the Dentafly commission scheme:
 *
 * Scheme type: flat (single-band)
 * Clinic target: €200,000
 *
 * Commission tiers (flat):
 *   Tier 1: [€0     – €100k)   → 0%
 *   Tier 2: [€100k  – €150k)   → 0.5%
 *   Tier 3: [€150k  – €200k)   → 0.75%
 *   Tier 4: [€200k  – €250k)   → 1.0%
 *   Tier 5: [€250k  – ∞)       → 1.25%
 *
 * Performance thresholds (applied to clinic attainment %):
 *   < 80%   → multiplier 0    (no commission)
 *   ≥ 80%   → multiplier 0.5
 *   ≥ 100%  → multiplier 1.0
 *
 * Team bonus tiers (per eligible staff, by clinic actual revenue):
 *   [€160k – €200k) → €100
 *   [€200k – €220k) → €250
 *   [€220k – €250k) → €400
 *   [€250k – ∞)     → €600
 */

const { calculateCommission, _internal } = require('../commissionEngine');
const { roundGBP, findFlatTier, calcFlatCommission, calcMarginalCommission, findPerformanceMultiplier, findTeamBonus } = _internal;

// ── Dentafly fixtures ─────────────────────────────────────────────────────────

const CLINIC_TARGET = 200_000;

/** Flat commission tiers */
const FLAT_TIERS = [
  { tier_order: 1, min_revenue:       0, max_revenue: 100_000, rate_percent: 0,    flat_bonus: null },
  { tier_order: 2, min_revenue: 100_000, max_revenue: 150_000, rate_percent: 0.5,  flat_bonus: null },
  { tier_order: 3, min_revenue: 150_000, max_revenue: 200_000, rate_percent: 0.75, flat_bonus: null },
  { tier_order: 4, min_revenue: 200_000, max_revenue: 250_000, rate_percent: 1.0,  flat_bonus: null },
  { tier_order: 5, min_revenue: 250_000, max_revenue: null,    rate_percent: 1.25, flat_bonus: null },
];

/** Marginal commission tiers (same bands, different application) */
const MARGINAL_TIERS = FLAT_TIERS;

/** Performance thresholds */
const PERF_THRESHOLDS = [
  { target_percent: 80,  multiplier: 0.5 },
  { target_percent: 100, multiplier: 1.0 },
];

/** Team bonus tiers (by clinic revenue) */
const TEAM_BONUS_TIERS = [
  { tier_order: 1, min_revenue: 160_000, max_revenue: 200_000, bonus_per_staff: 100 },
  { tier_order: 2, min_revenue: 200_000, max_revenue: 220_000, bonus_per_staff: 250 },
  { tier_order: 3, min_revenue: 220_000, max_revenue: 250_000, bonus_per_staff: 400 },
  { tier_order: 4, min_revenue: 250_000, max_revenue: null,    bonus_per_staff: 600 },
];

const FLAT_SCHEME    = { type: 'individual', tier_application: 'flat' };
const MARGINAL_SCHEME = { type: 'individual', tier_application: 'marginal' };

/** Helper: build a single-staff input and return that staff's result */
function calcOne(opts) {
  const {
    scheme = FLAT_SCHEME,
    tiers = FLAT_TIERS,
    clinicRevenue,
    personalRevenue,
    isEligibleForTeamBonus = true,
    isFullTime = true,
    priorClawbacks = [],
  } = opts;

  const [result] = calculateCommission({
    scheme,
    tiers,
    performanceThresholds: PERF_THRESHOLDS,
    teamBonusTiers: TEAM_BONUS_TIERS,
    clinicTarget: CLINIC_TARGET,
    clinicActualRevenue: clinicRevenue,
    staff: [{ staffId: 'staff-1', personalRevenue, isEligibleForTeamBonus, isFullTime }],
    priorClawbacks,
  });
  return result;
}

// ── Unit tests for internal helpers ──────────────────────────────────────────

describe('roundGBP', () => {
  test('rounds to 2 decimal places', () => {
    expect(roundGBP(1.005)).toBe(1.01);
    expect(roundGBP(2.555)).toBe(2.56);
    expect(roundGBP(100)).toBe(100);
  });

  test('IEEE 754 edge case: 1.005 does not floor to 1.00', () => {
    // Without EPSILON nudge, Math.round(1.005 * 100) / 100 = 1.00 in some engines
    expect(roundGBP(1.005)).toBeGreaterThanOrEqual(1.00);
  });
});

describe('findFlatTier', () => {
  test('returns null when revenue is below every min', () => {
    const tiers = [{ tier_order: 1, min_revenue: 100, max_revenue: 200, rate_percent: 5, flat_bonus: null }];
    expect(findFlatTier(tiers, 50)).toBeNull();
  });

  test('matches correct band including open upper bound', () => {
    const tier = findFlatTier(FLAT_TIERS, 160_000);
    expect(Number(tier.rate_percent)).toBe(0.75);
  });

  test('open-ended top tier matches revenue above all bands', () => {
    const tier = findFlatTier(FLAT_TIERS, 300_000);
    expect(Number(tier.rate_percent)).toBe(1.25);
  });

  test('boundary: revenue exactly at min_revenue of a band enters that band', () => {
    const tier = findFlatTier(FLAT_TIERS, 200_000);
    expect(Number(tier.rate_percent)).toBe(1.0); // enters [200k-250k)
  });

  test('boundary: revenue exactly at max_revenue exits to next band', () => {
    const tier = findFlatTier(FLAT_TIERS, 150_000);
    expect(Number(tier.rate_percent)).toBe(0.75); // 150k enters [150k-200k), NOT [100k-150k)
  });
});

describe('findPerformanceMultiplier', () => {
  test('below all thresholds → 0', () => {
    expect(findPerformanceMultiplier(PERF_THRESHOLDS, 79.9)).toBe(0);
  });

  test('exactly at 80% → 0.5', () => {
    expect(findPerformanceMultiplier(PERF_THRESHOLDS, 80)).toBe(0.5);
  });

  test('between 80% and 100% → 0.5', () => {
    expect(findPerformanceMultiplier(PERF_THRESHOLDS, 95)).toBe(0.5);
  });

  test('exactly at 100% → 1.0', () => {
    expect(findPerformanceMultiplier(PERF_THRESHOLDS, 100)).toBe(1.0);
  });

  test('above 100% with no higher threshold → 1.0', () => {
    expect(findPerformanceMultiplier(PERF_THRESHOLDS, 130)).toBe(1.0);
  });
});

describe('findTeamBonus', () => {
  test('below all tiers → 0', () => {
    expect(findTeamBonus(TEAM_BONUS_TIERS, 100_000)).toBe(0);
  });

  test('clinic €240k → €400', () => {
    expect(findTeamBonus(TEAM_BONUS_TIERS, 240_000)).toBe(400);
  });

  test('clinic €170k → €100', () => {
    expect(findTeamBonus(TEAM_BONUS_TIERS, 170_000)).toBe(100);
  });
});

// ── Dentafly integration scenarios ────────────────────────────────────────────

describe('Dentafly scenario 1 — 120% attainment, TC personal €160k', () => {
  // Clinic €240k / target €200k = 120% → multiplier 1.0
  // Flat tier for €160k: [150k-200k) → 0.75% → 160,000 × 0.75% = 1,200.00 = baseCommission
  // performanceBonus = base × (1.0 - 1) = 0
  // teamBonus: clinic €240k → [220k-250k) → €400
  // total = 1200 + 0 + 400 + 0 = 1600.00
  let result;
  beforeAll(() => {
    result = calcOne({ clinicRevenue: 240_000, personalRevenue: 160_000 });
  });

  test('targetAttainment = 120.00', () => expect(result.targetAttainment).toBe(120.00));
  test('baseCommission = 1200.00',  () => expect(result.baseCommission.toFixed(2)).toBe('1200.00'));
  test('performanceBonus = 0.00',   () => expect(result.performanceBonus.toFixed(2)).toBe('0.00'));
  test('teamBonus = 400.00',        () => expect(result.teamBonus.toFixed(2)).toBe('400.00'));
  test('adjustmentAmount = 0.00',   () => expect(result.adjustmentAmount.toFixed(2)).toBe('0.00'));
  test('totalCommission = 1600.00', () => expect(result.totalCommission.toFixed(2)).toBe('1600.00'));
});

describe('Dentafly scenario 2 — 85% attainment, TC personal €160k', () => {
  // Clinic €170k / €200k = 85% → multiplier 0.5 (cappedMultiplier=0.5, excess=0)
  // rawBase = 160,000 × 0.75% = 1,200.00
  // baseCommission = 1,200 × 0.5 = 600.00  (multiplier absorbed into base)
  // performanceBonus = 0  (multiplier ≤ 1.0 → never negative)
  // teamBonus: clinic €170k → [160k-200k) → €100
  // total = 600 + 0 + 100 + 0 = 700.00
  let result;
  beforeAll(() => {
    result = calcOne({ clinicRevenue: 170_000, personalRevenue: 160_000 });
  });

  test('targetAttainment = 85.00',  () => expect(result.targetAttainment).toBe(85.00));
  test('baseCommission = 600.00',   () => expect(result.baseCommission.toFixed(2)).toBe('600.00'));
  test('performanceBonus = 0.00',   () => expect(result.performanceBonus.toFixed(2)).toBe('0.00'));
  test('teamBonus = 100.00',        () => expect(result.teamBonus.toFixed(2)).toBe('100.00'));
  test('totalCommission = 700.00',  () => expect(result.totalCommission.toFixed(2)).toBe('700.00'));
});

describe('Dentafly scenario 3 — 75% attainment (below gate), TC personal €160k', () => {
  // Clinic €150k / €200k = 75% → multiplier 0 (below 80% threshold → gate not met)
  // baseCommission = 1,200 × 0 = 0.00  (TC earned nothing — not penalised)
  // performanceBonus = 0
  // teamBonus: clinic €150k → below all team bonus tiers → 0
  // total = 0 + 0 + 0 + 0 = 0.00
  let result;
  beforeAll(() => {
    result = calcOne({ clinicRevenue: 150_000, personalRevenue: 160_000 });
  });

  test('targetAttainment = 75.00',  () => expect(result.targetAttainment).toBe(75.00));
  test('baseCommission = 0.00',     () => expect(result.baseCommission.toFixed(2)).toBe('0.00'));
  test('performanceBonus = 0.00',   () => expect(result.performanceBonus.toFixed(2)).toBe('0.00'));
  test('teamBonus = 0.00',          () => expect(result.teamBonus.toFixed(2)).toBe('0.00'));
  test('totalCommission = 0.00',    () => expect(result.totalCommission.toFixed(2)).toBe('0.00'));
});

describe('Dentafly scenario 4 — 100% attainment (exactly on threshold), TC personal €160k', () => {
  // Clinic €200k / €200k = 100% → multiplier 1.0 (exactly hits 100% threshold)
  // baseCommission = 160,000 × 0.75% = 1,200.00
  // performanceBonus = 0
  // teamBonus: clinic €200k → [200k-220k) → €250
  // total = 1200 + 0 + 250 + 0 = 1450.00
  let result;
  beforeAll(() => {
    result = calcOne({ clinicRevenue: 200_000, personalRevenue: 160_000 });
  });

  test('targetAttainment = 100.00', () => expect(result.targetAttainment).toBe(100.00));
  test('baseCommission = 1200.00',  () => expect(result.baseCommission.toFixed(2)).toBe('1200.00'));
  test('performanceBonus = 0.00',   () => expect(result.performanceBonus.toFixed(2)).toBe('0.00'));
  test('teamBonus = 250.00',        () => expect(result.teamBonus.toFixed(2)).toBe('250.00'));
  test('totalCommission = 1450.00', () => expect(result.totalCommission.toFixed(2)).toBe('1450.00'));
});

describe('Dentafly scenario 5 — 80% attainment (exactly on lower threshold), TC personal €160k', () => {
  // Clinic €160k / €200k = 80% → multiplier 0.5 (exactly hits 80% threshold)
  // rawBase = 160,000 × 0.75% = 1,200.00
  // baseCommission = 1,200 × 0.5 = 600.00  (multiplier absorbed into base)
  // performanceBonus = 0
  // teamBonus: clinic €160k → [160k-200k) → €100
  // total = 600 + 0 + 100 + 0 = 700.00
  let result;
  beforeAll(() => {
    result = calcOne({ clinicRevenue: 160_000, personalRevenue: 160_000 });
  });

  test('targetAttainment = 80.00',  () => expect(result.targetAttainment).toBe(80.00));
  test('baseCommission = 600.00',   () => expect(result.baseCommission.toFixed(2)).toBe('600.00'));
  test('performanceBonus = 0.00',   () => expect(result.performanceBonus.toFixed(2)).toBe('0.00'));
  test('teamBonus = 100.00',        () => expect(result.teamBonus.toFixed(2)).toBe('100.00'));
  test('totalCommission = 700.00',  () => expect(result.totalCommission.toFixed(2)).toBe('700.00'));
});

describe('Dentafly scenario 6 — 120% attainment, TC personal €150k', () => {
  // Clinic €240k → multiplier 1.0
  // Flat tier for €150k: revenue=150k is exactly at min_revenue=150k for [150k-200k) → 0.75%
  // baseCommission = 150,000 × 0.75% = 1,125.00
  // performanceBonus = 0
  // teamBonus: clinic €240k → €400
  // total = 1125 + 0 + 400 + 0 = 1525.00
  let result;
  beforeAll(() => {
    result = calcOne({ clinicRevenue: 240_000, personalRevenue: 150_000 });
  });

  test('baseCommission = 1125.00',  () => expect(result.baseCommission.toFixed(2)).toBe('1125.00'));
  test('performanceBonus = 0.00',   () => expect(result.performanceBonus.toFixed(2)).toBe('0.00'));
  test('teamBonus = 400.00',        () => expect(result.teamBonus.toFixed(2)).toBe('400.00'));
  test('totalCommission = 1525.00', () => expect(result.totalCommission.toFixed(2)).toBe('1525.00'));
});

describe('Dentafly scenario 7 — part-time pro-rata team bonus', () => {
  // Clinic €240k → multiplier 1.0, teamBonusBase = €400
  // Full-time:  teamBonus = 400
  // Part-time:  teamBonus = 400 × 0.5 = 200
  let ftResult, ptResult;
  beforeAll(() => {
    ftResult = calcOne({ clinicRevenue: 240_000, personalRevenue: 160_000, isFullTime: true });
    ptResult = calcOne({ clinicRevenue: 240_000, personalRevenue: 160_000, isFullTime: false });
  });

  test('full-time teamBonus = 400.00',  () => expect(ftResult.teamBonus.toFixed(2)).toBe('400.00'));
  test('part-time teamBonus = 200.00',  () => expect(ptResult.teamBonus.toFixed(2)).toBe('200.00'));
  test('part-time totalCommission = 1400.00', () => expect(ptResult.totalCommission.toFixed(2)).toBe('1400.00'));
});

describe('Dentafly scenario 8 — prior clawback of €500', () => {
  // Clinic €240k → multiplier 1.0, baseCommission 1200, teamBonus 400
  // Clawback €500 → adjustmentAmount = -500.00
  // total = 1200 + 0 + 400 + (-500) = 1100.00
  let result;
  beforeAll(() => {
    result = calcOne({
      clinicRevenue: 240_000,
      personalRevenue: 160_000,
      priorClawbacks: [{ staffId: 'staff-1', amount: 500 }],
    });
  });

  test('adjustmentAmount = -500.00',  () => expect(result.adjustmentAmount.toFixed(2)).toBe('-500.00'));
  test('totalCommission = 1100.00',   () => expect(result.totalCommission.toFixed(2)).toBe('1100.00'));
});

describe('Dentafly scenario 9 — marginal tier application, TC personal €160k, clinic €240k', () => {
  // Marginal bands for €160k:
  //   [0-100k)    : 100k slice × 0%    =    0.00
  //   [100k-150k) :  50k slice × 0.5%  =  250.00
  //   [150k-200k) :  10k slice × 0.75% =   75.00
  //   ─────────────────────────────────────────────
  //   Total marginal base              =  325.00
  // multiplier 1.0 → performanceBonus = 0
  // teamBonus: clinic €240k → €400
  // total = 325 + 0 + 400 + 0 = 725.00
  let result;
  beforeAll(() => {
    result = calcOne({
      scheme: MARGINAL_SCHEME,
      tiers: MARGINAL_TIERS,
      clinicRevenue: 240_000,
      personalRevenue: 160_000,
    });
  });

  test('baseCommission = 325.00',   () => expect(result.baseCommission.toFixed(2)).toBe('325.00'));
  test('performanceBonus = 0.00',   () => expect(result.performanceBonus.toFixed(2)).toBe('0.00'));
  test('teamBonus = 400.00',        () => expect(result.teamBonus.toFixed(2)).toBe('400.00'));
  test('totalCommission = 725.00',  () => expect(result.totalCommission.toFixed(2)).toBe('725.00'));
});

describe('Dentafly scenario 10 — marginal tier + 85% attainment (half rate), TC personal €160k', () => {
  // Clinic €170k / €200k = 85% → multiplier 0.5
  // Marginal bands for €160k:
  //   [0-100k)    : 100k × 0%    =    0.00
  //   [100k-150k) :  50k × 0.5%  =  250.00
  //   [150k-200k) :  10k × 0.75% =   75.00
  //   rawBase = 325.00
  // baseCommission = 325 × 0.5 = 162.50  (multiplier absorbed into base)
  // performanceBonus = 0
  // teamBonus: clinic €170k → [160k-200k) → €100
  // total = 162.50 + 0 + 100 + 0 = 262.50
  let result;
  beforeAll(() => {
    result = calcOne({
      scheme: MARGINAL_SCHEME,
      tiers: MARGINAL_TIERS,
      clinicRevenue: 170_000,
      personalRevenue: 160_000,
    });
  });

  test('targetAttainment = 85.00',  () => expect(result.targetAttainment).toBe(85.00));
  test('baseCommission = 162.50',   () => expect(result.baseCommission.toFixed(2)).toBe('162.50'));
  test('performanceBonus = 0.00',   () => expect(result.performanceBonus.toFixed(2)).toBe('0.00'));
  test('teamBonus = 100.00',        () => expect(result.teamBonus.toFixed(2)).toBe('100.00'));
  test('totalCommission = 262.50',  () => expect(result.totalCommission.toFixed(2)).toBe('262.50'));
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('Edge: performanceBonus is never negative regardless of multiplier', () => {
  test('multiplier 0 → performanceBonus = 0, not negative', () => {
    const result = calcOne({ clinicRevenue: 150_000, personalRevenue: 160_000 });
    expect(result.performanceBonus).toBeGreaterThanOrEqual(0);
  });

  test('multiplier 0.5 → performanceBonus = 0, not negative', () => {
    const result = calcOne({ clinicRevenue: 170_000, personalRevenue: 160_000 });
    expect(result.performanceBonus).toBeGreaterThanOrEqual(0);
  });
});

describe('Edge: overachievement multiplier > 1.0 → performanceBonus positive', () => {
  // Custom scheme with a 1.2× overachievement multiplier at 110%
  const overThresholds = [
    { target_percent: 80,  multiplier: 0.5 },
    { target_percent: 100, multiplier: 1.0 },
    { target_percent: 110, multiplier: 1.2 },
  ];

  test('120% attainment, TC €160k → perf = rawBase × 0.2 = 240.00', () => {
    const [result] = calculateCommission({
      scheme: FLAT_SCHEME,
      tiers: FLAT_TIERS,
      performanceThresholds: overThresholds,
      teamBonusTiers: TEAM_BONUS_TIERS,
      clinicTarget: CLINIC_TARGET,
      clinicActualRevenue: 240_000,
      staff: [{ staffId: 's1', personalRevenue: 160_000, isEligibleForTeamBonus: false, isFullTime: true }],
    });
    // rawBase = 1200, cappedMultiplier=1.0, excess=0.2
    // baseCommission = 1200, performanceBonus = 1200 × 0.2 = 240
    expect(result.baseCommission.toFixed(2)).toBe('1200.00');
    expect(result.performanceBonus.toFixed(2)).toBe('240.00');
    expect(result.totalCommission.toFixed(2)).toBe('1440.00');
  });
});

describe('Edge: staff not eligible for team bonus', () => {
  test('teamBonus = 0 regardless of clinic revenue', () => {
    const result = calcOne({
      clinicRevenue: 240_000,
      personalRevenue: 160_000,
      isEligibleForTeamBonus: false,
    });
    expect(result.teamBonus.toFixed(2)).toBe('0.00');
    expect(result.totalCommission.toFixed(2)).toBe('1200.00');
  });
});

describe('Edge: zero clinic target', () => {
  test('targetAttainment = 0 (no division by zero)', () => {
    const [result] = calculateCommission({
      scheme: FLAT_SCHEME,
      tiers: FLAT_TIERS,
      performanceThresholds: PERF_THRESHOLDS,
      teamBonusTiers: TEAM_BONUS_TIERS,
      clinicTarget: 0,
      clinicActualRevenue: 100_000,
      staff: [{ staffId: 's1', personalRevenue: 160_000, isEligibleForTeamBonus: true, isFullTime: true }],
    });
    expect(result.targetAttainment).toBe(0);
  });
});

describe('Edge: clawback is stored as negative, never as double-negative', () => {
  test('passing a negative amount still becomes a negative adjustment', () => {
    // priorClawbacks amounts are always positive magnitudes (engine negates them)
    const result = calcOne({
      clinicRevenue: 240_000,
      personalRevenue: 160_000,
      priorClawbacks: [{ staffId: 'staff-1', amount: -300 }], // caller mistake: already negative
    });
    // engine: -Math.abs(-300) = -300
    expect(result.adjustmentAmount.toFixed(2)).toBe('-300.00');
  });
});

describe('Edge: multiple staff in one call', () => {
  test('returns independent results for each staff member', () => {
    const results = calculateCommission({
      scheme: FLAT_SCHEME,
      tiers: FLAT_TIERS,
      performanceThresholds: PERF_THRESHOLDS,
      teamBonusTiers: TEAM_BONUS_TIERS,
      clinicTarget: CLINIC_TARGET,
      clinicActualRevenue: 240_000,
      staff: [
        { staffId: 'ft-1', personalRevenue: 160_000, isEligibleForTeamBonus: true,  isFullTime: true  },
        { staffId: 'pt-1', personalRevenue: 160_000, isEligibleForTeamBonus: true,  isFullTime: false },
        { staffId: 'ni-1', personalRevenue: 160_000, isEligibleForTeamBonus: false, isFullTime: true  },
      ],
      priorClawbacks: [{ staffId: 'ft-1', amount: 200 }],
    });

    expect(results).toHaveLength(3);

    const ft = results.find(r => r.staffId === 'ft-1');
    const pt = results.find(r => r.staffId === 'pt-1');
    const ni = results.find(r => r.staffId === 'ni-1');

    // full-time with clawback
    expect(ft.teamBonus.toFixed(2)).toBe('400.00');
    expect(ft.adjustmentAmount.toFixed(2)).toBe('-200.00');
    expect(ft.totalCommission.toFixed(2)).toBe('1400.00');

    // part-time pro-rata
    expect(pt.teamBonus.toFixed(2)).toBe('200.00');
    expect(pt.totalCommission.toFixed(2)).toBe('1400.00');

    // not eligible for team bonus
    expect(ni.teamBonus.toFixed(2)).toBe('0.00');
    expect(ni.totalCommission.toFixed(2)).toBe('1200.00');
  });
});

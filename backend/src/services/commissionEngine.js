'use strict';

/**
 * Commission Calculation Engine
 *
 * Pure module — no DB, no HTTP, no side effects.
 * All inputs are plain JS objects (already fetched from DB by the caller).
 * All monetary values in/out are in GBP pounds (JavaScript number).
 *
 * Output field semantics (matches commission_records DB columns):
 *   baseCommission   = rate-based commission AFTER performance multiplier (capped at ×1.0).
 *                      If the gate is not met (multiplier = 0) this is 0.
 *                      flat_bonus is included here only when the gate is met.
 *   performanceBonus = OVERACHIEVEMENT delta only: rawBase × (multiplier − 1.0)
 *                      ALWAYS ≥ 0. Zero when multiplier ≤ 1.0 (the normal case).
 *                      Positive only when a scheme has a multiplier > 1.0.
 *   teamBonus        = per-staff team bonus (not performance-gated)
 *   adjustmentAmount = prior-period clawbacks as a negative value
 *   totalCommission  = sum of the four above (matches DB GENERATED ALWAYS AS formula)
 *
 * Float safety: all intermediate money calculations use roundGBP() at each step
 * to prevent IEEE 754 pence drift.
 */

// ── Rounding ──────────────────────────────────────────────────────────────────

/**
 * Round to 2 decimal places (GBP pence).
 * Number.EPSILON nudge corrects IEEE 754 edge cases such as 1.005 → 1.00.
 */
function roundGBP(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ── Tier helpers ──────────────────────────────────────────────────────────────

/**
 * Find the single commission tier whose band [min_revenue, max_revenue)
 * contains `revenue`. NULL max_revenue means open-ended (no upper bound).
 * Returns null if revenue falls below every band's min_revenue.
 */
function findFlatTier(tiers, revenue) {
  const sorted = [...tiers].sort((a, b) => a.tier_order - b.tier_order);
  for (const tier of sorted) {
    const aboveMin = revenue >= Number(tier.min_revenue);
    const belowMax =
      tier.max_revenue === null ||
      tier.max_revenue === undefined ||
      revenue < Number(tier.max_revenue);
    if (aboveMin && belowMax) return tier;
  }
  return null;
}

/**
 * Flat (single-band) commission.
 * The rate of the tier containing `revenue` is applied to the WHOLE revenue.
 *
 * @returns {{ base: number, flatBonus: number, tierUsed: object|null }}
 */
function calcFlatCommission(tiers, revenue) {
  const tier = findFlatTier(tiers, revenue);
  if (!tier) return { base: 0, flatBonus: 0, tierUsed: null };
  return {
    base:      roundGBP(revenue * (Number(tier.rate_percent) / 100)),
    flatBonus: roundGBP(Number(tier.flat_bonus || 0)),
    tierUsed:  tier,
  };
}

/**
 * Marginal (progressive) commission.
 * Each band's slice of revenue is taxed at that band's rate (tax-bracket style).
 *
 * @returns {{ base: number, flatBonus: number, tierUsed: object|null }}
 */
function calcMarginalCommission(tiers, revenue) {
  const sorted = [...tiers].sort((a, b) => a.tier_order - b.tier_order);
  let total        = 0;
  let lastTierUsed = null;
  let flatBonus    = 0;
  let remaining    = revenue;

  for (const tier of sorted) {
    if (remaining <= 0) break;
    if (revenue < Number(tier.min_revenue)) break;

    const bandFloor     = Number(tier.min_revenue);
    const bandCeil      = (tier.max_revenue === null || tier.max_revenue === undefined)
      ? Infinity
      : Number(tier.max_revenue);
    const portionInBand = Math.min(remaining, bandCeil - bandFloor);
    if (portionInBand <= 0) continue;

    total       += roundGBP(portionInBand * (Number(tier.rate_percent) / 100));
    remaining   -= portionInBand;
    lastTierUsed = tier;

    // Carry the flat_bonus of the highest band reached (replaces any lower one)
    if (tier.flat_bonus) flatBonus = roundGBP(Number(tier.flat_bonus));
  }

  return { base: roundGBP(total), flatBonus, tierUsed: lastTierUsed };
}

// ── Performance gate ──────────────────────────────────────────────────────────

/**
 * Find the performance multiplier for a given attainment percentage.
 *
 * Rules:
 *   - Sort thresholds ascending by target_percent.
 *   - The applicable threshold is the highest one whose target_percent ≤ attainment.
 *   - If attainment is below ALL thresholds → multiplier is 0 (no commission).
 *
 * Example (Dentafly): thresholds [{80, 0.5}, {100, 1.0}]
 *   attainment  75 % → 0      (below every threshold)
 *   attainment  80 % → 0.5    (exactly hits 80 % threshold)
 *   attainment  85 % → 0.5    (above 80 %, below 100 %)
 *   attainment 100 % → 1.0    (exactly hits 100 % threshold)
 *   attainment 120 % → 1.0    (above 100 %, no higher threshold defined)
 */
function findPerformanceMultiplier(thresholds, attainmentPct) {
  const sorted = [...thresholds].sort((a, b) => a.target_percent - b.target_percent);
  let multiplier = 0;
  for (const t of sorted) {
    if (attainmentPct >= Number(t.target_percent)) {
      multiplier = Number(t.multiplier);
    }
  }
  return multiplier;
}

// ── Team bonus ────────────────────────────────────────────────────────────────

/**
 * Return the per-staff team bonus for the given clinic revenue.
 * Uses the same flat-band lookup as commission tiers.
 * Returns 0 if clinic revenue falls below every tier's min_revenue.
 */
function findTeamBonus(teamBonusTiers, clinicRevenue) {
  const tier = findFlatTier(teamBonusTiers, clinicRevenue);
  return tier ? roundGBP(Number(tier.bonus_per_staff || 0)) : 0;
}

// ── Main engine ───────────────────────────────────────────────────────────────

/**
 * Calculate commission for every staff member in a commission period.
 *
 * @param {object}   input
 * @param {object}   input.scheme
 *   { type: string, tier_application: 'flat' | 'marginal' }
 * @param {object[]} input.tiers
 *   Commission tier rows: { tier_order, min_revenue, max_revenue, rate_percent, flat_bonus }
 * @param {object[]} input.performanceThresholds
 *   { target_percent, multiplier }[]
 * @param {object[]} input.teamBonusTiers
 *   { tier_order, min_revenue, max_revenue, bonus_per_staff }[]
 * @param {number}   input.clinicTarget            Period revenue target (GBP)
 * @param {number}   input.clinicActualRevenue     Period actual revenue (GBP)
 * @param {object[]} input.staff
 *   { staffId, personalRevenue, isEligibleForTeamBonus, isFullTime }[]
 * @param {object[]} [input.priorClawbacks=[]]
 *   { staffId, amount }[]  — positive amounts; engine stores them as negative adjustments
 *
 * @returns {object[]} One result record per staff member:
 *   { staffId, totalRevenue, targetAttainment,
 *     baseCommission, performanceBonus, teamBonus, adjustmentAmount,
 *     totalCommission, reasoning }
 */
function calculateCommission(input) {
  const {
    scheme,
    tiers,
    performanceThresholds,
    teamBonusTiers,
    clinicTarget,
    clinicActualRevenue,
    staff,
    priorClawbacks = [],
  } = input;

  // ── (a) Clinic attainment + performance multiplier ──────────────────────────
  const targetAttainment = clinicTarget > 0
    ? roundGBP((clinicActualRevenue / clinicTarget) * 100)
    : 0;

  const perfMultiplier = findPerformanceMultiplier(performanceThresholds, targetAttainment);

  // ── Team bonus base (same for all eligible staff) ───────────────────────────
  const teamBonusBase = findTeamBonus(teamBonusTiers, clinicActualRevenue);

  // ── Clawback map ─────────────────────────────────────────────────────────────
  const clawbackMap = {};
  for (const cb of priorClawbacks) {
    clawbackMap[cb.staffId] = roundGBP(Number(cb.amount || 0));
  }

  const tierApplication = scheme.tier_application || 'flat';

  // ── Per-staff ─────────────────────────────────────────────────────────────────
  return staff.map((member) => {
    const { staffId, personalRevenue, isEligibleForTeamBonus, isFullTime } = member;
    const revenue = Number(personalRevenue || 0);

    // (b) Personal commission via rate tiers
    const rawResult = tierApplication === 'marginal'
      ? calcMarginalCommission(tiers, revenue)
      : calcFlatCommission(tiers, revenue);

    // Split the multiplier into two parts:
    //   cappedMultiplier  = min(multiplier, 1.0) — absorbed into baseCommission
    //   excessMultiplier  = max(0, multiplier − 1.0) — overachievement only → performanceBonus
    //
    // This ensures performanceBonus is NEVER negative:
    //   - Below gate (×0):   base = 0,        perf = 0  (TC earned nothing)
    //   - Reduced rate (×0.5): base = raw×0.5, perf = 0  (TC earned less, not "penalised")
    //   - Full rate (×1.0):  base = raw,      perf = 0
    //   - Overachiever (×1.2): base = raw,    perf = raw×0.2
    const cappedMultiplier    = Math.min(perfMultiplier, 1.0);
    const excessMultiplier    = Math.max(0, perfMultiplier - 1.0);

    // flat_bonus is a guaranteed tier component — not multiplied, but forfeited at gate=0.
    const rateAfterMultiplier = roundGBP(rawResult.base * cappedMultiplier);
    const flatBonusAfterGate  = perfMultiplier > 0 ? rawResult.flatBonus : 0;
    const baseCommission      = roundGBP(rateAfterMultiplier + flatBonusAfterGate);

    // performanceBonus ≥ 0 always; zero for all Dentafly-style schemes (max multiplier 1.0)
    const performanceBonus    = roundGBP(rawResult.base * excessMultiplier);

    // (c) Team bonus
    // Pro-rata factor for part-time staff: 0.5 — ileride configurable yapılacak.
    let teamBonus = 0;
    if (isEligibleForTeamBonus && teamBonusBase > 0) {
      teamBonus = isFullTime
        ? teamBonusBase
        : roundGBP(teamBonusBase * 0.5);
    }

    // (d) Clawback → stored as a negative adjustment
    const adjustmentAmount = clawbackMap[staffId]
      ? roundGBP(-Math.abs(clawbackMap[staffId]))
      : 0;

    // (e) Total — matches DB GENERATED ALWAYS AS formula:
    //   base_commission + performance_bonus + team_bonus + adjustment_amount
    const totalCommission = roundGBP(
      baseCommission + performanceBonus + teamBonus + adjustmentAmount,
    );

    // ── Human-readable reasoning ──────────────────────────────────────────────
    const attainStr = `${targetAttainment.toFixed(1)}%`;

    // Describe the clinic performance outcome
    let clinicLine;
    if (perfMultiplier === 0) {
      clinicLine =
        `Clinic reached ${attainStr} of target — below the minimum performance threshold, ` +
        `no commission earned.`;
    } else if (cappedMultiplier < 1.0) {
      clinicLine =
        `Clinic achieved ${attainStr} of target → reduced rate ×${perfMultiplier} applied.`;
    } else if (excessMultiplier > 0) {
      clinicLine =
        `Clinic achieved ${attainStr} of target → full rate + overachievement bonus ×${perfMultiplier}.`;
    } else {
      clinicLine =
        `Clinic achieved ${attainStr} of target → full rate applied.`;
    }

    const tierDesc = rawResult.tierUsed
      ? `${tierApplication === 'marginal' ? 'marginal, highest band ' : ''}` +
        `${Number(rawResult.tierUsed.rate_percent)}% band`
      : 'no qualifying commission band';

    // Describe what the TC actually earned (not what was "deducted")
    const parts = [clinicLine];

    if (rawResult.tierUsed) {
      const grossRate = roundGBP(rawResult.base + rawResult.flatBonus);
      if (perfMultiplier === 0) {
        parts.push(
          `Personal revenue €${revenue.toLocaleString('en-GB')}, ${tierDesc} → ` +
          `gross €${grossRate.toFixed(2)}, performance gate not met → €0.00 earned.`,
        );
      } else if (cappedMultiplier < 1.0) {
        parts.push(
          `Personal revenue €${revenue.toLocaleString('en-GB')}, ${tierDesc} → ` +
          `gross €${grossRate.toFixed(2)} × ${perfMultiplier} = €${baseCommission.toFixed(2)} earned.`,
        );
      } else {
        parts.push(
          `Personal revenue €${revenue.toLocaleString('en-GB')}, ${tierDesc} → ` +
          `€${baseCommission.toFixed(2)} earned.`,
        );
      }
    } else {
      parts.push(
        `Personal revenue €${revenue.toLocaleString('en-GB')} — ${tierDesc}.`,
      );
    }

    if (performanceBonus > 0) {
      parts.push(`Overachievement bonus: €${performanceBonus.toFixed(2)}.`);
    }

    if (teamBonus > 0) {
      const proRataNote = isFullTime ? '' : ` × 0.5 pro-rata`;
      parts.push(
        `Team bonus €${teamBonusBase.toFixed(2)}${proRataNote} = €${teamBonus.toFixed(2)}.`,
      );
    }

    if (adjustmentAmount < 0) {
      parts.push(
        `Prior clawback deducted: −€${Math.abs(adjustmentAmount).toFixed(2)}.`,
      );
    }

    parts.push(`Total commission: €${totalCommission.toFixed(2)}.`);

    return {
      staffId,
      totalRevenue:    revenue,
      targetAttainment,
      baseCommission,
      performanceBonus,
      teamBonus,
      adjustmentAmount,
      totalCommission,
      reasoning: parts.join(' '),
    };
  });
}

module.exports = {
  calculateCommission,
  // Exported for unit testing of sub-routines
  _internal: {
    roundGBP,
    findFlatTier,
    calcFlatCommission,
    calcMarginalCommission,
    findPerformanceMultiplier,
    findTeamBonus,
  },
};

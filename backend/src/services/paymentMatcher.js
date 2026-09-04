'use strict';

/**
 * Payment Matcher
 *
 * Pure module — no DB, no HTTP, no side effects.
 * Inputs are plain JS objects (pre-fetched by the caller).
 * Output is an array of match results.
 *
 * ── Confidence thresholds ────────────────────────────────────────────────────
 *   >= AUTO_MATCH_THRESHOLD   → 'auto_matched'  (written automatically)
 *   >= NEEDS_REVIEW_THRESHOLD → 'needs_review'  (queued for director)
 *   <  NEEDS_REVIEW_THRESHOLD → 'unmatched'     (no link stored)
 *
 * ── Scoring weights ──────────────────────────────────────────────────────────
 *   Name   45% — most discriminating: patient name on payment vs deal lead name
 *   Amount 40% — agreed_amount or deposit_amount; partial payments allowed
 *   Date   15% — payment_date vs deal_date proximity sanity check
 */

// ── Thresholds & weights ──────────────────────────────────────────────────────

const AUTO_MATCH_THRESHOLD   = 85; // confidence ≥ 85 → auto_matched
const NEEDS_REVIEW_THRESHOLD = 50; // confidence 50-84 → needs_review; < 50 → unmatched

const WEIGHT_NAME   = 0.45;
const WEIGHT_AMOUNT = 0.40;
const WEIGHT_DATE   = 0.15;

// Amount: payments within ±AMOUNT_TOLERANCE_PCT of a deal amount score ≥ 30
const AMOUNT_TOLERANCE_PCT = 0.10; // 10 %

// Date windows (days)
const DATE_PERFECT_DAYS = 7;   // ≤ 7 days apart  → 100 pts
const DATE_GOOD_DAYS    = 30;  // ≤ 30 days apart  → 30–100 pts (linear)
const DATE_MAX_DAYS     = 90;  // > 90 days apart  → 0 pts

// ── Name normalisation ────────────────────────────────────────────────────────

/**
 * Lowercase, strip non-alphanumeric, collapse whitespace.
 */
function normaliseName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert "Surname, Firstname" → "firstname surname" so that CSV exports
 * from practice management systems (which often reverse name order) compare
 * correctly against CRM-style "Firstname Surname" entries.
 *
 * The comma check is done on the RAW string before normaliseName strips
 * punctuation — otherwise the comma would already be gone.
 */
function canonicaliseName(name) {
  if (!name) return '';
  const raw = name.trim();
  if (raw.includes(',')) {
    const [sur, fore] = raw.split(',').map(s => normaliseName(s));
    return `${fore} ${sur}`.trim();
  }
  return normaliseName(raw);
}

/**
 * Jaccard token overlap: fraction of shared words / total distinct words.
 * Returns 0–100.
 */
function tokenOverlapScore(a, b) {
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter(t => tb.has(t)).length;
  const union  = new Set([...ta, ...tb]).size;
  return Math.round((inter / union) * 100);
}

/**
 * Levenshtein edit distance.
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  // dp[i][j] = edit distance between a[0..i-1] and b[0..j-1]
  const dp = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Levenshtein similarity as 0–100 (1 - normalised distance).
 */
function levenshteinScore(a, b) {
  if (!a && !b) return 100;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  return Math.round((1 - levenshtein(a, b) / maxLen) * 100);
}

/**
 * Combined name score: maximum of token-overlap and Levenshtein similarity.
 * Both inputs are canonicalised before comparison.
 *
 * Special cases:
 *   Both absent → 50 (neutral; don't penalise if neither side has a name)
 *   One absent  →  0 (cannot match)
 */
function computeNameScore(paymentName, dealName) {
  if (!paymentName && !dealName) return 50;
  if (!paymentName || !dealName) return 0;
  const pn = canonicaliseName(paymentName);
  const dn = canonicaliseName(dealName);
  return Math.max(tokenOverlapScore(pn, dn), levenshteinScore(pn, dn));
}

// ── Amount scoring ────────────────────────────────────────────────────────────

/**
 * Compare payment gross_amount against a deal's agreed_amount and
 * deposit_amount (partial payment scenario).
 *
 * Scoring scale (best matching candidate wins):
 *   Exact match (diff = 0):      100
 *   Within 1 %:                   95
 *   Within AMOUNT_TOLERANCE_PCT:  30–95 (linear)
 *   Beyond tolerance:              0–30 (rapidly decays)
 *
 * Returns 0–100.
 */
function computeAmountScore(paymentAmount, agreedAmount, depositAmount) {
  const pAmt = Number(paymentAmount || 0);
  if (!pAmt) return 0;

  const candidates = [agreedAmount, depositAmount]
    .map(Number)
    .filter(v => !isNaN(v) && v > 0);
  if (!candidates.length) return 0;

  let best = 0;
  for (const ref of candidates) {
    const pct = Math.abs(pAmt - ref) / ref;
    let score;
    if (pct === 0)                         score = 100;
    else if (pct <= 0.01)                  score = 95;
    else if (pct <= AMOUNT_TOLERANCE_PCT)  score = Math.round(95 - 65 * (pct / AMOUNT_TOLERANCE_PCT));
    else                                   score = Math.max(0, Math.round(30 - 30 * ((pct - AMOUNT_TOLERANCE_PCT) / (1 - AMOUNT_TOLERANCE_PCT))));
    if (score > best) best = score;
  }
  return best;
}

// ── Date scoring ──────────────────────────────────────────────────────────────

/**
 * Score based on how close payment_date is to deal_date.
 *
 *   ≤ DATE_PERFECT_DAYS (7d):   100
 *   ≤ DATE_GOOD_DAYS    (30d):  30–100 (linear decay)
 *   ≤ DATE_MAX_DAYS     (90d):  0–30   (linear decay)
 *   >  DATE_MAX_DAYS           :  0
 *
 * Unknown date on either side → 25 (low neutral; don't kill good name/amount)
 */
function computeDateScore(paymentDateStr, dealDateStr) {
  if (!paymentDateStr || !dealDateStr) return 25;
  const pay  = new Date(paymentDateStr);
  const deal = new Date(dealDateStr);
  if (isNaN(pay.getTime()) || isNaN(deal.getTime())) return 0;

  const days = Math.abs(pay - deal) / 864e5; // ms → days

  if (days <= DATE_PERFECT_DAYS) return 100;
  if (days <= DATE_GOOD_DAYS)
    return Math.round(100 - 70 * ((days - DATE_PERFECT_DAYS) / (DATE_GOOD_DAYS - DATE_PERFECT_DAYS)));
  if (days <= DATE_MAX_DAYS)
    return Math.round(30 - 30 * ((days - DATE_GOOD_DAYS) / (DATE_MAX_DAYS - DATE_GOOD_DAYS)));
  return 0;
}

// ── Combined confidence ───────────────────────────────────────────────────────

/**
 * Weighted confidence for a single payment-deal pair (0–100).
 */
function computeConfidence(payment, deal) {
  const name   = computeNameScore(payment.patient_name, deal.patient_name);
  const amount = computeAmountScore(payment.gross_amount, deal.agreed_amount, deal.deposit_amount);
  const date   = computeDateScore(payment.payment_date, deal.deal_date);
  return Math.round(name * WEIGHT_NAME + amount * WEIGHT_AMOUNT + date * WEIGHT_DATE);
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Match a list of payment records against a list of treatment deals.
 *
 * @param {object}   input
 * @param {object[]} input.payments
 *   { id, patient_name, gross_amount, payment_date, external_ref? }
 *   gross_amount is the raw payment amount from the CSV/PMS.
 *
 * @param {object[]} input.deals
 *   { id, patient_name, agreed_amount, deposit_amount, deal_date }
 *   patient_name must be pre-joined from leads by the caller (route layer):
 *     SELECT CONCAT(l.first_name, ' ', COALESCE(l.last_name, '')) AS patient_name
 *   Deals that have already been matched (verification_status != 'unverified')
 *   should be excluded by the caller to avoid double-matching.
 *
 * @returns {object[]} One result per payment:
 *   { paymentId, matchedDealId, confidence, status }
 *   status: 'auto_matched' | 'needs_review' | 'unmatched'
 *   matchedDealId is null when status is 'unmatched'.
 */
function matchPayments({ payments, deals }) {
  return payments.map((payment) => {
    let bestDealId     = null;
    let bestConfidence = 0;

    for (const deal of deals) {
      const conf = computeConfidence(payment, deal);
      if (conf > bestConfidence) {
        bestConfidence = conf;
        bestDealId     = deal.id;
      }
    }

    let status;
    if (bestConfidence >= AUTO_MATCH_THRESHOLD) {
      status = 'auto_matched';
    } else if (bestConfidence >= NEEDS_REVIEW_THRESHOLD) {
      status = 'needs_review';
    } else {
      status     = 'unmatched';
      bestDealId = null; // don't store a weak suggestion
    }

    return {
      paymentId:     payment.id,
      matchedDealId: bestDealId,
      confidence:    bestConfidence,
      status,
    };
  });
}

module.exports = {
  matchPayments,
  THRESHOLDS: { AUTO_MATCH_THRESHOLD, NEEDS_REVIEW_THRESHOLD },
  _internal: {
    canonicaliseName,
    tokenOverlapScore,
    levenshteinScore,
    computeNameScore,
    computeAmountScore,
    computeDateScore,
    computeConfidence,
  },
};

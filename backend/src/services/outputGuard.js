'use strict';

// Output filter (GECE-4-BRIEFI.md Bölüm B) — the SECOND line of defense,
// after promptCompiler.js's pricing-authority prompt rule ("İki katmanlı
// savunma — prompt yeterli değil"). An LLM can still slip past its own
// system prompt under pressure (jailbreak-style phrasing) or plain
// inconsistency; this runs AFTER generation, BEFORE the reply reaches
// WhatsApp, and blocks anything the branch's pricing authority forbids —
// no matter how the model phrased it or why.

const NO_PRICE_AUTHORITIES = new Set(['qualification_only', 'logistics_only']);

// Currency symbol/code directly touching a number — the unambiguous case.
const CURRENCY_NUMBER_PATTERN = /(?:[₺€$£]\s?\d[\d.,]*|\d[\d.,]*\s?[₺€$£]|\b(?:TL|EUR|USD|GBP)\b\s?\d[\d.,]*|\d[\d.,]*\s?\b(?:TL|EUR|USD|GBP)\b)/i;

// Price-shaped PHRASES without necessarily a bare currency+number pair —
// this is the part that catches "sadece yaklaşık söyle" / "just ballpark
// it" style jailbreak attempts, where the model might soften the number
// into a phrase instead of a clean "€X". Deliberately over-inclusive
// (better a false positive escalated to a human than a leaked price) —
// covers TR/EN/DE/RU/AR per GECE-4-BRIEFI.md Bölüm B's explicit ask.
const PRICE_PHRASE_PATTERN = new RegExp([
  // English
  'approx(?:imately)?', 'starting from', 'starts from', 'from \\$', 'from €', 'from £',
  'between .{0,25} and .{0,15}(?:€|\\$|£|euros?|dollars?|pounds?)', 'price range', 'cost(?:s)? around', 'ballpark',
  // Turkish
  'yaklaşık', 'civarında', 'fiyat\\s*aralığ', 'fiyat\\s*band', 'başlayan fiyat', '\\bbin\\b\\s*(tl|lira|euro|dolar)',
  // German
  '\\bab\\s?€', '\\bcirca\\b', 'zwischen .{0,25} und', 'ungefähr',
  // Russian
  'примерно', 'около', '\\bот\\s?\\d',
  // Arabic
  'تقريبا', 'حوالي', 'يبدأ من',
].join('|'), 'i');

function containsPriceLanguage(text) {
  if (!text) return false;
  return CURRENCY_NUMBER_PATTERN.test(text) || PRICE_PHRASE_PATTERN.test(text);
}

// Deliberately NARROW — this is not a general medical-content filter (that
// would false-positive on ordinary conversation about the patient's own
// treatment). It targets the specific leak shape Bölüm C.2 warns about:
// the AI repeating a vision-model's internal structured read back to the
// patient as if it were a diagnosis or eligibility decision.
const MEDICAL_INFERENCE_PATTERN = /\bnorwood\s*(?:stage|evre)?\s*\d\b|\byou (?:are|seem to be|look like)\s+(?:a good |an? )?candidate\b|\byou(?:'re| are)\s+eligible\b|\b\d+\s*(?:grafts?|greft)\b|\byou(?:'re| are)\s+not\s+eligible\b/i;

function containsMedicalInferenceLeak(text) {
  if (!text) return false;
  return MEDICAL_INFERENCE_PATTERN.test(text);
}

/**
 * checkPricingOutput — the branch pricing-authority enforcement itself.
 *   qualification_only / logistics_only: ANY price-shaped text blocks, always.
 *   range_after_imaging: price-shaped text blocks unless imaging is on file.
 *   range_from_photo: price-shaped text blocks unless a qualifying photo is on file.
 *   full: never blocked by this check (the prompt's base PRICE RULE — only
 *   quote what's in the knowledge base — is enforced by the model itself;
 *   this filter's job is authority-level enforcement, not fact-checking).
 */
function checkPricingOutput({ authority, replyText, hasQualifyingPhoto = false, hasImaging = false }) {
  if (!containsPriceLanguage(replyText)) return { blocked: false };

  if (NO_PRICE_AUTHORITIES.has(authority)) {
    return { blocked: true, reason: `pricing_authority_violation:${authority}` };
  }
  if (authority === 'range_after_imaging' && !hasImaging) {
    return { blocked: true, reason: 'pricing_authority_violation:range_after_imaging_no_imaging' };
  }
  if (authority === 'range_from_photo' && !hasQualifyingPhoto) {
    return { blocked: true, reason: 'pricing_authority_violation:range_from_photo_no_photo' };
  }
  return { blocked: false };
}

function checkMedicalInferenceOutput(replyText) {
  if (containsMedicalInferenceLeak(replyText)) {
    return { blocked: true, reason: 'medical_inference_leak' };
  }
  return { blocked: false };
}

/**
 * guardOutboundMessage — the single "about to send" gate every outbound AI
 * message passes through (GECE-4-BRIEFI.md Bölüm E: this and
 * complianceGuard.js must be "aynı zincirde... tek bir kapı", not two
 * separate call sites). complianceGuard is required lazily so this file
 * has no hard load-time dependency on it — Bölüm B (this file) ships
 * before Bölüm E (complianceGuard.js) in tonight's sequence, and a
 * missing module simply means compliance checking is skipped, not a crash.
 */
function guardOutboundMessage({ replyText, authority, hasQualifyingPhoto = false, hasImaging = false, language = 'en', skipCompliance = false }) {
  const pricingCheck = checkPricingOutput({ authority, replyText, hasQualifyingPhoto, hasImaging });
  if (pricingCheck.blocked) return pricingCheck;

  const medicalCheck = checkMedicalInferenceOutput(replyText);
  if (medicalCheck.blocked) return medicalCheck;

  if (!skipCompliance) {
    let complianceGuard;
    try {
      complianceGuard = require('./complianceGuard');
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') throw err;
    }
    if (complianceGuard) {
      const complianceCheck = complianceGuard.checkOutboundCompliance(replyText, { language });
      if (complianceCheck.blocked) return complianceCheck;
    }
  }

  return { blocked: false };
}

module.exports = {
  containsPriceLanguage,
  containsMedicalInferenceLeak,
  checkPricingOutput,
  checkMedicalInferenceOutput,
  guardOutboundMessage,
};

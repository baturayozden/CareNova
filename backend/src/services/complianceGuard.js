'use strict';

// GECE-4-BRIEFI.md Bölüm E — "Mevzuat Kalkanı" (KVKK + Sağlık Bakanlığı
// Tanıtım Yönetmeliği). The brief's own text claims this file "was placed
// as a skeleton in Gece 2" — grepped the entire backend/src tree and
// GECE-LOG.md end to end, no such file and no such mention exist anywhere.
// Treating that as a factual error in the brief (logged in GECE-LOG.md's
// Bölüm E entry) and building this as a real, working filter from scratch.
//
// Runs INSIDE outputGuard.js's guardOutboundMessage — the single "about to
// send" gate the brief explicitly asks for ("tek bir 'gönderilmeden önce'
// kapısı olsun, iki ayrı yer değil"), not a second, separate call site.
// outputGuard.js lazily requires this module and prefixes whatever `reason`
// comes back with 'compliance:' before returning it up the chain — that
// prefix is how services/ai.js's generateFollowUp knows to write a
// compliance_events row (this module's own logComplianceEvent, below)
// rather than treating it as a pricing/medical-inference block.

const { pool } = require('../db/index');

// TR/domestic-targeted price/discount/campaign language — the Tanıtım
// Yönetmeliği forbids advertising treatment prices, discounts, or
// promotional campaigns to the public. This module doesn't attempt to
// detect "is the recipient a Turkish resident" (that's a routing decision
// outside a text filter's reach) — it blocks the LANGUAGE PATTERN of a
// domestic promotional/discount announcement outright, which is the safe
// default in both directions (a genuinely permitted quote is not phrased
// like a campaign).
const CAMPAIGN_PATTERN = new RegExp([
  'kampanya', '\\bindirim', 'fırsat fiyat', 'i̇ndirimli fiyat', 'özel fiyat',
  '%\\s?\\d+\\s*indirim', 'sınırlı süre(?:li)?\\s*(?:fiyat|kampanya|teklif)', 'son gün(?:e kadar)? fırsat',
  'special (?:discount|offer|price) campaign', 'limited.?time (?:discount|offer)',
].join('|'), 'i');

// Sharing another patient's review, testimonial, or thank-you message.
// This is distinct from the AI describing the CLINIC's own facts (licensing,
// doctor experience) — those stay allowed via the knowledge base.
const TESTIMONIAL_PATTERN = new RegExp([
  'hasta yorumu', 'hasta yorumlar', 'diğer hastalar(?:ımız)? (?:dedi|söyledi|yazdı|paylaştı)',
  'teşekkür mesaj', 'hasta referans', 'diğer hastaların? deneyim',
  '(?:here.?s|this is) what .{0,20}patient(?:s)? said', 'patient testimonial',
  'read what our patients (?:say|wrote)', 'thank.?you message from (?:a|our|another) patient',
].join('|'), 'i');

// Outcome-guarantee language — no medical procedure can be promised a
// certain/100% result; this is both a KVKK/advertising-rules violation and
// (independently) unsafe from a patient-expectations standpoint.
const OUTCOME_GUARANTEE_PATTERN = new RegExp([
  'kesin sonuç', '%\\s?100\\s*başarı', 'garantili sonuç', 'garanti ediyoruz', 'kesinlikle başarılı',
  'başarısı garanti', 'riski yok(?:tur)?',
  'guaranteed? result', '100%\\s*success', '\\bwe guarantee\\b', 'certain(?:ly)? successful', 'zero risk', 'no risk at all',
].join('|'), 'i');

// Before/after image sharing without Ek-1 (informed consent) on file. The
// AI pipeline never actually attaches images to an outbound WhatsApp
// message (whatsapp.sendText is text-only throughout this codebase) — so
// in practice this catches the AI TEXTUALLY promising to send before/after
// photos, which is the shape the risk actually takes here.
const BEFORE_AFTER_PATTERN = new RegExp([
  'öncesi.{0,8}sonrası (?:fotoğ|görsel)', 'önce.{0,3}sonra (?:fotoğ|görsel|resim)',
  'size (?:öncesi.{0,8}sonrası|önce.{0,3}sonra) (?:fotoğraf|görsel)lerini? (?:gönder|payla)',
  'before.{0,8}after (?:photo|picture|image)', 'sending you (?:the )?before.{0,8}after',
].join('|'), 'i');

// Medical-advice-shaped output — prescriptive language (dosage, a stated
// diagnosis, a prescription) that only a doctor may give. Narrower than
// outputGuard.js's own MEDICAL_INFERENCE_PATTERN (which targets vision-
// extraction leaks specifically); this targets the AI acting as a doctor
// outright.
const MEDICAL_ADVICE_PATTERN = new RegExp([
  'you should take \\d', 'i recommend (?:taking|you take)', 'my diagnosis is', '\\bdiagnosis:',
  '\\btake \\d+\\s?mg\\b', 'şu ilacı kullan', 'teşhisim(?:iz)?(?:dir)?', 'reçete ediyorum', 'ilacı (?:günde|saatte) \\d+ kez',
].join('|'), 'i');

// Order matters only for which `rule` gets reported when text somehow
// matches more than one pattern — every match still blocks the same way.
const RULES = [
  { rule: 'domestic_campaign_price', pattern: CAMPAIGN_PATTERN },
  { rule: 'testimonial_share', pattern: TESTIMONIAL_PATTERN },
  { rule: 'outcome_guarantee', pattern: OUTCOME_GUARANTEE_PATTERN },
  { rule: 'before_after_no_consent', pattern: BEFORE_AFTER_PATTERN },
  { rule: 'medical_advice_shaped', pattern: MEDICAL_ADVICE_PATTERN },
];

/**
 * checkOutboundCompliance — the function outputGuard.js's
 * guardOutboundMessage calls (contract: `(text, { language }) =>
 * { blocked, reason? }`). Pure, synchronous-shaped (no DB) so it's cheap to
 * call on every outbound message and trivial to unit test.
 */
function checkOutboundCompliance(replyText, { language } = {}) {
  void language; // reserved for language-specific rules; every pattern above is already multi-language
  if (!replyText) return { blocked: false };
  for (const { rule, pattern } of RULES) {
    if (pattern.test(replyText)) {
      return { blocked: true, reason: `compliance:${rule}` };
    }
  }
  return { blocked: false };
}

/**
 * logComplianceEvent — append-only write to compliance_events (migration
 * 061). Called from services/ai.js's generateFollowUp, not from this
 * module's own check function — checkOutboundCompliance stays a pure
 * filter with no DB dependency; the write happens at the one call site
 * that actually has tenantId/leadId/caseId in scope. Never throws: a
 * logging failure must not take down the reply pipeline.
 */
async function logComplianceEvent({ tenantId, leadId = null, caseId = null, rule, blockedText, language = null, actor = 'ai' }) {
  if (!tenantId || !rule) return null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO compliance_events (tenant_id, lead_id, case_id, rule, blocked_text, language, actor)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, leadId, caseId, rule, blockedText || null, language, actor],
    );
    return rows[0];
  } catch (err) {
    console.error('[ComplianceGuard] failed to log compliance_events row:', err.message);
    return null;
  }
}

module.exports = { checkOutboundCompliance, logComplianceEvent, RULES };

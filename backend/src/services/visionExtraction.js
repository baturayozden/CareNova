'use strict';

// GECE-4-BRIEFI.md Bölüm C.2 — structured image/document understanding.
// Same mock-only-tonight philosophy as transcription.js: no real Claude
// vision call exists in this environment (MUTLAK YASAK #5), the
// interface is written and tested with a deterministic mock provider.
//
// 🔴 MUTLAK KURAL (also enforced independently by promptCompiler.js's
// MEDICAL INFERENCE RULE and outputGuard.js's checkMedicalInferenceOutput):
// the output of this module is NEVER shown to the patient. Its only
// consumer is case_media.ai_extraction — doctor-only, via the doctor
// approval queue. This module has no patient-facing code path at all.

const BRANCH_SCHEMAS = {
  hair_transplant: ['norwoodEstimate', 'donorDensityNote', 'imageQuality', 'matchedSlot'],
  dental: ['visibleMissingTeeth', 'imageType', 'imageQuality', 'matchedSlot'],
  // Every other branch (and any document, regardless of branch) uses the
  // general schema — a branch with no photo-analysis schema of its own
  // still needs document classification (passport, insurance letter, ...).
  general: ['documentType', 'extractedText', 'relevance'],
};

const IMAGE_QUALITY_VALUES = ['good', 'blurry', 'poor_lighting', 'wrong_angle', 'unclear'];

function schemaForBranch(branchKey) {
  return BRANCH_SCHEMAS[branchKey] || BRANCH_SCHEMAS.general;
}

/**
 * Mock provider — deterministic, offline. Test fixtures pass `mockResult`
 * to control the exact structured output; without it, returns a
 * plausible "good quality, matched, needs doctor review" placeholder
 * shaped for the requested branch's schema.
 */
async function mockProvider({ branchKey, mockResult } = {}) {
  if (mockResult) return { ...mockResult, provider: 'mock' };

  if (branchKey === 'hair_transplant') {
    return {
      norwoodEstimate: 'Norwood 4 (estimate — doctor review required)',
      donorDensityNote: 'Donor density appears adequate in this image',
      imageQuality: 'good',
      matchedSlot: null,
      provider: 'mock',
    };
  }
  if (branchKey === 'dental') {
    return {
      visibleMissingTeeth: null,
      imageType: 'photo',
      imageQuality: 'good',
      matchedSlot: null,
      provider: 'mock',
    };
  }
  return {
    documentType: 'unknown',
    extractedText: '',
    relevance: 'unclear — doctor review required',
    provider: 'mock',
  };
}

/**
 * Real provider placeholder — never reachable unless VISION_PROVIDER is
 * deliberately set away from the default 'mock' (nothing in this
 * codebase does that yet). See transcription.js's openaiWhisperProvider
 * for the identical reasoning.
 */
async function claudeVisionProvider() {
  throw new Error(
    'visionExtraction.js: VISION_PROVIDER="claude_vision" is not implemented — ' +
    'no API key exists in this environment tonight (MUTLAK YASAK #5). ' +
    'Set VISION_PROVIDER=mock (the default) until a real provider is wired up.',
  );
}

const PROVIDERS = { mock: mockProvider, claude_vision: claudeVisionProvider };

/**
 * extractFromImage — the only function callers should use.
 * @param {Buffer} buffer - downloaded image/document bytes (unused by the mock provider)
 * @param {string} mimeType
 * @param {string} branchKey - selects the output schema (BRANCH_SCHEMAS); null/unknown -> 'general'
 * @param {object} opts - mock-only overrides (mockResult), plus whatever a
 *   real provider eventually needs (requiredMediaSlots for matching, etc.)
 */
async function extractFromImage(buffer, mimeType, branchKey, opts = {}) {
  const providerName = process.env.VISION_PROVIDER || 'mock';
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`visionExtraction.js: unknown VISION_PROVIDER "${providerName}". Known providers: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  return provider({ buffer, mimeType, branchKey, ...opts });
}

function isQualityInsufficient(extraction) {
  return extraction?.imageQuality != null && extraction.imageQuality !== 'good';
}

module.exports = {
  extractFromImage,
  schemaForBranch,
  isQualityInsufficient,
  BRANCH_SCHEMAS,
  IMAGE_QUALITY_VALUES,
  PROVIDERS,
};

'use strict';

// GECE-4-BRIEFI.md Bölüm C.1 — voice note transcription, provider
// abstraction. No real API key exists tonight (MUTLAK YASAK #5) — the
// only provider actually wired up and callable is 'mock'. TRANSCRIPTION_PROVIDER
// selects which one runs; anything other than 'mock' throws a clear
// configuration error rather than silently pretending to work, so a
// misconfigured env var fails loudly in staging instead of quietly
// returning fake transcripts in production.

/**
 * Mock provider — deterministic, offline. Returns a plausible transcript
 * shaped exactly like a real provider's response so downstream code
 * (case_media.ai_extraction, the AI pipeline) never has to know the
 * difference. Test fixtures pass `mockTranscript`/`mockLanguage` to
 * control the output; without them it returns a generic placeholder.
 */
async function mockProvider({ mockTranscript, mockLanguage, mockConfidence } = {}) {
  return {
    transcript: mockTranscript ?? '[mock transcript unavailable]',
    detectedLanguage: mockLanguage ?? 'en',
    confidence: mockConfidence ?? 0.92,
    provider: 'mock',
  };
}

/**
 * Real provider placeholder — GECE-4-BRIEFI.md is explicit: "Bu gece
 * gerçek çağrı YOK, mock sağlayıcı yaz ve testleri onunla geç." This
 * function exists so the abstraction is complete and the integration
 * point is obvious for whoever wires a real key in later, but it must
 * never be reachable without TRANSCRIPTION_PROVIDER being deliberately
 * set to something other than 'mock' (which nothing in this codebase
 * does yet).
 */
async function openaiWhisperProvider() {
  throw new Error(
    'transcription.js: TRANSCRIPTION_PROVIDER="openai_whisper" is not implemented — ' +
    'no API key exists in this environment tonight (MUTLAK YASAK #5). ' +
    'Set TRANSCRIPTION_PROVIDER=mock (the default) until a real provider is wired up.',
  );
}

const PROVIDERS = {
  mock: mockProvider,
  openai_whisper: openaiWhisperProvider,
};

/**
 * transcribeAudio — the only function callers should use.
 * @param {Buffer} buffer - downloaded audio bytes (unused by the mock provider)
 * @param {string} mimeType - e.g. 'audio/ogg; codecs=opus' (unused by the mock provider)
 * @param {object} opts - mock-only overrides (mockTranscript/mockLanguage/mockConfidence),
 *   plus whatever a real provider will eventually need (apiKey, model, ...)
 * @returns {Promise<{ transcript: string, detectedLanguage: string, confidence: number, provider: string }>}
 */
async function transcribeAudio(buffer, mimeType, opts = {}) {
  const providerName = process.env.TRANSCRIPTION_PROVIDER || 'mock';
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`transcription.js: unknown TRANSCRIPTION_PROVIDER "${providerName}". Known providers: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  return provider({ buffer, mimeType, ...opts });
}

module.exports = { transcribeAudio, PROVIDERS };

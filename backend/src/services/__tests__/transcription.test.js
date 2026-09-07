'use strict';

// GECE-4-BRIEFI.md Bölüm C.1 — transcription.js provider abstraction.
// MUTLAK YASAK #5: no real API call exists tonight; every test here uses
// the mock provider. The 'openai_whisper' provider is tested only for its
// "not implemented" failure — it must never be reachable by accident.

const { transcribeAudio, PROVIDERS } = require('../transcription');

describe('transcription — mock provider (default)', () => {
  const OLD_ENV = process.env.TRANSCRIPTION_PROVIDER;
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.TRANSCRIPTION_PROVIDER;
    else process.env.TRANSCRIPTION_PROVIDER = OLD_ENV;
  });

  test('TRANSCRIPTION_PROVIDER unset → uses mock, returns a placeholder shape', async () => {
    delete process.env.TRANSCRIPTION_PROVIDER;
    const result = await transcribeAudio(Buffer.from('fake-audio'), 'audio/ogg');
    expect(result.provider).toBe('mock');
    expect(typeof result.transcript).toBe('string');
    expect(typeof result.detectedLanguage).toBe('string');
    expect(typeof result.confidence).toBe('number');
  });

  test('TRANSCRIPTION_PROVIDER=mock explicitly → same behaviour', async () => {
    process.env.TRANSCRIPTION_PROVIDER = 'mock';
    const result = await transcribeAudio(Buffer.from('x'), 'audio/ogg', {
      mockTranscript: 'Merhaba, saç ekimi hakkında bilgi almak istiyorum',
      mockLanguage: 'tr',
      mockConfidence: 0.88,
    });
    expect(result).toEqual({
      transcript: 'Merhaba, saç ekimi hakkında bilgi almak istiyorum',
      detectedLanguage: 'tr',
      confidence: 0.88,
      provider: 'mock',
    });
  });

  test('no mock overrides → deterministic placeholder, not empty', async () => {
    const result = await transcribeAudio(Buffer.from('x'), 'audio/ogg');
    expect(result.transcript.length).toBeGreaterThan(0);
  });
});

describe('transcription — real-provider stub never silently succeeds', () => {
  const OLD_ENV = process.env.TRANSCRIPTION_PROVIDER;
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.TRANSCRIPTION_PROVIDER;
    else process.env.TRANSCRIPTION_PROVIDER = OLD_ENV;
  });

  test('TRANSCRIPTION_PROVIDER=openai_whisper throws a clear "not implemented" error', async () => {
    process.env.TRANSCRIPTION_PROVIDER = 'openai_whisper';
    await expect(transcribeAudio(Buffer.from('x'), 'audio/ogg')).rejects.toThrow(/not implemented/i);
  });

  test('unknown provider name throws rather than silently falling back', async () => {
    process.env.TRANSCRIPTION_PROVIDER = 'some_future_provider';
    await expect(transcribeAudio(Buffer.from('x'), 'audio/ogg')).rejects.toThrow(/unknown TRANSCRIPTION_PROVIDER/i);
  });

  test('PROVIDERS map exposes exactly mock + openai_whisper tonight', () => {
    expect(Object.keys(PROVIDERS).sort()).toEqual(['mock', 'openai_whisper']);
  });
});

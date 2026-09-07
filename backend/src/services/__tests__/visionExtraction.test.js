'use strict';

// GECE-4-BRIEFI.md Bölüm C.2 — visionExtraction.js provider abstraction +
// branch schemas. MUTLAK YASAK #5: mock only tonight. The single most
// important property tested here is the 🔴 MUTLAK KURAL boundary itself —
// this module's output shape is structural data for case_media.ai_extraction,
// never prose meant for a patient (that boundary is enforced elsewhere, by
// promptCompiler.js and outputGuard.js, but the shape has to stay structural
// for those defenses to have something to check).

const {
  extractFromImage, schemaForBranch, isQualityInsufficient,
  BRANCH_SCHEMAS, IMAGE_QUALITY_VALUES, PROVIDERS,
} = require('../visionExtraction');

describe('visionExtraction — schemaForBranch', () => {
  test('known branches return their own schema', () => {
    expect(schemaForBranch('hair_transplant')).toEqual(BRANCH_SCHEMAS.hair_transplant);
    expect(schemaForBranch('dental')).toEqual(BRANCH_SCHEMAS.dental);
  });

  test('unknown/null branch falls back to general', () => {
    expect(schemaForBranch('oncology')).toEqual(BRANCH_SCHEMAS.general);
    expect(schemaForBranch(null)).toEqual(BRANCH_SCHEMAS.general);
    expect(schemaForBranch(undefined)).toEqual(BRANCH_SCHEMAS.general);
  });
});

describe('visionExtraction — mock provider (default)', () => {
  const OLD_ENV = process.env.VISION_PROVIDER;
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.VISION_PROVIDER;
    else process.env.VISION_PROVIDER = OLD_ENV;
  });

  test('hair_transplant branch → norwoodEstimate/donorDensityNote shape', async () => {
    delete process.env.VISION_PROVIDER;
    const result = await extractFromImage(Buffer.from('x'), 'image/jpeg', 'hair_transplant');
    expect(result.provider).toBe('mock');
    expect(result).toHaveProperty('norwoodEstimate');
    expect(result).toHaveProperty('donorDensityNote');
    expect(result).toHaveProperty('imageQuality');
    expect(result).toHaveProperty('matchedSlot');
  });

  test('dental branch → visibleMissingTeeth/imageType shape', async () => {
    const result = await extractFromImage(Buffer.from('x'), 'image/jpeg', 'dental');
    expect(result).toHaveProperty('visibleMissingTeeth');
    expect(result).toHaveProperty('imageType');
    expect(result).toHaveProperty('imageQuality');
  });

  test('unknown branch (e.g. a document, or a branch with no photo schema) → general shape', async () => {
    const result = await extractFromImage(Buffer.from('x'), 'application/pdf', 'oncology');
    expect(result).toHaveProperty('documentType');
    expect(result).toHaveProperty('extractedText');
    expect(result).toHaveProperty('relevance');
  });

  test('mockResult override is returned verbatim (tagged with provider)', async () => {
    const mockResult = { imageQuality: 'blurry', matchedSlot: 'on_gorunum', norwoodEstimate: null, donorDensityNote: null };
    const result = await extractFromImage(Buffer.from('x'), 'image/jpeg', 'hair_transplant', { mockResult });
    expect(result).toEqual({ ...mockResult, provider: 'mock' });
  });
});

describe('visionExtraction — isQualityInsufficient', () => {
  test('imageQuality "good" is sufficient', () => {
    expect(isQualityInsufficient({ imageQuality: 'good' })).toBe(false);
  });

  test.each(IMAGE_QUALITY_VALUES.filter(v => v !== 'good'))('imageQuality "%s" is insufficient', (quality) => {
    expect(isQualityInsufficient({ imageQuality: quality })).toBe(true);
  });

  test('missing imageQuality (e.g. a document extraction) is treated as sufficient, not blocked', () => {
    expect(isQualityInsufficient({ documentType: 'passport' })).toBe(false);
  });
});

describe('visionExtraction — real-provider stub never silently succeeds', () => {
  const OLD_ENV = process.env.VISION_PROVIDER;
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.VISION_PROVIDER;
    else process.env.VISION_PROVIDER = OLD_ENV;
  });

  test('VISION_PROVIDER=claude_vision throws a clear "not implemented" error', async () => {
    process.env.VISION_PROVIDER = 'claude_vision';
    await expect(extractFromImage(Buffer.from('x'), 'image/jpeg', 'dental')).rejects.toThrow(/not implemented/i);
  });

  test('unknown provider name throws rather than silently falling back', async () => {
    process.env.VISION_PROVIDER = 'some_future_provider';
    await expect(extractFromImage(Buffer.from('x'), 'image/jpeg', 'dental')).rejects.toThrow(/unknown VISION_PROVIDER/i);
  });

  test('PROVIDERS map exposes exactly mock + claude_vision tonight', () => {
    expect(Object.keys(PROVIDERS).sort()).toEqual(['claude_vision', 'mock']);
  });
});

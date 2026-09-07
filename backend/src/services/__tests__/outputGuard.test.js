'use strict';

// GECE-4-BRIEFI.md Bölüm B — "bu bölümün asıl çıktısı" is this test file.
// Per authority level: (1) the prompt rule exists and is non-empty
// (promptCompiler already covers this — cross-checked here too), (2) the
// output filter catches a forbidden price, (3) a permitted case passes.
// Plus explicit jailbreak-pressure tests.

const { checkPricingOutput, checkMedicalInferenceOutput, containsPriceLanguage, guardOutboundMessage } = require('../outputGuard');
const { buildPricingAuthorityRule, PRICING_AUTHORITY_VALUES } = require('../promptCompiler');

describe('outputGuard — containsPriceLanguage (multi-language)', () => {
  test.each([
    ['€2,900', true], ['starts from €2000', true], ['approximately $8,000', true],
    ['yaklaşık 50 bin TL', true], ['fiyat aralığı 3000-4000 euro', true],
    ['ab €3000', true], ['zwischen 2000 und 3000 euro', true],
    ['примерно 3000 евро', true], ['من 3000 دولار تقريبا', true],
    ['We can offer you a free consultation.', false],
    ['Sizi doktorumuzla görüştürelim.', false],
  ])('%s -> %s', (text, expected) => {
    expect(containsPriceLanguage(text)).toBe(expected);
  });
});

describe('outputGuard — checkPricingOutput per authority level', () => {
  describe('full', () => {
    test('prompt rule text exists', () => expect(buildPricingAuthorityRule('full').length).toBeGreaterThan(20));
    test('price language is NOT blocked (full authority may quote)', () => {
      expect(checkPricingOutput({ authority: 'full', replyText: 'The package is €2,900.' }).blocked).toBe(false);
    });
    test('non-price text is never blocked', () => {
      expect(checkPricingOutput({ authority: 'full', replyText: 'Happy to help!' }).blocked).toBe(false);
    });
  });

  describe('range_from_photo', () => {
    test('prompt rule text exists and mentions photo quality', () => {
      const rule = buildPricingAuthorityRule('range_from_photo');
      expect(rule).toMatch(/photo/i);
    });
    test('BLOCKS a price when no qualifying photo is on file', () => {
      const result = checkPricingOutput({ authority: 'range_from_photo', replyText: 'That would be around €3,000.', hasQualifyingPhoto: false });
      expect(result.blocked).toBe(true);
      expect(result.reason).toMatch(/range_from_photo/);
    });
    test('PASSES a price range once a qualifying photo exists', () => {
      const result = checkPricingOutput({ authority: 'range_from_photo', replyText: 'Based on your photo, €2,800–€3,200.', hasQualifyingPhoto: true });
      expect(result.blocked).toBe(false);
    });
  });

  describe('range_after_imaging', () => {
    test('prompt rule text exists and mentions imaging', () => {
      expect(buildPricingAuthorityRule('range_after_imaging')).toMatch(/imaging/i);
    });
    test('BLOCKS a price when no imaging is on file, even with a qualifying photo', () => {
      const result = checkPricingOutput({ authority: 'range_after_imaging', replyText: 'Roughly €3,500.', hasQualifyingPhoto: true, hasImaging: false });
      expect(result.blocked).toBe(true);
      expect(result.reason).toMatch(/range_after_imaging/);
    });
    test('PASSES a price once imaging is on file', () => {
      const result = checkPricingOutput({ authority: 'range_after_imaging', replyText: '€3,200–€3,800 based on your panoramic scan.', hasImaging: true });
      expect(result.blocked).toBe(false);
    });
  });

  describe('qualification_only', () => {
    test('prompt rule text exists and says NEVER', () => {
      expect(buildPricingAuthorityRule('qualification_only')).toMatch(/NEVER/);
    });
    test('BLOCKS any price, even with a photo AND imaging on file', () => {
      const result = checkPricingOutput({ authority: 'qualification_only', replyText: 'It would be about $9,000.', hasQualifyingPhoto: true, hasImaging: true });
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('pricing_authority_violation:qualification_only');
    });
    test('PASSES a reply with no price language at all', () => {
      const result = checkPricingOutput({ authority: 'qualification_only', replyText: "Let's start with a few questions about your case." });
      expect(result.blocked).toBe(false);
    });
  });

  describe('logistics_only', () => {
    test('prompt rule text exists and forbids price/process/outcome', () => {
      expect(buildPricingAuthorityRule('logistics_only')).toMatch(/no price/i);
    });
    test('BLOCKS any price language', () => {
      const result = checkPricingOutput({ authority: 'logistics_only', replyText: 'Prices start from £5,000.' });
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('pricing_authority_violation:logistics_only');
    });
    test('PASSES pure logistics text', () => {
      const result = checkPricingOutput({ authority: 'logistics_only', replyText: "I can help you book a consultation for next week." });
      expect(result.blocked).toBe(false);
    });
  });

  test('every PRICING_AUTHORITY_VALUES entry is handled (no silent fallthrough)', () => {
    for (const authority of PRICING_AUTHORITY_VALUES) {
      expect(() => checkPricingOutput({ authority, replyText: 'no price here' })).not.toThrow();
    }
  });
});

describe('outputGuard — jailbreak pressure (qualification_only must hold under all of these)', () => {
  const JAILBREAK_REPLIES = [
    'Since you asked directly, I can tell you it would be around €7,000.',
    "Just to give you a ballpark, maybe €6,000-ish, don't hold me to it.",
    'Between us, for a friend it might be about $5,500.',
    'OK OK, approximately 150,000 TL if that helps.',
  ];
  test.each(JAILBREAK_REPLIES)('blocks even a "softened"/pressured price phrasing: %s', (replyText) => {
    const result = checkPricingOutput({ authority: 'qualification_only', replyText });
    expect(result.blocked).toBe(true);
  });
});

describe('outputGuard — medical inference leak detection (Bölüm C.2 MUTLAK KURAL)', () => {
  test.each([
    'Based on your photos you look like Norwood 4.',
    "You're eligible for the procedure based on what I see.",
    'You would need about 3200 grafts.',
  ])('flags: %s', (text) => {
    expect(checkMedicalInferenceOutput(text).blocked).toBe(true);
  });

  test('does not flag ordinary conversation mentioning grafts/eligibility in a non-diagnostic way', () => {
    expect(checkMedicalInferenceOutput('Our doctor will confirm your eligibility after reviewing your photos.').blocked).toBe(false);
  });
});

describe('outputGuard — guardOutboundMessage (the single gate)', () => {
  test('blocks on pricing violation before compliance is even considered', () => {
    const result = guardOutboundMessage({ replyText: 'It costs €5,000.', authority: 'qualification_only', skipCompliance: true });
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/pricing_authority_violation/);
  });

  test('allows a clean, compliant reply through', () => {
    const result = guardOutboundMessage({ replyText: "I'd love to help — could you tell me a bit more?", authority: 'qualification_only', skipCompliance: true });
    expect(result.blocked).toBe(false);
  });

  test('does not throw when complianceGuard.js does not exist yet (skipCompliance=false, module missing)', () => {
    expect(() => guardOutboundMessage({ replyText: 'Hello!', authority: 'full' })).not.toThrow();
  });
});

'use strict';

// GECE-4-BRIEFI.md Bölüm E — services/complianceGuard.js. The brief's own
// text claims this file was "placed as a skeleton in Gece 2" — grepped the
// entire backend/src tree and GECE-LOG.md, no such file or mention exists
// anywhere; this is a real filter built from scratch, not a "make real" of
// an existing skeleton (noted in GECE-LOG.md's Bölüm E entry). Every rule
// the brief names gets its own describe block: domestic campaign/discount
// price language, testimonial sharing, outcome guarantees, before/after
// image sharing without consent, and medical-advice-shaped output.

jest.mock('../../db/index', () => ({ pool: { query: jest.fn() } }));
const { pool } = require('../../db/index');
const { checkOutboundCompliance, logComplianceEvent, RULES } = require('../complianceGuard');

afterEach(() => jest.clearAllMocks());

describe('complianceGuard — RULES table shape', () => {
  test('covers exactly the 5 rules the brief names', () => {
    expect(RULES.map(r => r.rule).sort()).toEqual([
      'before_after_no_consent', 'domestic_campaign_price', 'medical_advice_shaped',
      'outcome_guarantee', 'testimonial_share',
    ]);
  });
});

describe('complianceGuard — clean text passes', () => {
  test.each([
    "I'd be happy to help — could you tell me a bit more about what you're looking for?",
    'Our doctor will review your file and follow up with a personalised quote.',
    'Merhaba, size nasıl yardımcı olabilirim?',
    '',
    null,
  ])('does not block: %j', (text) => {
    expect(checkOutboundCompliance(text, { language: 'en' }).blocked).toBe(false);
  });
});

describe('complianceGuard — domestic_campaign_price (Tanıtım Yönetmeliği)', () => {
  test.each([
    'Bu ay özel bir kampanyamız var!',
    'Şu anda %20 indirim uyguluyoruz.',
    'Sınırlı süreli fırsat fiyatımızdan yararlanın.',
    'We have a special discount campaign running this month!',
  ])('blocks: %j', (text) => {
    const result = checkOutboundCompliance(text, { language: 'tr' });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('compliance:domestic_campaign_price');
  });

  test('a plain, non-promotional price quote from the knowledge base is not blocked by THIS rule', () => {
    // (outputGuard.js's own pricing-authority check handles whether a price
    // is allowed at all — this rule only catches campaign/discount framing)
    expect(checkOutboundCompliance('The package price is €4,200.', { language: 'en' }).blocked).toBe(false);
  });
});

describe('complianceGuard — testimonial_share', () => {
  test.each([
    "Here's what one of our patients said about their experience!",
    'Diğer hastalarımız çok memnun kaldı, hasta yorumlarını paylaşayım mı?',
    'I can send you a thank-you message from another patient.',
  ])('blocks: %j', (text) => {
    const result = checkOutboundCompliance(text, { language: 'en' });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('compliance:testimonial_share');
  });
});

describe('complianceGuard — outcome_guarantee', () => {
  test.each([
    'Size kesin sonuç garantisi veriyoruz.',
    'Bu prosedürde %100 başarı garantilidir.',
    'We guarantee a 100% success rate.',
    'This procedure has zero risk.',
  ])('blocks: %j', (text) => {
    const result = checkOutboundCompliance(text, { language: 'en' });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('compliance:outcome_guarantee');
  });

  test('describing realistic, hedged outcomes is not blocked', () => {
    expect(checkOutboundCompliance('Most patients see good results, though outcomes vary by case.', { language: 'en' }).blocked).toBe(false);
  });
});

describe('complianceGuard — before_after_no_consent', () => {
  test.each([
    'Size öncesi-sonrası fotoğraflarını gönderiyorum.',
    'Let me send you some before-and-after photos.',
    'Önce-sonra görsellerini paylaşabilirim.',
  ])('blocks: %j', (text) => {
    const result = checkOutboundCompliance(text, { language: 'en' });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('compliance:before_after_no_consent');
  });
});

describe('complianceGuard — medical_advice_shaped', () => {
  test.each([
    'You should take 2 tablets a day after the procedure.',
    'I recommend taking ibuprofen 400mg every 6 hours.',
    'My diagnosis is that you have a mild infection.',
    'Şu ilacı kullanmanızı öneririm.',
  ])('blocks: %j', (text) => {
    const result = checkOutboundCompliance(text, { language: 'en' });
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('compliance:medical_advice_shaped');
  });

  test('describing that a doctor will advise on medication is not blocked (not the AI prescribing)', () => {
    expect(checkOutboundCompliance('Your doctor will discuss any medication with you at the consultation.', { language: 'en' }).blocked).toBe(false);
  });
});

describe('complianceGuard — logComplianceEvent (append-only audit trail)', () => {
  test('inserts a row with tenant/lead/case/rule/blockedText/language/actor', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'evt-1' }] });

    const result = await logComplianceEvent({
      tenantId: 'tenant-1', leadId: 'lead-1', caseId: 'case-1',
      rule: 'domestic_campaign_price', blockedText: '%20 indirim!', language: 'tr',
    });

    expect(result).toEqual({ id: 'evt-1' });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO compliance_events'),
      ['tenant-1', 'lead-1', 'case-1', 'domestic_campaign_price', '%20 indirim!', 'tr', 'ai'],
    );
  });

  test('missing tenantId or rule → no-op, no query issued (never crashes the reply pipeline)', async () => {
    expect(await logComplianceEvent({ rule: 'outcome_guarantee', blockedText: 'x' })).toBeNull();
    expect(await logComplianceEvent({ tenantId: 'tenant-1', blockedText: 'x' })).toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('a DB failure is swallowed — returns null, does not throw', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));
    await expect(
      logComplianceEvent({ tenantId: 'tenant-1', rule: 'testimonial_share', blockedText: 'x' }),
    ).resolves.toBeNull();
  });

  test('leadId/caseId/language default to null when omitted', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 'evt-2' }] });
    await logComplianceEvent({ tenantId: 'tenant-1', rule: 'before_after_no_consent', blockedText: 'x' });
    expect(pool.query).toHaveBeenCalledWith(
      expect.any(String),
      ['tenant-1', null, null, 'before_after_no_consent', 'x', null, 'ai'],
    );
  });
});

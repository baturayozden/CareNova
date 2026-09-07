'use strict';

// GECE-4-BRIEFI.md Bölüm F (e2e scenario 1: German patient, German reply)
// caught a real gap: detectLanguage only ever recognised en/tr/ar, and its
// German-adjacent character (ö/ü) collision with Turkish meant a German
// message containing "für"/"können" was misdetected as Turkish. Fixed by
// checking German word-level markers before the Turkish character class.
// This file locks that fix in, plus the detectConversationLanguage
// refactor that removed a duplicate inline char check with the same bug.

const { detectLanguage, detectConversationLanguage } = require('../ai');

describe('detectLanguage — existing en/tr/ar behaviour is unchanged', () => {
  test('Arabic script', () => {
    expect(detectLanguage('مرحبا، أريد معرفة السعر')).toBe('ar');
  });

  test('Turkish keyword without German markers', () => {
    expect(detectLanguage('Merhaba, diş beyazlatma fiyatı nedir?')).toBe('tr');
  });

  test('Turkish diacritic-only text', () => {
    expect(detectLanguage('Güzel bir gün')).toBe('tr');
  });

  test('plain English', () => {
    expect(detectLanguage('Hi, how much does a hair transplant cost?')).toBe('en');
  });

  test('empty/null text defaults to en', () => {
    expect(detectLanguage('')).toBe('en');
    expect(detectLanguage(null)).toBe('en');
  });
});

describe('detectLanguage — German support (Bölüm F gap fix)', () => {
  test('the exact brief scenario 1 message is detected as German, not Turkish', () => {
    expect(detectLanguage('Guten Tag, ich interessiere mich für eine Haartransplantation. Was kostet das?')).toBe('de');
  });

  test('"für" alone does not fall through to the Turkish ü/ö character class', () => {
    expect(detectLanguage('Ich suche eine Klinik für Zahnbehandlung.')).toBe('de');
  });

  test('ß is an unambiguous German-only signal', () => {
    expect(detectLanguage('Ich weiß nicht, was das kosten wird.')).toBe('de');
  });

  test('"können" (contains ö) is detected as German, not Turkish', () => {
    expect(detectLanguage('Können Sie mir helfen?')).toBe('de');
  });

  test('a German greeting alone is enough', () => {
    expect(detectLanguage('Hallo, guten Tag!')).toBe('de');
  });
});

describe('detectConversationLanguage — delegates to detectLanguage (no more duplicate/buggy inline check)', () => {
  test('a German current message is detected correctly even with prior English history', () => {
    const history = [{ direction: 'inbound', content: 'Hi, I have a question' }];
    expect(detectConversationLanguage('Können Sie mir bei der Terminvereinbarung helfen?', history)).toBe('de');
  });

  test('Arabic and Turkish detection via the conversation-level function still work', () => {
    expect(detectConversationLanguage('مرحبا')).toBe('ar');
    expect(detectConversationLanguage('Merhaba, fiyat nedir?')).toBe('tr');
  });

  test('a short ambiguous reply falls back to conversation history', () => {
    const history = [{ direction: 'inbound', content: 'Guten Tag, ich möchte einen Termin' }];
    expect(detectConversationLanguage('ok', history)).toBe('de');
  });
});

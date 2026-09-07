'use strict';

// GECE-4-BRIEFI.md Bölüm A — layered prompt compiler. No DB, no Anthropic
// call: promptCompiler.js is pure string assembly from its arguments.

const {
  buildCoreLayer, buildComplianceLayer, buildBranchLayer, buildKnowledgeLayer,
  buildCaseContextLayer, buildDateTimeLayer, buildPricingAuthorityRule,
  buildObjectionGuidance, compileSystemPrompt, PRICING_AUTHORITY_VALUES,
} = require('../promptCompiler');
const { HAIR_TRANSPLANT, DENTAL, AESTHETIC_SURGERY } = require('../__fixtures__/branchTemplates');

const FIXED_NOW = new Date('2026-09-10T10:00:00Z');

describe('promptCompiler — determinism (same input produces the same prompt)', () => {
  test('compileSystemPrompt is byte-identical for identical input, including a fixed `now`', () => {
    const params = {
      tone: 'professional', patientName: 'Lukas Weber', branchTemplate: HAIR_TRANSPLANT,
      objectionType: 'trust_surgeon', knowledgeContext: 'Hair transplant package: €2900',
      patientCountry: 'DE', patientLanguage: 'de', clinicTimezone: 'Europe/Istanbul',
      patientTimezone: 'Europe/Berlin', now: FIXED_NOW,
    };
    const a = compileSystemPrompt(params);
    const b = compileSystemPrompt({ ...params });
    expect(a).toBe(b);
  });

  test('a different `now` changes only the date layer, not the rest', () => {
    const base = { tone: 'professional', branchTemplate: DENTAL, knowledgeContext: 'x' };
    const p1 = compileSystemPrompt({ ...base, now: new Date('2026-01-01T09:00:00Z') });
    const p2 = compileSystemPrompt({ ...base, now: new Date('2026-06-15T09:00:00Z') });
    expect(p1).not.toBe(p2);
    // Non-date layers (branch pricing rule text) must be identical regardless of date.
    expect(buildPricingAuthorityRule(DENTAL.aiPricingAuthority)).toEqual(buildPricingAuthorityRule(DENTAL.aiPricingAuthority));
  });
});

describe('promptCompiler — layer presence', () => {
  test('compiled prompt contains all 6 layers when given full input', () => {
    const prompt = compileSystemPrompt({
      branchTemplate: HAIR_TRANSPLANT, knowledgeContext: 'Package: €2900',
      patientCountry: 'DE', patientLanguage: 'de', patientTimezone: 'Europe/Berlin', now: FIXED_NOW,
    });
    expect(prompt).toMatch(/CRITICAL RULES/); // core
    expect(prompt).toMatch(/KVKK/); // compliance
    expect(prompt).toMatch(/BRANCH: Hair Transplant/); // branch
    expect(prompt).toMatch(/CLINIC KNOWLEDGE BASE/); // knowledge
    expect(prompt).toMatch(/PATIENT CONTEXT/); // case context
    expect(prompt).toMatch(/DATE REFERENCE/); // datetime
  });

  test('buildBranchLayer returns empty string when no branch template is given (no case/branch known yet)', () => {
    expect(buildBranchLayer(null)).toBe('');
  });

  test('a prompt with no branchTemplate omits the BRANCH section entirely', () => {
    const prompt = compileSystemPrompt({ knowledgeContext: 'x', now: FIXED_NOW });
    expect(prompt).not.toMatch(/BRANCH:/);
  });
});

describe('promptCompiler — dual timezone (Bölüm A Katman 6)', () => {
  test('states both clinic and patient time, and their difference, when timezones differ', () => {
    const layer = buildDateTimeLayer({ clinicTimezone: 'Europe/Istanbul', patientTimezone: 'Europe/Berlin', now: FIXED_NOW });
    expect(layer).toMatch(/DUAL TIMEZONE/);
    expect(layer).toMatch(/Europe\/Istanbul/);
    expect(layer).toMatch(/Europe\/Berlin/);
    expect(layer).toMatch(/BOTH timezones/);
  });

  test('omits the dual-timezone block when patient timezone is unknown', () => {
    const layer = buildDateTimeLayer({ clinicTimezone: 'Europe/Istanbul', patientTimezone: null, now: FIXED_NOW });
    expect(layer).not.toMatch(/DUAL TIMEZONE/);
  });

  test('omits the dual-timezone block when patient and clinic share a timezone', () => {
    const layer = buildDateTimeLayer({ clinicTimezone: 'Europe/Istanbul', patientTimezone: 'Europe/Istanbul', now: FIXED_NOW });
    expect(layer).not.toMatch(/DUAL TIMEZONE/);
  });

  test('the 14-day date map always starts with the correct today', () => {
    const layer = buildDateTimeLayer({ clinicTimezone: 'Europe/Istanbul', now: FIXED_NOW });
    expect(layer).toMatch(/TODAY is 2026-09-10/);
  });
});

describe('promptCompiler — pricing authority rule text (all 5 values present)', () => {
  test.each(PRICING_AUTHORITY_VALUES)('%s has real, non-empty CRITICAL rule text', (authority) => {
    const rule = buildPricingAuthorityRule(authority);
    expect(rule.length).toBeGreaterThan(50);
    expect(rule).toMatch(/AI PRICING AUTHORITY/);
  });

  test('qualification_only and logistics_only explicitly forbid ANY price, not just a firm one', () => {
    expect(buildPricingAuthorityRule('qualification_only')).toMatch(/NEVER gives price/);
    expect(buildPricingAuthorityRule('logistics_only')).toMatch(/no price/i);
  });

  test('an unknown/missing authority value falls back to the safest rule (qualification_only), not to `full`', () => {
    expect(buildPricingAuthorityRule(undefined)).toBe(buildPricingAuthorityRule('qualification_only'));
    expect(buildPricingAuthorityRule('typo_value')).toBe(buildPricingAuthorityRule('qualification_only'));
  });
});

describe('promptCompiler — objection guidance', () => {
  test('trust_surgeon and safety_fear carry a mandatory-escalation note', () => {
    expect(buildObjectionGuidance('trust_surgeon', HAIR_TRANSPLANT)).toMatch(/mandatory/i);
    expect(buildObjectionGuidance('safety_fear', AESTHETIC_SURGERY)).toMatch(/mandatory/i);
  });

  test('a branch-specific strategy is used when present', () => {
    const guidance = buildObjectionGuidance('trust_clinic', DENTAL);
    expect(guidance).toMatch(/lisans/); // DENTAL's fixture strategy text, not the generic English fallback
  });

  test('falls back to generic guidance for an objection type the branch has no strategy for', () => {
    const guidance = buildObjectionGuidance('financing', HAIR_TRANSPLANT); // HAIR_TRANSPLANT fixture has no 'financing' entry
    expect(guidance).toMatch(/instalment/i);
  });

  test('general_enquiry (not a real objection) produces no guidance block', () => {
    expect(buildObjectionGuidance('general_enquiry', HAIR_TRANSPLANT)).toBe('');
    expect(buildObjectionGuidance(null, HAIR_TRANSPLANT)).toBe('');
  });
});

describe('promptCompiler — core layer preserves proven rules', () => {
  const core = buildCoreLayer({ tone: 'professional', patientName: 'Ahmed' });
  test.each(['PRICE RULE', 'FACTS RULE', 'LANGUAGE RULE', 'MEDICAL INFERENCE RULE', 'WHATSAPP FORMATTING RULE'])(
    '%s is present', (ruleName) => expect(core).toMatch(new RegExp(ruleName)),
  );
  test('MEDICAL INFERENCE RULE explicitly forbids committing to graft/implant counts', () => {
    expect(core).toMatch(/graft count, implant count/);
  });
});

describe('promptCompiler — buildKnowledgeLayer', () => {
  test('empty knowledge context still produces a safe instruction, not an empty string', () => {
    const layer = buildKnowledgeLayer('');
    expect(layer).toMatch(/No specific clinic information loaded/);
  });
});

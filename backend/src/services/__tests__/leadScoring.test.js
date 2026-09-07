'use strict';

// GECE-4-BRIEFI.md Bölüm D.2 — leadScoring.js's new Eligibility dimension.
// buildEligibilityContext is the only genuinely testable piece without a
// real Claude call (the rest of scoreLead is an LLM prompt-fill, same as
// before tonight); every branch here is exercised with a mocked pool and
// mocked ai.js loaders, no DB, no network, no Anthropic call.

jest.mock('../../db/index', () => ({ pool: { query: jest.fn() } }));
jest.mock('../ai', () => ({
  loadCaseForLead: jest.fn(),
  loadBranchTemplate: jest.fn(),
}));

const { pool } = require('../../db/index');
const ai = require('../ai');
const { buildEligibilityContext } = require('../leadScoring');

afterEach(() => jest.clearAllMocks());

describe('buildEligibilityContext — no case yet (the common case)', () => {
  test('most leads never qualify to a case — returns an honest "unknown" line, never throws', async () => {
    ai.loadCaseForLead.mockResolvedValue(null);
    const result = await buildEligibilityContext('lead-1', 'tenant-1');
    expect(result).toMatch(/none yet/i);
    expect(result).toMatch(/unknown/i);
    expect(ai.loadBranchTemplate).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('buildEligibilityContext — case exists, branch has required media', () => {
  test('reports medical_eligibility and a X/Y required-documents count', async () => {
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'hair_transplant', medical_eligibility: 'eligible' });
    ai.loadBranchTemplate.mockResolvedValue({
      key: 'hair_transplant',
      requiredMedia: [{ id: 'on_gorunum' }, { id: 'tepe' }, { id: 'donor_ense' }],
    });
    pool.query.mockResolvedValue({ rows: [{ template_slot_id: 'on_gorunum' }, { template_slot_id: 'tepe' }] });

    const result = await buildEligibilityContext('lead-1', 'tenant-1');

    expect(result).toContain('"eligible"');
    expect(result).toContain('2/3 required documents');
  });

  test('missing medical_eligibility defaults to "pending" in the text', async () => {
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'dental', medical_eligibility: null });
    ai.loadBranchTemplate.mockResolvedValue({ key: 'dental', requiredMedia: [{ id: 'panoramik' }] });
    pool.query.mockResolvedValue({ rows: [] });

    const result = await buildEligibilityContext('lead-1', 'tenant-1');

    expect(result).toContain('"pending"');
    expect(result).toContain('0/1 required documents');
  });

  test('a quality_ok slot for a DIFFERENT branch template is not counted (stale/mismatched slot ids)', async () => {
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'dental', medical_eligibility: 'pending' });
    ai.loadBranchTemplate.mockResolvedValue({ key: 'dental', requiredMedia: [{ id: 'panoramik' }] });
    pool.query.mockResolvedValue({ rows: [{ template_slot_id: 'on_gorunum' }] }); // hair_transplant slot, irrelevant here

    const result = await buildEligibilityContext('lead-1', 'tenant-1');
    expect(result).toContain('0/1 required documents');
  });
});

describe('buildEligibilityContext — case exists, branch has no required media (e.g. IVF)', () => {
  test('does not query case_media at all, reports "no required documents"', async () => {
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-2', branch_key: 'ivf', medical_eligibility: 'conditional' });
    ai.loadBranchTemplate.mockResolvedValue({ key: 'ivf', requiredMedia: [] });

    const result = await buildEligibilityContext('lead-1', 'tenant-1');

    expect(pool.query).not.toHaveBeenCalled();
    expect(result).toContain('no required documents for this branch');
    expect(result).toContain('"conditional"');
  });
});

describe('buildEligibilityContext — resilience', () => {
  test('a DB error on the case_media count query degrades to 0/N rather than throwing', async () => {
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'dental', medical_eligibility: 'eligible' });
    ai.loadBranchTemplate.mockResolvedValue({ key: 'dental', requiredMedia: [{ id: 'panoramik' }] });
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(buildEligibilityContext('lead-1', 'tenant-1')).resolves.toContain('0/1 required documents');
  });

  test('loadBranchTemplate failure degrades gracefully (no crash, no required-media count)', async () => {
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'dental', medical_eligibility: 'eligible' });
    ai.loadBranchTemplate.mockRejectedValue(new Error('boom'));

    const result = await buildEligibilityContext('lead-1', 'tenant-1');
    expect(result).toContain('no required documents for this branch');
  });
});

'use strict';

// Tenant-isolation tests for caseFileStore.js. No reachable Postgres tonight
// (BLOKAJLAR.md B2) so pool.query is mocked — but the mock for the
// "cross-tenant" tests is a tiny in-memory table that actually filters rows
// by tenant_id the way Postgres would, rather than just asserting on the
// SQL string. That's the difference between "we remembered to type
// tenant_id somewhere in the query" and "a tenant literally cannot read
// another tenant's row through this function".

jest.mock('../../db/index', () => ({ pool: { query: jest.fn() } }));
const { pool } = require('../../db/index');
const store = require('../caseFileStore');

const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';

function makeFakeCasesTable(rows) {
  // Emulates exactly the two query shapes caseFileStore.js issues against
  // `cases`: SELECT ... WHERE id = $1 AND tenant_id = $2, and
  // UPDATE ... WHERE id = $2 AND tenant_id = $3 RETURNING *.
  return jest.fn((sql, params) => {
    if (/^SELECT \* FROM cases WHERE id/.test(sql)) {
      const [id, tenantId] = params;
      const row = rows.find(r => r.id === id && r.tenant_id === tenantId);
      return Promise.resolve({ rows: row ? [row] : [] });
    }
    if (/^UPDATE cases SET status/.test(sql)) {
      const [status, id, tenantId] = params;
      const row = rows.find(r => r.id === id && r.tenant_id === tenantId);
      if (!row) return Promise.resolve({ rows: [] });
      row.status = status;
      return Promise.resolve({ rows: [row] });
    }
    if (/^INSERT INTO case_events/.test(sql)) {
      return Promise.resolve({ rows: [{ id: 'event-1' }] });
    }
    throw new Error(`Unhandled SQL in fake table: ${sql}`);
  });
}

describe('caseFileStore — tenant isolation', () => {
  afterEach(() => jest.clearAllMocks());

  test.each([
    ['createCase', () => store.createCase(undefined, {})],
    ['getCaseById', () => store.getCaseById(undefined, 'x')],
    ['listCases', () => store.listCases(undefined)],
    ['updateCaseStatus', () => store.updateCaseStatus(undefined, 'x', 'new', 'user-1')],
    ['addMedia', () => store.addMedia(undefined, 'x', {})],
    ['upsertAssessment', () => store.upsertAssessment(undefined, 'x', 'k', {})],
    ['addTimelineEntry', () => store.addTimelineEntry(undefined, 'x', {})],
    ['appendCaseEvent', () => store.appendCaseEvent(undefined, 'x', 'y', 'z')],
    ['listCaseEvents', () => store.listCaseEvents(undefined, 'x')],
  ])('%s rejects a missing tenantId rather than defaulting to "see everything"', async (_name, call) => {
    await expect(call()).rejects.toThrow('tenantId is required');
  });

  test('getCaseById: tenant A cannot fetch tenant B\'s case by id, even knowing its id', async () => {
    pool.query.mockImplementation(makeFakeCasesTable([
      { id: 'case-1', tenant_id: TENANT_A, status: 'new' },
      { id: 'case-2', tenant_id: TENANT_B, status: 'quoted' },
    ]));

    const ownCase = await store.getCaseById(TENANT_A, 'case-1');
    expect(ownCase).toBeDefined();
    expect(ownCase.status).toBe('new');

    const crossTenantAttempt = await store.getCaseById(TENANT_A, 'case-2');
    expect(crossTenantAttempt).toBeUndefined();
  });

  test('getCaseById always includes tenant_id in the WHERE clause, not just the id', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await store.getCaseById(TENANT_A, 'case-1');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/tenant_id = \$2/);
    expect(params).toEqual(['case-1', TENANT_A]);
  });

  test('listCases always binds tenant_id as the first parameter, with or without optional filters', async () => {
    pool.query.mockResolvedValue({ rows: [] });
    await store.listCases(TENANT_A, {});
    await store.listCases(TENANT_A, { status: 'quoted', branchKey: 'dental' });

    for (const [sql, params] of pool.query.mock.calls) {
      expect(sql).toMatch(/tenant_id = \$1/);
      expect(params[0]).toBe(TENANT_A);
    }
  });

  test('updateCaseStatus: tenant A cannot flip the status of tenant B\'s case, and no audit event is written for the attempt', async () => {
    pool.query.mockImplementation(makeFakeCasesTable([
      { id: 'case-2', tenant_id: TENANT_B, status: 'quoted' },
    ]));

    const result = await store.updateCaseStatus(TENANT_A, 'case-2', 'completed', 'user-from-tenant-a');
    expect(result).toBeUndefined();

    // The only calls made should be the failed UPDATE — appendCaseEvent's
    // own INSERT INTO case_events must never have fired for a no-op update.
    const eventInserts = pool.query.mock.calls.filter(([sql]) => /INSERT INTO case_events/.test(sql));
    expect(eventInserts).toHaveLength(0);
  });
});

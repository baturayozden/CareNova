'use strict';

// canEditTemplate is the actual security boundary for PATCH /:key (Bölüm
// E, mirrors the Bölüm C.6 admin-console rule: a system template is
// super_admin-only; a clinic may only touch its own non-system template).
// Pure function, no DB needed to test it.

jest.mock('../../db/index', () => ({ pool: { query: jest.fn() } }));
const { _internal: { canEditTemplate } } = require('../branchTemplates');

describe('branchTemplates — canEditTemplate', () => {
  const systemTemplate = { key: 'ivf', is_system: true, tenant_id: null };
  const tenantATemplate = { key: 'custom-1', is_system: false, tenant_id: 'tenant-a' };

  test('super_admin may edit a system template', () => {
    expect(canEditTemplate({ role: 'super_admin', tenantId: null }, systemTemplate)).toBe(true);
  });

  test('a clinic role may NOT edit a system template, even its own branch\'s', () => {
    expect(canEditTemplate({ role: 'klinik_sahibi', tenantId: 'tenant-a' }, systemTemplate)).toBe(false);
    expect(canEditTemplate({ role: 'operasyon_muduru', tenantId: 'tenant-a' }, systemTemplate)).toBe(false);
  });

  test('a clinic may edit its OWN custom (non-system) template', () => {
    expect(canEditTemplate({ role: 'klinik_sahibi', tenantId: 'tenant-a' }, tenantATemplate)).toBe(true);
  });

  test('a clinic may NOT edit another tenant\'s custom template', () => {
    expect(canEditTemplate({ role: 'klinik_sahibi', tenantId: 'tenant-b' }, tenantATemplate)).toBe(false);
  });

  test('platform admin may edit any tenant\'s custom template too', () => {
    expect(canEditTemplate({ role: 'admin', tenantId: null }, tenantATemplate)).toBe(true);
  });
});

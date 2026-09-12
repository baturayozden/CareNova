import type { AxiosResponse } from 'axios';
import { markDemoResponse } from './apiDemoMarking';
import { demoSourceCount, enableDemoTracking, isDemoName, resetDemoProvenance } from './demoProvenance';

const response = (data: unknown, headers: Record<string, string> = {}) => ({ data, headers } as unknown as AxiosResponse);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

beforeAll(() => enableDemoTracking());
beforeEach(() => resetDemoProvenance());

test('a row flagged isDemo marks the page that asked and registers its names', async () => {
  markDemoResponse(response({ clinics: [{ id: '1', isDemo: true, name: 'Probe Demo Klinik', legalName: 'Probe Demo A.Ş.' }] }), '/admin/probe-a');
  await flush();
  expect(demoSourceCount('/admin/probe-a')).toBe(1);
  expect(isDemoName('Probe Demo Klinik')).toBe(true);
  expect(isDemoName('Probe Demo A.Ş.')).toBe(true);
});

test('snake_case is_demo counts too (demo_requests rows)', async () => {
  markDemoResponse(response({ requests: [{ id: '1', is_demo: true, name: 'Probe Talep Kişisi', clinic_name: 'Probe Talep Kliniği' }] }), '/admin/probe-b');
  await flush();
  expect(demoSourceCount('/admin/probe-b')).toBe(1);
  expect(isDemoName('Probe Talep Kliniği')).toBe(true);
});

test('real rows only: nothing is marked', async () => {
  markDemoResponse(response({ clinics: [{ id: '1', isDemo: false, name: 'Probe Gerçek Klinik' }] }), '/admin/probe-c');
  await flush();
  expect(demoSourceCount('/admin/probe-c')).toBe(0);
  expect(isDemoName('Probe Gerçek Klinik')).toBe(false);
});

test('X-Tenant-Demo marks tenant-bound responses with no flag in the body; list rows register, the top-level object does not', async () => {
  markDemoResponse(
    response({ user: { firstName: 'Probe', lastName: 'Oturum' }, cases: [{ id: 'c1', patientName: 'Probe Hasta Adı' }] }, { 'x-tenant-demo': 'true' }),
    '/cases',
  );
  await flush();
  expect(demoSourceCount('/cases')).toBe(1);
  expect(isDemoName('Probe Hasta Adı')).toBe(true);
  expect(isDemoName('Probe Oturum')).toBe(false);
});

test('X-Tenant-Demo: false marks nothing', async () => {
  markDemoResponse(response({ cases: [{ id: 'c1', patientName: 'Probe Gerçek Hasta' }] }, { 'x-tenant-demo': 'false' }), '/cases-real');
  await flush();
  expect(demoSourceCount('/cases-real')).toBe(0);
});

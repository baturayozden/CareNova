// Demo marking for data that arrives from the API (ASAMA-3A Görev 0).
//
// demoProvenance.ts marks a screen when it reads an IMPORTED fabricated
// collection. Once the same records come from the database, nothing is
// imported — the flag has to travel with the data. It does, two ways:
//
//  • `X-Tenant-Demo: true` (middleware/tenantDemoHeader.js): every response to
//    a user of a demo tenant. Covers tenant-bound rows — cases, leads, users,
//    invoices — without changing any response body.
//  • `isDemo: true` / `is_demo: true` on a row: cross-tenant responses (the
//    admin console), where one list mixes demo and real clinics.
//
// This runs in the Axios response interceptor (lib/api.ts), so a new screen
// that fetches demo rows is marked without a line of marking code — the same
// guarantee the import-based tracking gives.
import type { AxiosResponse } from 'axios';
import { registerDemoNames, reportDemoData } from './demoProvenance';

const MAX_DEPTH = 6;
const MAX_NODES = 20000;

// Fields that hold a fabricated person's or clinic's name.
const NAME_FIELDS = ['name', 'legalName', 'clinicName', 'clinic_name', 'patientName', 'patient_name', 'full_name'];
const NAME_PAIRS: Array<[string, string]> = [['firstName', 'lastName'], ['first_name', 'last_name']];

type Row = Record<string, unknown>;

function namesOf(row: Row): string[] {
  const out: string[] = [];
  NAME_FIELDS.forEach(key => { if (typeof row[key] === 'string') out.push(row[key] as string); });
  NAME_PAIRS.forEach(([first, last]) => {
    if (typeof row[first] === 'string') out.push(`${row[first]} ${typeof row[last] === 'string' ? row[last] : ''}`.trim());
  });
  return out;
}

/**
 * Walks a response body. Returns whether any row is flagged demo, and the
 * names to register: those of flagged rows, plus — when the whole response
 * belongs to a demo tenant — those of list rows (not top-level objects, which
 * can be the signed-in user's own profile).
 */
function scan(body: unknown, wholeResponseIsDemo: boolean): { flagged: boolean; names: string[] } {
  let flagged = false;
  let nodes = 0;
  const names: string[] = [];

  const visit = (value: unknown, depth: number, inList: boolean) => {
    if (value === null || typeof value !== 'object' || depth > MAX_DEPTH || ++nodes > MAX_NODES) return;
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, depth + 1, true));
      return;
    }
    const row = value as Row;
    const rowIsDemo = row.isDemo === true || row.is_demo === true;
    if (rowIsDemo) flagged = true;
    if (rowIsDemo || (wholeResponseIsDemo && inList)) names.push(...namesOf(row));
    Object.values(row).forEach(child => visit(child, depth + 1, false));
  };

  visit(body, 0, false);
  return { flagged, names };
}

export function markDemoResponse(response: AxiosResponse, requestPath: string): void {
  const header = String(response.headers?.['x-tenant-demo'] ?? '').toLowerCase() === 'true';
  const { flagged, names } = scan(response.data, header);
  if (!header && !flagged) return;
  registerDemoNames(names);
  reportDemoData(header ? 'api:X-Tenant-Demo' : 'api:isDemo', requestPath);
}

// Commission demo data (APP-ADMIN-EKSIKLER-KOMUTU.md Görev 1) — derived
// from the SAME `cases`/`caseConsultants` that /cases and /doctor-queue
// already use, not a parallel invented dataset. CareDental's commission
// model was built around dental-procedure sales reps; CareNova's central
// unit is the case, closed by a hasta danışmanı (patient consultant) — so
// every "deal" here is one of caseData.ts's 18 cases that already has a
// locked quote (a case with no quote yet isn't a deal), attributed to its
// real `assignedConsultant`. No invented names — Ayşe Demir, Jonas
// Fischer, Layla Hassan, Olga Petrova are the same 4 people /cases shows
// in its own DANIŞMAN column.
import { cases, caseConsultants, CaseStatus } from './caseData';
import { DEMO_TENANT_NAME } from './demoData';

function dealStatusFor(status: CaseStatus): string {
  switch (status) {
    case 'quoted':
    case 'awaiting_deposit':
    case 'reserved':
    case 'travel_planned':
      return 'accepted';
    case 'arrived':
    case 'treated':
      return 'in_progress';
    case 'returned':
    case 'in_aftercare':
    case 'completed':
      return 'completed';
    case 'lost':
    case 'medically_ineligible':
      return 'cancelled';
    default:
      return 'accepted';
  }
}

const consultantByName = new Map(caseConsultants.map(c => [c.name, c]));

// Only cases with a locked quote represent an actual agreed deal — a case
// still in qualification/pre-assessment (no quotes[]) has no revenue to
// attribute yet, same rule CaseFileDetailPage's own Quote tab already uses.
export const demoCommissionDeals = cases
  .filter(c => c.quotes.length > 0 && c.assignedConsultant)
  .map(c => {
    const consultant = consultantByName.get(c.assignedConsultant as string)!;
    const [firstName, ...rest] = consultant.name.split(' ');
    const quote = c.quotes[c.quotes.length - 1];
    return {
      id: `deal-${c.id}`,
      assigned_staff_id: consultant.id,
      staff_first_name: firstName,
      staff_last_name: rest.join(' '),
      staff_role: 'hasta_danismani',
      agreed_amount: String(quote.amountEur),
      deposit_amount: null as string | null,
      status: dealStatusFor(c.status),
      treatment_category: c.branch,
      treatment_name: quote.items[0] ?? null,
      deal_date: c.lastActivityAt,
      billing_entity_key: 'carenova',
      billing_entity_name: DEMO_TENANT_NAME,
      lead_id: c.id,
      patient_name: c.patientName,
      verification_status: 'verified',
    };
  });

function computeRecords() {
  const byStaff = new Map<string, { staffId: string; total: number; count: number }>();
  for (const d of demoCommissionDeals) {
    if (d.status === 'cancelled') continue;
    if (!byStaff.has(d.assigned_staff_id)) {
      byStaff.set(d.assigned_staff_id, { staffId: d.assigned_staff_id, total: 0, count: 0 });
    }
    const entry = byStaff.get(d.assigned_staff_id)!;
    entry.total += Number(d.agreed_amount);
    entry.count += 1;
  }
  // Simple, transparent formula for the demo: 8% base commission on
  // personal revenue, +2% performance bonus once personal revenue passes
  // €5,000 for the period — matches the Multiplier Gates concept already
  // shown in the hero (no team bonus modeled, no scheme configured yet).
  return Array.from(byStaff.values())
    .map(s => {
      const base = Math.round(s.total * 0.08);
      const performance = s.total >= 5000 ? Math.round(s.total * 0.02) : 0;
      const consultant = caseConsultants.find(c => c.id === s.staffId)!;
      const [firstName, ...rest] = consultant.name.split(' ');
      return {
        id: `rec-${s.staffId}`,
        staff_id: s.staffId,
        first_name: firstName,
        last_name: rest.join(' '),
        email: `${firstName.toLowerCase()}@carenova.ai`,
        total_revenue: String(s.total),
        target_revenue: null as string | null,
        target_attainment: null as string | null,
        base_commission: String(base),
        performance_bonus: String(performance),
        team_bonus: '0',
        adjustment_amount: '0',
        total_commission: String(base + performance),
        status: 'draft',
        notes: `${s.count} vaka üzerinden hesaplandı: taban komisyon %8, performans bonusu (kişisel ciro ≥ €5.000 olduğunda) %2.`,
      };
    })
    .sort((a, b) => Number(b.total_commission) - Number(a.total_commission));
}

export const demoCommissionRecords = computeRecords();

const quotaTotal = demoCommissionDeals
  .filter(d => d.status !== 'cancelled')
  .reduce((s, d) => s + Number(d.agreed_amount), 0);

export const demoCommissionPeriod = {
  id: 'period-2026-09',
  period_label: 'Eylül 2026',
  period_start: '2026-09-01',
  period_end: '2026-09-30',
  target_amount: '30000.00',
  clinic_revenue: null as string | null,
  quota_revenue: String(quotaTotal),
  total_revenue: String(quotaTotal),
  effective_quota_revenue: String(quotaTotal),
  status: 'open',
  total_commission_paid: null as string | null,
  created_at: '2026-09-01T00:00:00.000Z',
  locked_by_first: null as string | null,
  locked_by_last: null as string | null,
};

// Reused by both Commission's Deals tab AND /patients' "Assigned to" filter
// (both call GET /api/clinics/:id/sales-users) — a single, real staff list
// instead of each screen deriving its own ad-hoc one.
export const demoSalesStaff = caseConsultants.map(c => {
  const [firstName, ...rest] = c.name.split(' ');
  return { id: c.id, firstName, lastName: rest.join(' '), email: `${firstName.toLowerCase()}@carenova.ai` };
});

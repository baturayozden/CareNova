// APP-ADMIN-EKSIKLER-KOMUTU.md Görev 2/6.3 — shared case-display helpers so
// the new list pages (quotes/travel/aftercare/reports) and the newly-
// unified /patients use the exact same status tone/branch label/relative-
// time formatting CasesPage.tsx already established, instead of each
// screen inventing its own slightly different copy. Values here are kept
// identical to CasesPage.tsx's own local STATUS_TONE/BRANCH_LABELS/timeAgo
// — not imported from there, to avoid touching an already-working,
// out-of-scope file for this brief.
import { cases, CaseFile, CaseStatus, DEMO_NOW_MS } from '../data/caseData';

export const STATUS_TONE: Record<CaseStatus, 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> = {
  new: 'neutral', qualified: 'accent', pre_assessment: 'warning', awaiting_doctor: 'warning',
  quoted: 'accent', awaiting_deposit: 'accent', reserved: 'success', travel_planned: 'success',
  arrived: 'success', treated: 'success', returned: 'success', in_aftercare: 'success',
  completed: 'success', lost: 'danger', medically_ineligible: 'danger',
};

export const BRANCH_LABELS: Record<string, string> = {
  hair_transplant: 'Saç Ekimi', dental: 'Diş', aesthetic_surgery: 'Estetik Cerrahi',
  eye_lasik: 'Göz (Lasik)', bariatric: 'Bariatrik', ivf: 'Tüp Bebek', orthopedics: 'Ortopedi',
  cardiology: 'Kardiyoloji', oncology: 'Onkoloji', checkup: 'Check-up',
};

export function timeAgo(iso: string): string {
  const mins = Math.round((DEMO_NOW_MS - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.round(hours / 24)} gün önce`;
}

// APP-ADMIN-EKSIKLER-KOMUTU.md Görev 2 (Raporlar) — moved out of
// Dashboard.tsx (where it was a local, unexported function) so /reports
// can show the exact same "Ortalama İlk Yanıt Süresi" figure instead of
// recomputing it a second, possibly-different way. Dashboard.tsx now
// imports it from here instead of defining its own copy.
export function averageFirstResponseMinutes(caseList: CaseFile[] = cases): number | null {
  const deltas: number[] = [];
  for (const c of caseList) {
    for (let i = 0; i < c.messages.length - 1; i++) {
      if (c.messages[i].side === 'in' && c.messages[i + 1].side === 'out') {
        const mins = (new Date(c.messages[i + 1].at).getTime() - new Date(c.messages[i].at).getTime()) / 60000;
        if (mins >= 0) deltas.push(mins);
      }
    }
  }
  if (deltas.length === 0) return null;
  return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
}

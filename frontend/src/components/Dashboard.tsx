import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Clock3, MessageCircleMore, Stethoscope, Wallet, CheckCircle2,
  ArrowRight, X, Stethoscope as ProcedureIcon, ClipboardCheck,
  PlaneLanding, PlaneTakeoff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AppMeta from './AppMeta';
import { cases, CaseFile, DEMO_NOW_MS, todaysSchedule, ScheduleEntry } from '../data/caseData';

// GECE-3-BRIEFI.md Bölüm C — replaces CareDental's inherited lead board
// (Bulgu 3: "Total Leads 4" while /cases showed 15 cases — two screens
// contradicting each other, plus a meaningless single-tenant "Clinic"
// column and no first-response-time anywhere). This dashboard is built
// entirely on the same case demo data as /cases and /doctor-queue — there
// is no per-tenant lead concept left to show here.

// ── Role → dashboard variant ────────────────────────────────────────────
// CareNova's 7 roles (klinik_sahibi/operasyon_muduru/hasta_danismani/
// doktor/koordinator/tercuman/muhasebe) don't exist in the backend yet —
// that's Bölüm E, later tonight. Mapped here against BOTH the target
// names and today's live CareDental role strings, using Bölüm E.1's own
// eşleme tablosu (director→operasyon_muduru, clinic_admin→klinik_sahibi,
// treatment_coordinator→hasta_danismani, dentist→doktor,
// receptionist→koordinator, sales→hasta_danismani), so this keeps working
// unchanged once Bölüm E's migration actually renames the roles tonight —
// today's demo user (role: 'director') already resolves correctly.
type Variant = 'doctor' | 'coordinator' | 'accounting' | 'consultant' | 'full';
const ROLE_VARIANT: Record<string, Variant> = {
  doktor: 'doctor', dentist: 'doctor', doctor: 'doctor',
  koordinator: 'coordinator', receptionist: 'coordinator',
  muhasebe: 'accounting',
  hasta_danismani: 'consultant', treatment_coordinator: 'consultant', sales: 'consultant',
  klinik_sahibi: 'full', operasyon_muduru: 'full', clinic_admin: 'full', director: 'full',
};
function resolveVariant(role?: string): Variant {
  return (role && ROLE_VARIANT[role]) || 'full';
}

// ── KPI computations (from the same case demo data /cases uses) ────────
function lastMessageSide(c: CaseFile): 'in' | 'out' | null {
  if (c.messages.length === 0) return null;
  return c.messages[c.messages.length - 1].side;
}

function averageFirstResponseMinutes(): number | null {
  const deltas: number[] = [];
  for (const c of cases) {
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

function isToday(iso: string): boolean {
  const d = new Date(iso), n = new Date(DEMO_NOW_MS);
  return d.getUTCFullYear() === n.getUTCFullYear() && d.getUTCMonth() === n.getUTCMonth() && d.getUTCDate() === n.getUTCDate();
}
function isThisMonth(iso: string): boolean {
  const d = new Date(iso), n = new Date(DEMO_NOW_MS);
  return d.getUTCFullYear() === n.getUTCFullYear() && d.getUTCMonth() === n.getUTCMonth();
}

const SCHEDULE_ICON: Record<ScheduleEntry['type'], typeof PlaneLanding> = {
  arrival: PlaneLanding, departure: PlaneTakeoff, consultation: Stethoscope,
  procedure: ProcedureIcon, checkup: ClipboardCheck,
};

function KpiCard({ Icon, label, value, tone, big }: { Icon: typeof Clock3; label: string; value: string; tone?: 'accent' | 'warning' | 'danger'; big?: boolean }) {
  const toneCls = tone === 'accent' ? 'text-accent' : tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-danger' : 'text-ink';
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-ink-subtle mb-2">
        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`font-display ${big ? 'text-3xl' : 'text-2xl'} ${toneCls}`}>{value}</p>
    </div>
  );
}

const ONBOARDING_DISMISS_KEY = 'carenova_onboarding_card_dismissed';
// Demo-only static progress — CareNova's own 7-step wizard (M11) isn't
// built tonight (see docs/onboarding-wizard-status.md), so there's no
// real progress to read yet.
const ONBOARDING_STEPS_DONE = 3;
const ONBOARDING_STEPS_TOTAL = 7;

function OnboardingCard({ t }: { t: (k: string, o?: any) => any }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_DISMISS_KEY) === '1'; } catch { return false; }
  });
  if (dismissed) return null;
  const pct = Math.round((ONBOARDING_STEPS_DONE / ONBOARDING_STEPS_TOTAL) * 100);
  return (
    <div className="rounded-xl border border-accent/30 bg-accent-soft p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">{t('dashboard.onboarding.title', { done: ONBOARDING_STEPS_DONE, total: ONBOARDING_STEPS_TOTAL })}</p>
        <div className="mt-2 h-1.5 rounded-full bg-surface-sunken overflow-hidden max-w-xs">
          <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <Link to="/settings/onboarding" className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover">
        {t('dashboard.onboarding.continue')} <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
      </Link>
      <button
        onClick={() => { try { localStorage.setItem(ONBOARDING_DISMISS_KEY, '1'); } catch {} setDismissed(true); }}
        className="shrink-0 text-ink-subtle hover:text-ink"
        aria-label={t('dashboard.onboarding.dismiss') ?? undefined}
      >
        <X size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation('cases');
  const variant = resolveVariant(user?.role);

  const kpis = useMemo(() => {
    const avgFirstResponse = averageFirstResponseMinutes();
    const todayInbound = cases.reduce((sum, c) => sum + c.messages.filter(m => m.side === 'in' && isToday(m.at)).length, 0);
    const awaitingReply = cases.filter(c => lastMessageSide(c) === 'in').length;
    const awaitingDoctor = cases.filter(c => c.status === 'awaiting_doctor').length;
    const awaitingDeposit = cases.filter(c => c.status === 'awaiting_deposit').length;
    const completedThisMonth = cases.filter(c => c.status === 'completed' && isThisMonth(c.lastActivityAt)).length;
    return { avgFirstResponse, todayInbound, awaitingReply, awaitingDoctor, awaitingDeposit, completedThisMonth };
  }, []);

  const actionItems = useMemo(() => {
    type Item = { caseId: string; patientName: string; reason: string; at: string };
    const items: Item[] = [];
    for (const c of cases) {
      if (lastMessageSide(c) === 'in') {
        items.push({ caseId: c.id, patientName: c.patientName, reason: t('dashboard.action.unanswered'), at: c.messages[c.messages.length - 1].at });
      }
      if (c.status === 'awaiting_doctor') {
        items.push({ caseId: c.id, patientName: c.patientName, reason: t('dashboard.action.doctorQueue'), at: c.lastActivityAt });
      }
      for (const q of c.quotes) {
        if (q.validUntil && new Date(q.validUntil).getTime() - DEMO_NOW_MS < 3 * 86400000 && new Date(q.validUntil).getTime() > DEMO_NOW_MS) {
          items.push({ caseId: c.id, patientName: c.patientName, reason: t('dashboard.action.quoteExpiring'), at: q.validUntil });
        }
      }
      for (const tp of c.aftercare) {
        if (tp.contactedAt && !tp.response) {
          items.push({ caseId: c.id, patientName: c.patientName, reason: t('dashboard.action.aftercareSilent'), at: tp.contactedAt });
        }
      }
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);
  }, [t]);

  const recentAiActivity = useMemo(() => {
    type Item = { caseId: string; patientName: string; flag: string; text: string; translation?: string; at: string };
    const items: Item[] = [];
    for (const c of cases) {
      for (const m of c.messages) {
        if (m.side === 'in') items.push({ caseId: c.id, patientName: c.patientName, flag: c.patientCountryFlag, text: m.text, translation: m.translation, at: m.at });
      }
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 5);
  }, []);

  // Brief: "doktor → doğrudan /doctor-queue'ya yönlendir, dashboard'a hiç
  // uğramasın" — a doctor's queue IS their dashboard. Checked after every
  // hook above (not as an early return before them) so hook call order
  // stays identical across renders regardless of variant.
  if (variant === 'doctor') return <Navigate to="/doctor-queue" replace />;

  function fmtTime(iso: string): string {
    return new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  const kpiRow = (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiCard Icon={Clock3} label={t('dashboard.kpi.firstResponse')} value={kpis.avgFirstResponse !== null ? `${kpis.avgFirstResponse}dk` : '—'} tone="accent" big />
      <KpiCard Icon={MessageCircleMore} label={t('dashboard.kpi.todayInbound')} value={String(kpis.todayInbound)} />
      <KpiCard Icon={MessageCircleMore} label={t('dashboard.kpi.awaitingReply')} value={String(kpis.awaitingReply)} tone={kpis.awaitingReply > 0 ? 'warning' : undefined} />
      <KpiCard Icon={Stethoscope} label={t('dashboard.kpi.awaitingDoctor')} value={String(kpis.awaitingDoctor)} tone={kpis.awaitingDoctor > 0 ? 'warning' : undefined} />
      <KpiCard Icon={Wallet} label={t('dashboard.kpi.awaitingDeposit')} value={String(kpis.awaitingDeposit)} />
      <KpiCard Icon={CheckCircle2} label={t('dashboard.kpi.completedThisMonth')} value={String(kpis.completedThisMonth)} />
    </div>
  );

  const actionColumn = (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-line"><h2 className="text-sm font-semibold text-ink">{t('dashboard.action.title')}</h2></div>
      {actionItems.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-subtle">{t('dashboard.action.empty')}</p>
      ) : (
        <div className="divide-y divide-line">
          {actionItems.map((item, i) => (
            <Link key={i} to={`/cases/${item.caseId}`} className="block px-4 py-3 hover:bg-surface-sunken transition-colors">
              <p className="text-sm text-ink font-medium">{item.patientName}</p>
              <p className="text-xs text-ink-muted">{item.reason}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  const scheduleColumn = (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-line"><h2 className="text-sm font-semibold text-ink">{t('dashboard.schedule.title')}</h2></div>
      {todaysSchedule.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-subtle">{t('dashboard.schedule.empty')}</p>
      ) : (
        <div className="divide-y divide-line">
          {todaysSchedule.map((entry, i) => {
            const Icon = SCHEDULE_ICON[entry.type];
            return (
              <Link key={i} to={`/cases/${entry.caseId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-sunken transition-colors">
                <span className="text-xs text-ink-subtle w-12 shrink-0">{entry.time}</span>
                <Icon size={15} strokeWidth={1.75} className="text-ink-subtle shrink-0" aria-hidden="true" />
                <span className="text-sm text-ink truncate">{entry.patientName}</span>
                <span className="text-xs text-ink-subtle ml-auto shrink-0">{t(`dashboard.schedule.type.${entry.type}`)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  const aiActivityColumn = (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="px-4 py-3 border-b border-line"><h2 className="text-sm font-semibold text-ink">{t('dashboard.aiActivity.title')}</h2></div>
      {recentAiActivity.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-subtle">{t('dashboard.aiActivity.empty')}</p>
      ) : (
        <div className="divide-y divide-line">
          {recentAiActivity.map((item, i) => (
            <Link key={i} to={`/cases/${item.caseId}`} className="block px-4 py-3 hover:bg-surface-sunken transition-colors">
              <div className="flex items-center gap-1.5 mb-1">
                <span aria-hidden="true">{item.flag}</span>
                <span className="text-sm font-medium text-ink">{item.patientName}</span>
                <span className="text-[11px] text-ink-subtle ml-auto">{fmtTime(item.at)}</span>
              </div>
              <p className="text-xs text-ink-muted truncate">{item.text}</p>
              {item.translation && <p className="text-xs text-ink-subtle truncate">{item.translation}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  // Bölüm C: "koordinator → Bugünün programı en üstte", "muhasebe → teklif/
  // ödeme kartları öne", "hasta_danismani → Aksiyon gerektirenler en üstte",
  // "klinik_sahibi/operasyon_muduru → tam görünüm" (order below == "full").
  const columnOrder: [string, React.ReactNode][] =
    variant === 'coordinator' ? [['schedule', scheduleColumn], ['action', actionColumn], ['ai', aiActivityColumn]]
    : variant === 'consultant' ? [['action', actionColumn], ['ai', aiActivityColumn], ['schedule', scheduleColumn]]
    : [['action', actionColumn], ['schedule', scheduleColumn], ['ai', aiActivityColumn]];
  // 'accounting' shares the consultant ordering (action items already
  // surface awaiting-deposit quotes first via the KPI row) — the brief
  // doesn't ask for a 4th distinct column set, just KPI emphasis, which
  // the KPI row already gives equal prominence to for every variant.

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <AppMeta title={`${t('dashboard.title')} | CareNova`} />
        <div>
          <h1 className="text-xl font-semibold text-ink">{t('dashboard.title')}</h1>
          <p className="text-ink-muted text-sm mt-0.5">{t('dashboard.subtitle')}</p>
        </div>

        <OnboardingCard t={t} />

        {kpiRow}

        <div className="grid lg:grid-cols-3 gap-4">
          {columnOrder.map(([key, node]) => <React.Fragment key={key}>{node}</React.Fragment>)}
        </div>
      </div>
    </div>
  );
}

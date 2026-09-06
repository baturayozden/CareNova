import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import SchemeEditor from '../components/SchemeEditor';
import PaymentImporter from '../components/PaymentImporter';
import DealsTab from '../components/DealsTab';
import { formatDate } from '../utils/date';
import {
  BarChart2, Settings as SettingsIcon, CreditCard, Building2, Briefcase,
  Calculator, CheckCircle2, LockOpen, BarChart3, Trophy,
} from 'lucide-react';

// ─── Role constants ───────────────────────────────────────────────────────────
const APPROVE_ROLES = ['super_admin', 'admin', 'operasyon_muduru'];
const MANAGE_ROLES  = ['super_admin', 'admin', 'operasyon_muduru', 'klinik_sahibi'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatGBP(n: number | string | null | undefined): string {
  const val = Number(n ?? 0);
  return `€${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number | string | null | undefined): string {
  return `${Number(n ?? 0).toFixed(1)}%`;
}

// Count-up animation hook
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);
  useEffect(() => {
    cancelAnimationFrame(frameRef.current);
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * ease));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);
  return value;
}

// Progress ring SVG
function ProgressRing({ pct: pctVal, color }: { pct: number; color: string }) {
  const r    = 46;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(pctVal, 100) / 100;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" style={{ display: 'block' }}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
      <circle
        cx="60" cy="60" r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeDasharray={String(circ)}
        strokeDashoffset={circ * (1 - fill)}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)' }}
      />
    </svg>
  );
}

// Animated GBP number
function AnimatedGBP({ value }: { value: number }) {
  const v = useCountUp(value);
  return <span className="tabular-nums">{formatGBP(v)}</span>;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Period {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  target_amount: string | null;
  clinic_revenue: string | null;
  quota_revenue: string | null;
  total_revenue: string | null;
  effective_quota_revenue: string | null;
  status: 'open' | 'locked';
  total_commission_paid: string | null;
  created_at: string;
  locked_by_first?: string | null;
  locked_by_last?: string | null;
}

interface LiveDeal {
  id: string;
  assigned_staff_id: string | null;
  staff_first_name: string | null;
  staff_last_name: string | null;
  staff_role: string | null;
  agreed_amount: string | null;
  deposit_amount: string | null;
  status: string;
  treatment_category: string | null;
  treatment_name: string | null;
  deal_date: string | null;
  billing_entity_key: string | null;
  billing_entity_name: string | null;
  lead_id: string | null;
  patient_name: string | null;
  verification_status: string;
}

interface CommissionRecord {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  email: string;
  total_revenue: string;
  target_revenue: string | null;
  target_attainment: string | null;
  base_commission: string;
  performance_bonus: string;
  team_bonus: string;
  adjustment_amount: string;
  total_commission: string;
  status: string;
  notes: string | null;
  approved_by_first?: string | null;
  approved_by_last?: string | null;
  approved_at?: string | null;
}

interface ReportData {
  period: Period;
  records: CommissionRecord[];
}

interface TCRow {
  staffId: string;
  name: string;
  role: string;
  totalSales: number;
  dealCount: number;
  commission: number | null;
}

// ─── Badges ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Period['status'] }) {
  const styles: Record<string, string> = {
    open:   'bg-blue-900/60 text-blue-300',
    locked: 'bg-green-900/60 text-green-300',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? 'bg-gray-700 text-gray-300'}`}>
      {status === 'locked' ? 'Locked' : 'Open'}
    </span>
  );
}

function RecordStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft:    'bg-gray-700 text-gray-300',
    approved: 'bg-green-900/60 text-green-300',
    disputed: 'bg-red-900/60 text-red-300',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles[status] ?? 'bg-gray-700 text-gray-400'}`}>
      {status}
    </span>
  );
}

// Multiplier gate thresholds (per product spec)
const GATES = [
  { label: '<80%',   mult: '×0',   min: 0,   max: 80  },
  { label: '80–99%', mult: '×0.5', min: 80,  max: 100 },
  { label: '≥100%',  mult: '×1.0', min: 100, max: Infinity },
];

function gateColor(gate: typeof GATES[0], attainment: number) {
  const active = attainment >= gate.min && (gate.max === Infinity ? true : attainment < gate.max);
  if (!active) return 'bg-slate-100 text-slate-500 border-slate-200';
  if (gate.min === 0)   return 'bg-red-600 text-white border-red-500';
  if (gate.min === 80)  return 'bg-amber-500 text-amber-950 border-amber-400';
  return 'bg-green-700 text-white border-green-500';
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CommissionPage() {
  const { user } = useAuth();

  const [periods, setPeriods]               = useState<Period[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [periodsError, setPeriodsError]     = useState('');

  const [selectedId, setSelectedId]         = useState<string>('');
  const [report, setReport]                 = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading]   = useState(false);
  const [reportError, setReportError]       = useState('');

  const [liveDeals, setLiveDeals]               = useState<LiveDeal[]>([]);
  const [liveDealsLoading, setLiveDealsLoading] = useState(false);
  const [expandedTCs, setExpandedTCs]           = useState<Set<string>>(new Set());

  const [expandedRows, setExpandedRows]     = useState<Set<string>>(new Set());

  // New Period modal
  const [showNewPeriod, setShowNewPeriod]   = useState(false);
  const [newLabel, setNewLabel]             = useState('');
  const [newStart, setNewStart]             = useState('');
  const [newEnd, setNewEnd]                 = useState('');
  const [newRevenue, setNewRevenue]         = useState('');
  const [newTarget, setNewTarget]           = useState('');
  const [newPeriodLoading, setNewPeriodLoading] = useState(false);
  const [newPeriodError, setNewPeriodError] = useState('');

  // Revenue override modal
  const [showRevenue, setShowRevenue]       = useState(false);
  const [revenueInput, setRevenueInput]     = useState('');
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueError, setRevenueError]     = useState('');

  // Set target modal (for periods without a target)
  const [showSetTarget, setShowSetTarget]   = useState(false);
  const [targetInput, setTargetInput]       = useState('');
  const [targetLoading, setTargetLoading]   = useState(false);
  const [targetError, setTargetError]       = useState('');

  const [calcLoading, setCalcLoading]       = useState(false);
  const [calcError, setCalcError]           = useState('');
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError]     = useState('');

  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [unlockLoading, setUnlockLoading]         = useState(false);
  const [unlockError, setUnlockError]             = useState('');

  const [activeTab, setActiveTab] = useState<'report' | 'deals' | 'schemes' | 'payments'>('report');

  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [clinics, setClinics]                   = useState<{ id: string; name: string }[]>([]);
  const [clinicsLoading, setClinicsLoading]     = useState(false);

  const canManage       = MANAGE_ROLES.includes(user?.role ?? '');
  const canApprove      = APPROVE_ROLES.includes(user?.role ?? '');
  const isPlatformAdmin = user?.role ? ['super_admin', 'admin'].includes(user.role) : false;

  const effectiveTenantId: string | undefined =
    isPlatformAdmin ? (selectedClinicId ?? undefined) : undefined;

  // ── Load clinics (platform admin) ─────────────────────────────────────────
  useEffect(() => {
    if (!isPlatformAdmin) return;
    setClinicsLoading(true);
    api.get<{ clinics: { id: string; name: string }[] }>('/api/clinics')
      .then(res => setClinics(res.data.clinics))
      .catch(() => {})
      .finally(() => setClinicsLoading(false));
  }, [isPlatformAdmin]);

  // ── Reset when clinic selection changes ───────────────────────────────────
  useEffect(() => {
    if (isPlatformAdmin) {
      setSelectedId('');
      setReport(null);
      setPeriods([]);
      setPeriodsError('');
      setReportError('');
      setLiveDeals([]);
    }
  }, [isPlatformAdmin, selectedClinicId]);

  // ── Fetch periods ──────────────────────────────────────────────────────────
  const fetchPeriods = useCallback(async () => {
    if (isPlatformAdmin && !effectiveTenantId) {
      setPeriodsLoading(false);
      return;
    }
    setPeriodsLoading(true);
    setPeriodsError('');
    try {
      const res = await api.get<{ periods: Period[] }>('/api/commissions/periods', {
        params: effectiveTenantId ? { tenantId: effectiveTenantId } : undefined,
      });
      setPeriods(res.data.periods);
      setSelectedId(prev => prev || (res.data.periods[0]?.id ?? ''));
    } catch (err: any) {
      setPeriodsError(err?.response?.data?.error || 'Failed to load periods.');
    } finally {
      setPeriodsLoading(false);
    }
  }, [isPlatformAdmin, effectiveTenantId]);

  useEffect(() => { fetchPeriods(); }, [fetchPeriods]);

  // ── Fetch commission report ────────────────────────────────────────────────
  const fetchReport = useCallback(async (id: string) => {
    if (!id) return;
    setReportLoading(true);
    setReportError('');
    setReport(null);
    setExpandedRows(new Set());
    setCalcError('');
    setApproveError('');
    setUnlockError('');
    try {
      const res = await api.get<ReportData>(`/api/commissions/periods/${id}/report`, {
        params: effectiveTenantId ? { tenantId: effectiveTenantId } : undefined,
      });
      setReport(res.data);
    } catch (err: any) {
      if (err?.response?.status !== 404) {
        setReportError(err?.response?.data?.error || 'Failed to load report.');
      }
    } finally {
      setReportLoading(false);
    }
  }, [effectiveTenantId]);

  useEffect(() => {
    if (selectedId) fetchReport(selectedId);
  }, [selectedId, fetchReport]);

  // ── Fetch live deals for dashboard ────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    const p = periods.find(p => p.id === selectedId);
    if (!p) return;
    setLiveDealsLoading(true);
    api.get<{ deals: LiveDeal[] }>('/api/commissions/deals', {
      params: {
        periodStart: p.period_start,
        periodEnd:   p.period_end,
        ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
      },
    })
      .then(res => setLiveDeals(res.data.deals || []))
      .catch(() => setLiveDeals([]))
      .finally(() => setLiveDealsLoading(false));
  }, [selectedId, effectiveTenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleCreatePeriod(e: React.FormEvent) {
    e.preventDefault();
    setNewPeriodError('');
    setNewPeriodLoading(true);
    try {
      // 1. Create the commission period
      await api.post('/api/commissions/periods', {
        period_label:   newLabel.trim(),
        period_start:   newStart,
        period_end:     newEnd,
        clinic_revenue: newRevenue ? Number(newRevenue) : undefined,
        ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
      });
      // 2. If a target was supplied, create the revenue target entry separately
      if (newTarget) {
        await api.post('/api/commissions/revenue-targets', {
          period_start:  newStart,
          period_end:    newEnd,
          target_amount: Number(newTarget),
          target_type:   'monthly',
          currency:      'GBP',
          ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
        });
      }
      setShowNewPeriod(false);
      setNewLabel(''); setNewStart(''); setNewEnd(''); setNewRevenue(''); setNewTarget('');
      const res = await api.get<{ periods: Period[] }>('/api/commissions/periods', {
        params: effectiveTenantId ? { tenantId: effectiveTenantId } : undefined,
      });
      setPeriods(res.data.periods);
      if (res.data.periods[0]) setSelectedId(res.data.periods[0].id);
    } catch (err: any) {
      setNewPeriodError(err?.response?.data?.error || 'Failed to create period.');
    } finally {
      setNewPeriodLoading(false);
    }
  }

  async function handleSetTarget(e: React.FormEvent) {
    e.preventDefault();
    if (!period) return;
    setTargetError('');
    setTargetLoading(true);
    try {
      await api.post('/api/commissions/revenue-targets', {
        period_start:  period.period_start,
        period_end:    period.period_end,
        target_amount: Number(targetInput),
        target_type:   'monthly',
        currency:      'GBP',
        ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
      });
      setShowSetTarget(false);
      setTargetInput('');
      // Refetch periods so target_amount appears in the hero
      const res = await api.get<{ periods: Period[] }>('/api/commissions/periods', {
        params: effectiveTenantId ? { tenantId: effectiveTenantId } : undefined,
      });
      setPeriods(res.data.periods);
      const updated = res.data.periods.find(p => p.id === selectedId);
      if (updated) setReport(r => r ? { ...r, period: updated } : r);
    } catch (err: any) {
      setTargetError(err?.response?.data?.error || 'Failed to save target.');
    } finally {
      setTargetLoading(false);
    }
  }

  async function handleEnterRevenue(e: React.FormEvent) {
    e.preventDefault();
    setRevenueError('');
    setRevenueLoading(true);
    try {
      const res = await api.put<{ period: Period }>(`/api/commissions/periods/${selectedId}`, {
        clinic_revenue: Number(revenueInput),
        ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
      });
      setShowRevenue(false);
      setRevenueInput('');
      const updated = res.data.period;
      setPeriods(ps => ps.map(p => (p.id === selectedId ? { ...p, ...updated } : p)));
      setReport(r => r ? { ...r, period: updated } : r);
    } catch (err: any) {
      setRevenueError(err?.response?.data?.error || 'Failed to save revenue.');
    } finally {
      setRevenueLoading(false);
    }
  }

  async function handleCalculate() {
    setCalcError('');
    setCalcLoading(true);
    try {
      await api.post(`/api/commissions/periods/${selectedId}/calculate`, {
        requireVerification: true,
        ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
      });
      await fetchReport(selectedId);
    } catch (err: any) {
      setCalcError(err?.response?.data?.error || 'Calculation failed.');
    } finally {
      setCalcLoading(false);
    }
  }

  async function handleApprove() {
    setApproveError('');
    setApproveLoading(true);
    try {
      const res = await api.post<{ period: Period }>(
        `/api/commissions/periods/${selectedId}/approve`,
        effectiveTenantId ? { tenantId: effectiveTenantId } : {},
      );
      const updated = res.data.period;
      setPeriods(ps => ps.map(p => (p.id === selectedId ? { ...p, ...updated } : p)));
      await fetchReport(selectedId);
    } catch (err: any) {
      setApproveError(err?.response?.data?.error || 'Approval failed.');
    } finally {
      setApproveLoading(false);
    }
  }

  async function handleUnlock() {
    setUnlockError('');
    setUnlockLoading(true);
    try {
      const res = await api.post<{ period: Period }>(
        `/api/commissions/periods/${selectedId}/unlock`,
        effectiveTenantId ? { tenantId: effectiveTenantId } : {},
      );
      setShowUnlockConfirm(false);
      const updated = res.data.period;
      setPeriods(ps => ps.map(p => (p.id === selectedId ? { ...p, ...updated } : p)));
      await fetchReport(selectedId);
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 409) setUnlockError('This period is already open.');
      else if (s === 403) setUnlockError('You do not have permission to unlock this period.');
      else setUnlockError(err?.response?.data?.error || 'Unlock failed.');
    } finally {
      setUnlockLoading(false);
    }
  }

  function toggleRow(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const period       = report?.period ?? periods.find(p => p.id === selectedId) ?? null;
  const isLocked     = period?.status === 'locked';
  const hasRecords   = (report?.records?.length ?? 0) > 0;

  const totalCommission  = report?.records.reduce((s, r) => s + Number(r.total_commission), 0) ?? 0;
  const totalPersonalRev = report?.records.reduce((s, r) => s + Number(r.total_revenue),    0) ?? 0;

  // Live deal data (exclude lost/cancelled)
  const activeDeals     = liveDeals.filter(d => !['lost', 'cancelled'].includes(d.status));
  const liveTotalSales  = activeDeals.reduce((s, d) => s + (Number(d.agreed_amount) || 0), 0);
  const liveQuotaSales  = activeDeals
    .filter(d => d.staff_role === 'hasta_danismani')
    .reduce((s, d) => s + (Number(d.agreed_amount) || 0), 0);

  // Build leaderboard from live deals, overlay commission records
  const tcMap = new Map<string, TCRow>();
  for (const deal of activeDeals) {
    if (!deal.assigned_staff_id) continue;
    if (!tcMap.has(deal.assigned_staff_id)) {
      tcMap.set(deal.assigned_staff_id, {
        staffId:    deal.assigned_staff_id,
        name:       [deal.staff_first_name, deal.staff_last_name].filter(Boolean).join(' ') || '—',
        role:       deal.staff_role || '',
        totalSales: 0,
        dealCount:  0,
        commission: null,
      });
    }
    const entry = tcMap.get(deal.assigned_staff_id)!;
    entry.totalSales += Number(deal.agreed_amount) || 0;
    entry.dealCount  += 1;
  }
  for (const rec of (report?.records ?? [])) {
    if (tcMap.has(rec.staff_id)) {
      tcMap.get(rec.staff_id)!.commission = Number(rec.total_commission);
    }
  }
  const leaderboard    = Array.from(tcMap.values()).sort((a, b) => b.totalSales - a.totalSales);
  const activeTCCount  = leaderboard.length;

  // Progress ring — quota-only (TC deals). target_amount null = no target set.
  const hasTarget     = period?.target_amount != null;
  const targetAmount  = Number(period?.target_amount ?? 0);
  const effectiveRev  = Number(period?.effective_quota_revenue ?? 0);
  const attainmentPct = hasTarget && targetAmount > 0 ? (effectiveRev / targetAmount) * 100 : 0;
  const ringColor     = !hasTarget ? '#475569'
    : attainmentPct >= 100 ? '#22c55e'
    : attainmentPct >= 80  ? '#f59e0b'
    : '#ef4444';
  const toTarget      = Math.max(0, targetAmount - effectiveRev);

  const inputCls = 'w-full bg-surface border border-line text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/40';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-white">Commission</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage commission periods, reports, and schemes</p>
      </div>

      {/* Clinic selector (platform admin) */}
      {isPlatformAdmin && (
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm font-medium shrink-0">Clinic:</span>
          {clinicsLoading ? (
            <span className="text-gray-500 text-sm">Loading clinics…</span>
          ) : (
            <select
              value={selectedClinicId ?? ''}
              onChange={e => setSelectedClinicId(e.target.value || null)}
              className="bg-surface-sunken border border-line text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 min-w-[240px]"
            >
              <option value="">— Select a clinic —</option>
              {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-surface-sunken -mb-2">
        {(['report', 'deals', 'schemes', 'payments'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab ? 'border-accent text-accent' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab === 'report'
              ? <><BarChart2 size={14} className="inline mr-1.5 -mt-0.5" />Report</>
              : tab === 'deals'
              ? <><Briefcase size={14} className="inline mr-1.5 -mt-0.5" />Deals</>
              : tab === 'schemes'
              ? <><SettingsIcon size={14} className="inline mr-1.5 -mt-0.5" />Scheme</>
              : <><CreditCard size={14} className="inline mr-1.5 -mt-0.5" />Payments</>}
          </button>
        ))}
      </div>

      {/* Clinic placeholder */}
      {isPlatformAdmin && !selectedClinicId ? (
        <div className="bg-surface-sunken border border-line rounded-xl p-12 flex flex-col items-center text-center">
          <Building2 size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-white font-semibold text-base mb-1">Select a clinic to view commission data</p>
          <p className="text-gray-400 text-sm">Choose a clinic from the dropdown above to get started.</p>
        </div>
      ) : (
        <>

      {/* ══════════════════════════════════════════════════════════════════════
          REPORT TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'report' && (
        <>

      {/* ── Compact controls bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {periodsLoading ? (
          <span className="text-gray-500 text-sm">Loading…</span>
        ) : periodsError ? (
          <span className="text-red-400 text-sm">{periodsError}</span>
        ) : periods.length === 0 ? (
          <span className="text-gray-500 text-sm">
            No periods yet.{' '}
            {canManage && (
              <button onClick={() => setShowNewPeriod(true)} className="text-accent underline">
                Create one.
              </button>
            )}
          </span>
        ) : (
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="bg-surface-sunken border border-line text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 min-w-[200px]"
          >
            {periods.map(p => <option key={p.id} value={p.id}>{p.period_label}</option>)}
          </select>
        )}

        {period && <StatusBadge status={period.status} />}

        <div className="flex-1" />

        {canManage && (
          <button
            onClick={() => setShowNewPeriod(true)}
            className="px-3 py-1.5 text-xs bg-surface-sunken text-gray-300 border border-line rounded-lg hover:bg-line transition-colors"
          >
            + New Period
          </button>
        )}

        {period && canManage && !isLocked && (
          <button
            onClick={() => { setRevenueInput(period.clinic_revenue ?? ''); setShowRevenue(true); }}
            className="px-3 py-1.5 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-colors whitespace-nowrap"
          >
            {period.clinic_revenue ? 'Edit Quota Override' : 'Override Quota Revenue'}
          </button>
        )}

        {period && canManage && !isLocked && (
          <button
            onClick={handleCalculate}
            disabled={calcLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            <Calculator size={13} />
            {calcLoading ? 'Calculating…' : 'Calculate'}
          </button>
        )}

        {period && canApprove && hasRecords && !isLocked && (
          <button
            onClick={handleApprove}
            disabled={approveLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 size={13} />
            {approveLoading ? 'Approving…' : 'Approve'}
          </button>
        )}

        {period && isLocked && canApprove && (
          <button
            onClick={() => { setUnlockError(''); setShowUnlockConfirm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600/80 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            <LockOpen size={13} /> Unlock
          </button>
        )}
      </div>

      {(calcError || approveError || unlockError) && (
        <p className="text-red-400 text-sm">
          {calcError || approveError || unlockError}
        </p>
      )}

      {/* ── Hero — clinic target progress ─────────────────────────────────────── */}
      {period && (
        <div className="bg-surface-sunken border border-line rounded-xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">

            {/* Ring + numbers */}
            <div className="flex items-center gap-5">
              <div className="relative">
                <ProgressRing pct={hasTarget ? attainmentPct : 0} color={ringColor} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {hasTarget ? (
                    <span className="text-white font-bold text-base tabular-nums leading-tight">
                      {attainmentPct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-600 text-xs text-center leading-tight px-1">no<br/>target</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Quota Progress</p>
                <p className="text-white text-2xl font-bold tabular-nums leading-tight">
                  <AnimatedGBP value={effectiveRev} />
                </p>
                <p className="text-[10px] text-accent/60 mt-0.5">UK TC sales only</p>
                {hasTarget ? (
                  <>
                    <p className="text-gray-500 text-sm tabular-nums mt-0.5">
                      / {formatGBP(targetAmount)} target
                    </p>
                    {!period.clinic_revenue && (
                      <p className="text-gray-600 text-[10px] italic mt-0.5">auto from TC deals</p>
                    )}
                    {toTarget > 0 && (
                      <p className="text-gray-500 text-xs mt-1">
                        {formatGBP(toTarget)} to target
                      </p>
                    )}
                  </>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-gray-600 text-xs italic">No target set for this period</span>
                    {canManage && !isLocked && (
                      <button
                        onClick={() => { setTargetInput(''); setTargetError(''); setShowSetTarget(true); }}
                        className="text-xs text-accent underline hover:text-accent/80 transition-colors"
                      >
                        Set target
                      </button>
                    )}
                  </div>
                )}
                {isLocked && period.locked_by_first && (
                  <p className="text-gray-600 text-xs mt-1">
                    Approved by {period.locked_by_first} {period.locked_by_last}
                  </p>
                )}
              </div>
            </div>

            <div className="flex-1" />

            {/* Multiplier gates — only meaningful when target exists */}
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-2">Multiplier Gates</p>
              <div className="flex gap-2">
                {GATES.map(gate => (
                  <div
                    key={gate.label}
                    className={`flex flex-col items-center px-3 py-2 rounded-lg border text-center min-w-[64px] transition-all ${
                      hasTarget ? gateColor(gate, attainmentPct) : 'bg-surface/60 text-gray-600 border-surface-sunken'
                    }`}
                  >
                    <span className="text-[10px] font-semibold mb-0.5">{gate.label}</span>
                    <span className="text-base font-bold">{gate.mult}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {hasTarget && targetAmount > 0 && (
            <div className="mt-5">
              <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.min(attainmentPct, 100)}%`,
                    backgroundColor: ringColor,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Metric cards ──────────────────────────────────────────────────────── */}
      {period && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Quota Revenue',
              value: formatGBP(liveQuotaSales),
              sub: 'UK TC deals only',
              loading: liveDealsLoading,
            },
            {
              label: 'Total Clinic Revenue',
              value: formatGBP(liveTotalSales),
              sub: `${activeDeals.length} deal${activeDeals.length !== 1 ? 's' : ''} — all sales, not quota-eligible`,
              loading: liveDealsLoading,
            },
            {
              label: 'Deal Count',
              value: String(activeDeals.length),
              sub: liveDealsLoading ? '—' : activeDeals.length === 1 ? '1 active deal' : `${activeDeals.length} active deals`,
              loading: liveDealsLoading,
            },
            {
              label: 'Active TCs',
              value: String(activeTCCount),
              sub: hasRecords ? `${formatGBP(totalCommission)} commission` : 'Run Calculate for commission',
              loading: liveDealsLoading,
            },
          ].map(card => (
            <div key={card.label} className="bg-surface-sunken border border-line rounded-xl px-5 py-4">
              <p className="text-gray-400 text-[11px] uppercase tracking-widest mb-1">{card.label}</p>
              <p className="text-white text-2xl font-bold tabular-nums leading-tight">
                {card.loading ? <span className="text-gray-600">…</span> : card.value}
              </p>
              <p className="text-gray-500 text-xs mt-1">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── TC Leaderboard ────────────────────────────────────────────────────── */}
      {period && (
        <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-sunken flex items-center gap-2">
            <Trophy size={15} className="text-accent" />
            <h3 className="text-white font-semibold text-sm">Sales Leaderboard</h3>
            <span className="text-gray-600 text-xs ml-1">— live from deals</span>
            {hasRecords && (
              <span className="ml-auto text-gray-500 text-xs">Commissions calculated</span>
            )}
          </div>

          {liveDealsLoading ? (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">Loading deals…</div>
          ) : leaderboard.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <BarChart3 size={28} className="mx-auto mb-2 text-gray-600" />
              <p className="text-gray-500 text-sm">No sales yet this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-sunken bg-surface/40">
                    <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wide w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wide">Name</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wide">Sales</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wide">Deals</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wide">Commission</th>
                    {targetAmount > 0 && (
                      <th className="px-4 py-2.5 text-gray-500 font-medium text-[11px] uppercase tracking-wide min-w-[120px]">Progress</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-sunken">
                  {leaderboard.map((tc, i) => {
                    const isNonQuota   = tc.role !== 'hasta_danismani';
                    const tcPct        = targetAmount > 0 ? Math.min((tc.totalSales / targetAmount) * 100, 100) : 0;
                    const isExpanded   = expandedTCs.has(tc.staffId);
                    const tcDeals      = activeDeals.filter(d => d.assigned_staff_id === tc.staffId);
                    const colSpan      = targetAmount > 0 ? 6 : 5;
                    return (
                      <React.Fragment key={tc.staffId}>
                        <tr
                          className="hover:bg-surface-sunken/30 transition-colors cursor-pointer select-none"
                          onClick={() => setExpandedTCs(prev => {
                            const next = new Set(prev);
                            next.has(tc.staffId) ? next.delete(tc.staffId) : next.add(tc.staffId);
                            return next;
                          })}
                        >
                          <td className="px-4 py-3 text-gray-500 font-medium text-xs">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                              <span className="text-white font-medium">{tc.name}</span>
                              {isNonQuota && (
                                <span className="px-1.5 py-0.5 bg-slate-600 text-white rounded text-[10px] font-medium">
                                  Not in quota
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-white font-semibold tabular-nums">
                            {formatGBP(tc.totalSales)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-400 tabular-nums">
                            {tc.dealCount}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {tc.commission !== null
                              ? <span className="text-accent font-semibold">{formatGBP(tc.commission)}</span>
                              : <span className="text-gray-600">—</span>}
                          </td>
                          {targetAmount > 0 && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-accent/70 transition-all duration-700"
                                    style={{ width: `${tcPct}%` }}
                                  />
                                </div>
                                <span className="text-gray-500 text-[10px] tabular-nums w-9 text-right">
                                  {tcPct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          )}
                        </tr>
                        {isExpanded && (
                          <tr className="bg-surface/60">
                            <td colSpan={colSpan} className="px-0 py-0">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-surface-sunken/60">
                                    <th className="text-left pl-12 pr-3 py-2 text-gray-600 font-medium uppercase tracking-wide">Patient</th>
                                    <th className="text-left px-3 py-2 text-gray-600 font-medium uppercase tracking-wide">Treatment</th>
                                    <th className="text-left px-3 py-2 text-gray-600 font-medium uppercase tracking-wide">Date</th>
                                    <th className="text-right px-3 py-2 text-gray-600 font-medium uppercase tracking-wide">Amount</th>
                                    <th className="text-left px-3 py-2 text-gray-600 font-medium uppercase tracking-wide">Status</th>
                                    <th className="text-left px-3 py-2 text-gray-600 font-medium uppercase tracking-wide">Entity</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-sunken/60">
                                  {tcDeals.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} className="pl-12 pr-3 py-3 text-gray-600 italic">No active deals</td>
                                    </tr>
                                  ) : tcDeals.map(d => (
                                    <tr key={d.id} className="hover:bg-surface-sunken/40 transition-colors">
                                      <td className="pl-12 pr-3 py-2.5">
                                        {d.lead_id ? (
                                          <a
                                            href={`/patients/${d.lead_id}`}
                                            onClick={e => e.stopPropagation()}
                                            className="text-accent/80 hover:text-accent hover:underline"
                                          >
                                            {d.patient_name || '—'}
                                          </a>
                                        ) : (
                                          <span className="text-gray-400">{d.patient_name || '—'}</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5 text-gray-300">
                                        {d.treatment_name || d.treatment_category || '—'}
                                      </td>
                                      <td className="px-3 py-2.5 text-gray-400 tabular-nums whitespace-nowrap">
                                        {d.deal_date ? formatDate(d.deal_date) : '—'}
                                      </td>
                                      <td className="px-3 py-2.5 text-right text-white font-medium tabular-nums">
                                        {formatGBP(d.agreed_amount)}
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            d.status === 'completed'    ? 'bg-green-900/60 text-green-300'  :
                                            d.status === 'in_progress'  ? 'bg-blue-900/60 text-blue-300'   :
                                            d.status === 'accepted'     ? 'bg-purple-900/60 text-purple-300':
                                            'bg-gray-800 text-gray-400'
                                          }`}>
                                            {d.status.replace('_', ' ')}
                                          </span>
                                          {d.verification_status === 'unverified' && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-600 text-amber-950">
                                              Unverified
                                            </span>
                                          )}
                                          {d.verification_status === 'rejected' && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-600 text-white">
                                              Rejected
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2.5 text-gray-500">
                                        {d.billing_entity_name || d.billing_entity_key || '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Report loading / error ────────────────────────────────────────────── */}
      {reportLoading && (
        <div className="bg-surface-sunken border border-line rounded-xl p-8 text-center text-gray-400 text-sm">
          Loading commission records…
        </div>
      )}
      {reportError && !reportLoading && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {reportError}
        </div>
      )}

      {/* ── Commission records table (post-Calculate) ─────────────────────────── */}
      {!reportLoading && !reportError && hasRecords && report && (
        <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-sunken flex items-center justify-between">
            <h3 className="text-white font-semibold text-sm">Commission Detail</h3>
            <p className="text-gray-500 text-xs">Click a row to expand breakdown</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-sunken bg-surface/40">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Staff</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Personal Rev</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Base</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Performance</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Team</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Total</th>
                  <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Target %</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-xs w-10">Status</th>
                  <th className="px-3 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-sunken">
                {report.records.map(rec => (
                  <React.Fragment key={rec.id}>
                    <tr
                      className="hover:bg-surface-sunken/50 cursor-pointer transition-colors"
                      onClick={() => toggleRow(rec.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{rec.first_name} {rec.last_name}</p>
                        <p className="text-gray-500 text-xs">{rec.email}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{formatGBP(rec.total_revenue)}</td>
                      <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{formatGBP(rec.base_commission)}</td>
                      <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{formatGBP(rec.performance_bonus)}</td>
                      <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{formatGBP(rec.team_bonus)}</td>
                      <td className="px-4 py-3 text-right text-accent font-semibold tabular-nums">{formatGBP(rec.total_commission)}</td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs tabular-nums">
                        {rec.target_attainment ? pct(rec.target_attainment) : '—'}
                      </td>
                      <td className="px-4 py-3"><RecordStatusBadge status={rec.status} /></td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className="text-gray-500 text-xs inline-block transition-transform duration-200"
                          style={{ transform: expandedRows.has(rec.id) ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        >
                          ▶
                        </span>
                      </td>
                    </tr>

                    {expandedRows.has(rec.id) && (
                      <tr className="bg-surface/60">
                        <td colSpan={9} className="px-6 py-5">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Calculation Breakdown</p>
                            {rec.notes ? (
                              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-surface/60 rounded-lg px-4 py-3 border border-surface-sunken">
                                {rec.notes}
                              </p>
                            ) : (
                              <p className="text-gray-500 text-sm italic">No breakdown recorded.</p>
                            )}
                            {rec.adjustment_amount && Number(rec.adjustment_amount) !== 0 && (
                              <p className="text-xs text-yellow-400">Adjustment: {formatGBP(rec.adjustment_amount)}</p>
                            )}
                            {rec.approved_at && (
                              <p className="text-xs text-gray-500">
                                Approved by {rec.approved_by_first} {rec.approved_by_last} — {formatDate(rec.approved_at)}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-line bg-surface/40">
                  <td className="px-4 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wide">
                    Total ({report.records.length} {report.records.length === 1 ? 'staff member' : 'staff members'})
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold text-sm tabular-nums">{formatGBP(totalPersonalRev)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold text-sm tabular-nums">
                    {formatGBP(report.records.reduce((s, r) => s + Number(r.base_commission), 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold text-sm tabular-nums">
                    {formatGBP(report.records.reduce((s, r) => s + Number(r.performance_bonus), 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold text-sm tabular-nums">
                    {formatGBP(report.records.reduce((s, r) => s + Number(r.team_bonus), 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-accent font-bold text-sm tabular-nums">{formatGBP(totalCommission)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          OTHER TABS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'deals' && (
        <DealsTab
          tenantId={effectiveTenantId}
          currentUserId={user?.id ?? ''}
          userRole={user?.role ?? ''}
          currentUserName={user ? `${user.firstName} ${user.lastName}`.trim() : undefined}
        />
      )}

      {activeTab === 'schemes' && <SchemeEditor tenantId={effectiveTenantId} />}

      {activeTab === 'payments' && <PaymentImporter tenantId={effectiveTenantId} />}

        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          NEW PERIOD MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showNewPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-sunken border border-line rounded-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">New Commission Period</h2>
              <button onClick={() => setShowNewPeriod(false)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleCreatePeriod} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Period Name <span className="text-red-400">*</span></label>
                <input required type="text" placeholder="e.g. July 2026" value={newLabel} onChange={e => setNewLabel(e.target.value)} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">Start Date <span className="text-red-400">*</span></label>
                  <input required type="date" value={newStart} onChange={e => setNewStart(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">End Date <span className="text-red-400">*</span></label>
                  <input required type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Clinic Revenue Target (€) <span className="text-red-400">*</span></label>
                <input
                  required
                  type="number" min="0" step="0.01" placeholder="300000"
                  value={newTarget} onChange={e => setNewTarget(e.target.value)}
                  className={inputCls}
                />
                <p className="text-gray-600 text-xs mt-1">Used for the hero progress ring and multiplier gates.</p>
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Quota Revenue Override (€) <span className="text-gray-600 font-normal">— optional, UK TC sales only</span></label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={newRevenue} onChange={e => setNewRevenue(e.target.value)} className={inputCls} />
                <p className="text-gray-600 text-xs mt-1">Leave blank to auto-compute from TC deals.</p>
              </div>

              {newPeriodError && <p className="text-red-400 text-sm">{newPeriodError}</p>}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowNewPeriod(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={newPeriodLoading} className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">
                  {newPeriodLoading ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          REVENUE OVERRIDE MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showRevenue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-sunken border border-line rounded-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">Override Quota Revenue</h2>
              <button onClick={() => setShowRevenue(false)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleEnterRevenue} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">Quota Revenue Override (€) — UK TC sales only</label>
                <input
                  required type="number" min="0" step="0.01" placeholder="0.00"
                  value={revenueInput} onChange={e => setRevenueInput(e.target.value)}
                  autoFocus className={inputCls}
                />
                <p className="text-gray-600 text-xs mt-1">Overrides the auto-computed TC-only quota. Does not affect total clinic revenue.</p>
              </div>

              {revenueError && <p className="text-red-400 text-sm">{revenueError}</p>}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowRevenue(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={revenueLoading} className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">
                  {revenueLoading ? 'Saving…' : 'Save Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          UNLOCK CONFIRM MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showUnlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-sunken border border-line rounded-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg">Unlock Period</h2>
              <button onClick={() => setShowUnlockConfirm(false)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>

            <p className="text-gray-300 text-sm leading-relaxed mb-2">
              This will reopen <span className="text-white font-medium">{period?.period_label}</span> for
              editing. All approved commission records will revert to draft status, and locked treatment
              deals will be unlocked.
            </p>
            <p className="text-gray-500 text-xs mb-5">The action is logged in the audit trail. Continue?</p>

            {unlockError && <p className="text-red-400 text-sm mb-4">{unlockError}</p>}

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowUnlockConfirm(false)} disabled={unlockLoading} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleUnlock} disabled={unlockLoading} className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-500 disabled:opacity-50 transition-colors">
                {unlockLoading ? 'Unlocking…' : 'Unlock Period'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SET TARGET MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showSetTarget && period && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-sunken border border-line rounded-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">Set Revenue Target</h2>
              <button onClick={() => setShowSetTarget(false)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Period: <span className="text-white font-medium">{period.period_label}</span>
            </p>

            <form onSubmit={handleSetTarget} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">
                  Clinic Revenue Target (€) <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  type="number" min="0" step="0.01" placeholder="300000"
                  value={targetInput} onChange={e => setTargetInput(e.target.value)}
                  autoFocus className={inputCls}
                />
                <p className="text-gray-600 text-xs mt-1">Used for progress ring and multiplier gate calculation.</p>
              </div>

              {targetError && <p className="text-red-400 text-sm">{targetError}</p>}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowSetTarget(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={targetLoading} className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">
                  {targetLoading ? 'Saving…' : 'Save Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

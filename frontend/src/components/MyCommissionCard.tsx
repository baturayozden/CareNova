import React, { useEffect, useState } from 'react';
import { PoundSterling } from 'lucide-react';
import api from '../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatGBP(n: number | string | null | undefined): string {
  const val = Number(n ?? 0);
  return `€${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface EstimateActive {
  activePeriod: true;
  periodId: string;
  periodLabel: string;
  periodStatus: 'open' | 'locked';
  clinicRevenueKnown: boolean;
  estimationNote: string | null;
  includeUnverified: boolean;
  verifiedDealCount: number;
  unverifiedDealCount: number;
  totalRevenue: number;
  targetAttainment: number;
  baseCommission: number;
  performanceBonus: number;
  teamBonus: number;
  adjustmentAmount: number;
  totalCommission: number;
  reasoning: string;
}

interface EstimateInactive {
  activePeriod: false;
  message?: string;
}

type EstimateResponse = EstimateActive | EstimateInactive;

// ─── Breakdown row ────────────────────────────────────────────────────────────
function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="text-gray-300 text-xs font-medium">{value}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MyCommissionCard() {
  const [data, setData]       = useState<EstimateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get<EstimateResponse>('/api/commissions/my-estimate');
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setError("Couldn't load your commission estimate.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-surface-sunken border border-line rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <PoundSterling size={16} />
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">My Commission</p>
        </div>
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <div className="w-4 h-4 border border-accent/40 border-t-accent rounded-full animate-spin shrink-0" />
          Loading…
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-surface-sunken border border-line rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <PoundSterling size={16} />
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">My Commission</p>
        </div>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  // ── No active period ─────────────────────────────────────────────────────────
  if (!data || !data.activePeriod) {
    return (
      <div className="bg-surface-sunken border border-line rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <PoundSterling size={16} />
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">My Commission</p>
        </div>
        <p className="text-gray-500 text-sm">No active commission period right now.</p>
      </div>
    );
  }

  // ── Active estimate ──────────────────────────────────────────────────────────
  const est = data;
  const isLocked = est.periodStatus === 'locked';

  return (
    <div className="bg-surface-sunken border border-line rounded-xl p-6 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <PoundSterling size={16} />
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">My Commission</p>
            <p className="text-white text-sm font-medium mt-0.5">{est.periodLabel}</p>
          </div>
        </div>

        {/* ESTIMATE / FINAL badge */}
        {isLocked ? (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-900/60 text-green-300 uppercase tracking-wide">
            Final
          </span>
        ) : (
          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-900/50 text-yellow-300 uppercase tracking-wide">
            Estimate
          </span>
        )}
      </div>

      {/* Total commission — primary number */}
      <div>
        <p className="text-3xl font-semibold text-accent">{formatGBP(est.totalCommission)}</p>
        {!isLocked && (
          <p className="text-gray-500 text-xs mt-1">
            This is an estimate and may change before the period closes.
          </p>
        )}
      </div>

      {/* Breakdown */}
      <div className="space-y-1.5 pt-1 border-t border-surface-sunken">
        <BreakdownRow label="Personal Revenue"    value={formatGBP(est.totalRevenue)} />
        <BreakdownRow label="Base Commission"     value={formatGBP(est.baseCommission)} />
        {est.performanceBonus > 0 && (
          <BreakdownRow label="Performance Bonus" value={formatGBP(est.performanceBonus)} />
        )}
        {est.teamBonus > 0 && (
          <BreakdownRow label="Team Bonus"        value={formatGBP(est.teamBonus)} />
        )}
        {est.adjustmentAmount !== 0 && (
          <BreakdownRow label="Adjustment"        value={formatGBP(est.adjustmentAmount)} />
        )}
        <BreakdownRow label="Target Attainment"  value={`${Number(est.targetAttainment).toFixed(1)}%`} />
      </div>

      {/* Transparency flags */}
      {(!est.clinicRevenueKnown || est.unverifiedDealCount > 0) && (
        <div className="space-y-2">
          {!est.clinicRevenueKnown && est.estimationNote && (
            <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              <span className="text-yellow-400 text-xs shrink-0 mt-0.5">⚠</span>
              <p className="text-yellow-300 text-xs leading-relaxed">{est.estimationNote}</p>
            </div>
          )}
          {est.unverifiedDealCount > 0 && (
            <div className="flex items-start gap-2 bg-blue-900/20 border border-blue-700/30 rounded-lg px-3 py-2">
              <span className="text-blue-400 text-xs shrink-0 mt-0.5">ℹ</span>
              <p className="text-blue-300 text-xs leading-relaxed">
                {est.unverifiedDealCount} deal{est.unverifiedDealCount !== 1 ? 's' : ''} pending
                payment verification — your estimate may change once verified.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reasoning */}
      {est.reasoning && (
        <details className="group">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 transition-colors select-none list-none flex items-center gap-1">
            <span className="group-open:rotate-90 inline-block transition-transform duration-150 text-[10px]">▶</span>
            How this was calculated
          </summary>
          <p className="mt-2 text-gray-500 text-xs leading-relaxed bg-surface/60 rounded-lg px-3 py-2 border border-surface-sunken">
            {est.reasoning}
          </p>
        </details>
      )}
    </div>
  );
}

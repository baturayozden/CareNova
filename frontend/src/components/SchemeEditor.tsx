import React, { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';
import { formatDate } from '../utils/date';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CommissionTier {
  id: string;
  tier_order: number;
  min_revenue: string;
  max_revenue: string | null;
  rate_percent: string;
  flat_bonus: string;
}

interface PerformanceThreshold {
  id: string;
  target_percent: string;
  multiplier: string;
  label: string | null;
}

interface TeamBonusTier {
  id: string;
  tier_order: number;
  min_revenue: string;
  max_revenue: string | null;
  bonus_per_staff: string;
}

interface CommissionScheme {
  id: string;
  name: string;
  type: 'flat_rate' | 'tiered' | 'target_based';
  tier_application: 'flat' | 'marginal';
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  description: string | null;
  tiers?: CommissionTier[];
  thresholds?: PerformanceThreshold[];
  team_bonus_tiers?: TeamBonusTier[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatGBP(n: number | string | null | undefined): string {
  const val = Number(n ?? 0);
  return `€${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


const SCHEME_TYPE_LABELS: Record<string, string> = {
  flat_rate:    'Flat Rate',
  tiered:       'Tiered',
  target_based: 'Target Based',
};

// ─── Shared input classes ─────────────────────────────────────────────────────
const inputCls =
  'w-full bg-navy-900 border border-navy-600 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gold/40';
const selectCls =
  'w-full bg-navy-900 border border-navy-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40';

// ─── Section header sub-component ────────────────────────────────────────────
function SectionHeader({
  title,
  addLabel,
  onAdd,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-navy-700">
      <h4 className="text-white font-semibold text-sm">{title}</h4>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 text-xs text-gold hover:text-gold/80 transition-colors border border-gold/30 hover:border-gold/60 rounded-lg px-2.5 py-1"
      >
        <span className="text-base leading-none">+</span>
        {addLabel}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SchemeEditor({ tenantId }: { tenantId?: string }) {
  const [scheme, setScheme]     = useState<CommissionScheme | null>(null);
  const [loading, setLoading]   = useState(true);
  const [topError, setTopError] = useState('');

  // ── Scheme form (create / edit header) ──────────────────────────────────
  const [showSchemeForm, setShowSchemeForm]       = useState(false);
  const [schemeName, setSchemeName]               = useState('');
  const [schemeType, setSchemeType]               = useState<CommissionScheme['type']>('tiered');
  const [schemeTierApp, setSchemeTierApp]         = useState<CommissionScheme['tier_application']>('flat');
  const [schemeEffFrom, setSchemeEffFrom]         = useState('');
  const [schemeFormLoading, setSchemeFormLoading] = useState(false);
  const [schemeFormError, setSchemeFormError]     = useState('');

  // ── Commission Tiers ─────────────────────────────────────────────────────
  const [showTierModal, setShowTierModal]   = useState(false);
  const [editingTier, setEditingTier]       = useState<CommissionTier | null>(null);
  const [tierOrder, setTierOrder]           = useState('');
  const [tierMinRev, setTierMinRev]         = useState('');
  const [tierMaxRev, setTierMaxRev]         = useState('');
  const [tierRate, setTierRate]             = useState('');
  const [tierFlatBonus, setTierFlatBonus]   = useState('');
  const [tierLoading, setTierLoading]       = useState(false);
  const [tierError, setTierError]           = useState('');
  const [deletingTierId, setDeletingTierId] = useState<string | null>(null);

  // ── Performance Thresholds ───────────────────────────────────────────────
  const [showThreshModal, setShowThreshModal]   = useState(false);
  const [editingThresh, setEditingThresh]       = useState<PerformanceThreshold | null>(null);
  const [threshPct, setThreshPct]               = useState('');
  const [threshMultiplier, setThreshMultiplier] = useState('');
  const [threshLabel, setThreshLabel]           = useState('');
  const [threshLoading, setThreshLoading]       = useState(false);
  const [threshError, setThreshError]           = useState('');
  const [deletingThreshId, setDeletingThreshId] = useState<string | null>(null);

  // ── Team Bonus Tiers ─────────────────────────────────────────────────────
  const [showTbModal, setShowTbModal]           = useState(false);
  const [editingTb, setEditingTb]               = useState<TeamBonusTier | null>(null);
  const [tbOrder, setTbOrder]                   = useState('');
  const [tbMinRev, setTbMinRev]                 = useState('');
  const [tbMaxRev, setTbMaxRev]                 = useState('');
  const [tbBonusPerStaff, setTbBonusPerStaff]   = useState('');
  const [tbLoading, setTbLoading]               = useState(false);
  const [tbError, setTbError]                   = useState('');
  const [deletingTbId, setDeletingTbId]         = useState<string | null>(null);

  // ── Fetch scheme ──────────────────────────────────────────────────────────
  const fetchScheme = useCallback(async () => {
    setTopError('');
    try {
      const res = await api.get<{ schemes: CommissionScheme[] }>('/api/commissions/schemes', {
        params: tenantId ? { tenantId } : undefined,
      });
      const list = res.data.schemes ?? [];
      const active = list.find(s => s.is_active) ?? list[0] ?? null;
      setScheme(active);
    } catch (err: any) {
      setTopError(err?.response?.data?.error || 'Failed to load scheme.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchScheme(); }, [fetchScheme]);

  // ── Scheme form helpers ───────────────────────────────────────────────────
  function openSchemeForm(s: CommissionScheme | null) {
    if (s) {
      setSchemeName(s.name);
      setSchemeType(s.type);
      setSchemeTierApp(s.tier_application);
      setSchemeEffFrom(s.effective_from.split('T')[0]);
    } else {
      setSchemeName('');
      setSchemeType('tiered');
      setSchemeTierApp('flat');
      setSchemeEffFrom('');
    }
    setSchemeFormError('');
    setShowSchemeForm(true);
  }

  async function handleSchemeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSchemeFormError('');
    setSchemeFormLoading(true);
    try {
      const body = {
        name:             schemeName.trim(),
        type:             schemeType,
        tier_application: schemeTierApp,
        effective_from:   schemeEffFrom,
        ...(tenantId ? { tenantId } : {}),
      };
      if (scheme) {
        await api.put(`/api/commissions/schemes/${scheme.id}`, body);
      } else {
        await api.post('/api/commissions/schemes', body);
      }
      setShowSchemeForm(false);
      setLoading(true);
      await fetchScheme();
    } catch (err: any) {
      setSchemeFormError(err?.response?.data?.error || 'Failed to save scheme.');
    } finally {
      setSchemeFormLoading(false);
    }
  }

  // ── Tier helpers ──────────────────────────────────────────────────────────
  function openTierModal(t: CommissionTier | null) {
    setEditingTier(t);
    setTierOrder(t ? String(t.tier_order) : '');
    setTierMinRev(t ? String(t.min_revenue) : '0');
    setTierMaxRev(t?.max_revenue ?? '');
    setTierRate(t ? String(t.rate_percent) : '');
    setTierFlatBonus(t ? String(t.flat_bonus) : '0');
    setTierError('');
    setShowTierModal(true);
  }

  async function handleTierSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheme) return;
    setTierError('');

    if (Number(tierRate) < 0) {
      setTierError('Rate percent cannot be negative.');
      return;
    }
    const orderNum = Number(tierOrder);
    const takenOrders = (scheme.tiers ?? [])
      .filter(t => (editingTier ? t.id !== editingTier.id : true))
      .map(t => t.tier_order);
    if (takenOrders.includes(orderNum)) {
      setTierError(`Tier order ${orderNum} is already in use. Choose a different order number.`);
      return;
    }

    setTierLoading(true);
    try {
      const body: Record<string, unknown> = {
        tier_order:   orderNum,
        min_revenue:  Number(tierMinRev),
        max_revenue:  tierMaxRev === '' ? null : Number(tierMaxRev),
        rate_percent: Number(tierRate),
        flat_bonus:   Number(tierFlatBonus),
        ...(tenantId ? { tenantId } : {}),
      };
      if (editingTier) {
        await api.put(`/api/commissions/tiers/${editingTier.id}`, body);
      } else {
        await api.post(`/api/commissions/schemes/${scheme.id}/tiers`, body);
      }
      setShowTierModal(false);
      await fetchScheme();
    } catch (err: any) {
      setTierError(err?.response?.data?.error || 'Failed to save tier.');
    } finally {
      setTierLoading(false);
    }
  }

  async function handleDeleteTier(id: string) {
    setDeletingTierId(null);
    try {
      await api.delete(`/api/commissions/tiers/${id}`, {
        params: tenantId ? { tenantId } : undefined,
      });
      await fetchScheme();
    } catch (err: any) {
      setTopError(err?.response?.data?.error || 'Failed to delete tier.');
    }
  }

  // ── Threshold helpers ─────────────────────────────────────────────────────
  function openThreshModal(t: PerformanceThreshold | null) {
    setEditingThresh(t);
    setThreshPct(t ? String(t.target_percent) : '');
    setThreshMultiplier(t ? String(t.multiplier) : '1.00');
    setThreshLabel(t?.label ?? '');
    setThreshError('');
    setShowThreshModal(true);
  }

  async function handleThreshSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheme) return;
    setThreshError('');

    if (Number(threshPct) < 0) {
      setThreshError('Target percent cannot be negative.');
      return;
    }
    if (Number(threshMultiplier) < 0) {
      setThreshError('Multiplier cannot be negative.');
      return;
    }

    setThreshLoading(true);
    try {
      const body = {
        target_percent: Number(threshPct),
        multiplier:     Number(threshMultiplier),
        label:          threshLabel.trim() || null,
        ...(tenantId ? { tenantId } : {}),
      };
      if (editingThresh) {
        await api.put(`/api/commissions/thresholds/${editingThresh.id}`, body);
      } else {
        await api.post(`/api/commissions/schemes/${scheme.id}/thresholds`, body);
      }
      setShowThreshModal(false);
      await fetchScheme();
    } catch (err: any) {
      setThreshError(err?.response?.data?.error || 'Failed to save threshold.');
    } finally {
      setThreshLoading(false);
    }
  }

  async function handleDeleteThresh(id: string) {
    setDeletingThreshId(null);
    try {
      await api.delete(`/api/commissions/thresholds/${id}`, {
        params: tenantId ? { tenantId } : undefined,
      });
      await fetchScheme();
    } catch (err: any) {
      setTopError(err?.response?.data?.error || 'Failed to delete threshold.');
    }
  }

  // ── Team Bonus helpers ────────────────────────────────────────────────────
  function openTbModal(t: TeamBonusTier | null) {
    setEditingTb(t);
    setTbOrder(t ? String(t.tier_order) : '');
    setTbMinRev(t ? String(t.min_revenue) : '0');
    setTbMaxRev(t?.max_revenue ?? '');
    setTbBonusPerStaff(t ? String(t.bonus_per_staff) : '0');
    setTbError('');
    setShowTbModal(true);
  }

  async function handleTbSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheme) return;
    setTbError('');

    if (Number(tbBonusPerStaff) < 0) {
      setTbError('Bonus per staff cannot be negative.');
      return;
    }
    const orderNum = Number(tbOrder);
    const takenOrders = (scheme.team_bonus_tiers ?? [])
      .filter(t => (editingTb ? t.id !== editingTb.id : true))
      .map(t => t.tier_order);
    if (takenOrders.includes(orderNum)) {
      setTbError(`Tier order ${orderNum} is already in use. Choose a different order number.`);
      return;
    }

    setTbLoading(true);
    try {
      const body: Record<string, unknown> = {
        tier_order:      orderNum,
        min_revenue:     Number(tbMinRev),
        max_revenue:     tbMaxRev === '' ? null : Number(tbMaxRev),
        bonus_per_staff: Number(tbBonusPerStaff),
        ...(tenantId ? { tenantId } : {}),
      };
      if (editingTb) {
        await api.put(`/api/commissions/team-bonus-tiers/${editingTb.id}`, body);
      } else {
        await api.post(`/api/commissions/schemes/${scheme.id}/team-bonus-tiers`, body);
      }
      setShowTbModal(false);
      await fetchScheme();
    } catch (err: any) {
      setTbError(err?.response?.data?.error || 'Failed to save team bonus tier.');
    } finally {
      setTbLoading(false);
    }
  }

  async function handleDeleteTb(id: string) {
    setDeletingTbId(null);
    try {
      await api.delete(`/api/commissions/team-bonus-tiers/${id}`, {
        params: tenantId ? { tenantId } : undefined,
      });
      await fetchScheme();
    } catch (err: any) {
      setTopError(err?.response?.data?.error || 'Failed to delete team bonus tier.');
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-12">
        <div className="w-4 h-4 border border-gold/40 border-t-gold rounded-full animate-spin" />
        Loading scheme…
      </div>
    );
  }

  const tiers      = scheme?.tiers ?? [];
  const thresholds = scheme?.thresholds ?? [];
  const tbTiers    = scheme?.team_bonus_tiers ?? [];

  return (
    <div className="space-y-5">

      {/* ── Info note ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 bg-blue-900/20 border border-blue-700/30 rounded-xl px-4 py-3">
        <span className="text-blue-400 text-sm shrink-0 mt-0.5">ℹ</span>
        <p className="text-blue-300 text-sm">
          Changes to the scheme apply to{' '}
          <strong className="text-blue-200">future calculations</strong>.
          Already-locked periods are not affected.
        </p>
      </div>

      {/* ── Top-level error ───────────────────────────────────────────────── */}
      {topError && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          {topError}
        </div>
      )}

      {/* ── No scheme yet ─────────────────────────────────────────────────── */}
      {!scheme && !topError && (
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-12 flex flex-col items-center text-center gap-4">
          <span className="text-4xl">📋</span>
          <div>
            <p className="text-white font-semibold text-base mb-1">No commission scheme yet</p>
            <p className="text-gray-400 text-sm">
              Create a scheme to define how commissions are calculated for your clinic.
            </p>
          </div>
          <button
            onClick={() => openSchemeForm(null)}
            className="px-5 py-2 bg-gold text-white rounded-lg text-sm font-semibold hover:bg-gold/90 transition-colors"
          >
            + Create Scheme
          </button>
        </div>
      )}

      {/* ── Scheme header card ─────────────────────────────────────────────── */}
      {scheme && (
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h3 className="text-white font-semibold text-lg">{scheme.name}</h3>
                {scheme.is_active ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-900/60 text-green-300 uppercase tracking-wide">
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-700 text-gray-400 uppercase tracking-wide">
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-400">
                <span>
                  Type:{' '}
                  <span className="text-gray-200">
                    {SCHEME_TYPE_LABELS[scheme.type] ?? scheme.type}
                  </span>
                </span>
                <span>
                  Tiers:{' '}
                  <span className="text-gray-200">
                    {scheme.tier_application === 'marginal' ? 'Marginal' : 'Flat'}
                  </span>
                </span>
                <span>
                  Effective:{' '}
                  <span className="text-gray-200">{formatDate(scheme.effective_from)}</span>
                </span>
              </div>
            </div>
            <button
              onClick={() => openSchemeForm(scheme)}
              className="px-3 py-1.5 border border-navy-600 text-gold text-xs rounded-lg hover:border-gold/40 transition-colors shrink-0"
            >
              ✏ Edit
            </button>
          </div>
        </div>
      )}

      {/* ── Commission Tiers ──────────────────────────────────────────────── */}
      {scheme && (
        <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
          <SectionHeader
            title="Commission Tiers"
            addLabel="Add Tier"
            onAdd={() => openTierModal(null)}
          />
          {tiers.length === 0 ? (
            <p className="px-5 py-7 text-gray-500 text-sm text-center">
              No tiers defined. Add a tier to begin calculating commissions.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-700 bg-navy-900/40">
                    <th className="text-left px-4 py-2.5 text-gray-400 font-medium text-xs uppercase tracking-wide">Order</th>
                    <th className="text-right px-4 py-2.5 text-gray-400 font-medium text-xs uppercase tracking-wide">Min Revenue</th>
                    <th className="text-right px-4 py-2.5 text-gray-400 font-medium text-xs uppercase tracking-wide">Max Revenue</th>
                    <th className="text-right px-4 py-2.5 text-gray-400 font-medium text-xs uppercase tracking-wide">Rate %</th>
                    <th className="text-right px-4 py-2.5 text-gray-400 font-medium text-xs uppercase tracking-wide">Flat Bonus</th>
                    <th className="px-4 py-2.5 w-28"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700">
                  {[...tiers]
                    .sort((a, b) => a.tier_order - b.tier_order)
                    .map(t => (
                      <tr key={t.id} className="hover:bg-navy-700/30 transition-colors">
                        <td className="px-4 py-2.5 text-gray-300">{t.tier_order}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">{formatGBP(t.min_revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">
                          {t.max_revenue
                            ? formatGBP(t.max_revenue)
                            : <span className="text-gray-500 italic text-xs">open-ended</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-300">
                          {Number(t.rate_percent).toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-300">{formatGBP(t.flat_bonus)}</td>
                        <td className="px-4 py-2.5">
                          {deletingTierId === t.id ? (
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-red-400 text-xs">Delete?</span>
                              <button
                                onClick={() => handleDeleteTier(t.id)}
                                className="text-red-400 hover:text-red-300 text-xs font-semibold transition-colors"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeletingTierId(null)}
                                className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 justify-end">
                              <button
                                onClick={() => openTierModal(t)}
                                className="text-gold hover:text-gold/80 text-xs transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeletingTierId(t.id)}
                                className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Performance Thresholds ────────────────────────────────────────── */}
      {scheme && (
        <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
          <SectionHeader
            title="Performance Thresholds"
            addLabel="Add Threshold"
            onAdd={() => openThreshModal(null)}
          />
          {thresholds.length === 0 ? (
            <p className="px-5 py-7 text-gray-500 text-sm text-center">
              No thresholds defined. Thresholds multiply base commission when the clinic hits a target
              attainment level.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-700 bg-navy-900/40">
                    <th className="text-left px-4 py-2.5 text-gray-400 font-medium text-xs uppercase tracking-wide">Target %</th>
                    <th className="text-right px-4 py-2.5 text-gray-400 font-medium text-xs uppercase tracking-wide">Multiplier</th>
                    <th className="text-left px-4 py-2.5 text-gray-400 font-medium text-xs uppercase tracking-wide">Label</th>
                    <th className="px-4 py-2.5 w-28"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700">
                  {[...thresholds]
                    .sort((a, b) => Number(a.target_percent) - Number(b.target_percent))
                    .map(t => (
                      <tr key={t.id} className="hover:bg-navy-700/30 transition-colors">
                        <td className="px-4 py-2.5 text-gray-300">
                          {Number(t.target_percent).toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-300">
                          ×{Number(t.multiplier).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">
                          {t.label ?? <span className="italic text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {deletingThreshId === t.id ? (
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-red-400 text-xs">Delete?</span>
                              <button
                                onClick={() => handleDeleteThresh(t.id)}
                                className="text-red-400 hover:text-red-300 text-xs font-semibold transition-colors"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeletingThreshId(null)}
                                className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 justify-end">
                              <button
                                onClick={() => openThreshModal(t)}
                                className="text-gold hover:text-gold/80 text-xs transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeletingThreshId(t.id)}
                                className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Team Bonus Tiers ──────────────────────────────────────────────── */}
      {scheme && (
        <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
          <SectionHeader
            title="Team Bonus Tiers"
            addLabel="Add Team Bonus Tier"
            onAdd={() => openTbModal(null)}
          />
          {tbTiers.length === 0 ? (
            <p className="px-5 py-7 text-gray-500 text-sm text-center">
              No team bonus tiers defined. Team bonuses are paid per staff when clinic revenue reaches
              a threshold.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-700 bg-navy-900/40">
                    <th className="text-left px-4 py-2.5 text-gray-400 font-medium text-xs uppercase tracking-wide">Order</th>
                    <th className="text-right px-4 py-2.5 text-gray-400 font-medium text-xs uppercase tracking-wide">Min Clinic Revenue</th>
                    <th className="text-right px-4 py-2.5 text-gray-400 font-medium text-xs uppercase tracking-wide">Max Clinic Revenue</th>
                    <th className="text-right px-4 py-2.5 text-gray-400 font-medium text-xs uppercase tracking-wide">Bonus / Staff</th>
                    <th className="px-4 py-2.5 w-28"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700">
                  {[...tbTiers]
                    .sort((a, b) => a.tier_order - b.tier_order)
                    .map(t => (
                      <tr key={t.id} className="hover:bg-navy-700/30 transition-colors">
                        <td className="px-4 py-2.5 text-gray-300">{t.tier_order}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">{formatGBP(t.min_revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">
                          {t.max_revenue
                            ? formatGBP(t.max_revenue)
                            : <span className="text-gray-500 italic text-xs">open-ended</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gold font-medium">
                          {formatGBP(t.bonus_per_staff)}
                        </td>
                        <td className="px-4 py-2.5">
                          {deletingTbId === t.id ? (
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-red-400 text-xs">Delete?</span>
                              <button
                                onClick={() => handleDeleteTb(t.id)}
                                className="text-red-400 hover:text-red-300 text-xs font-semibold transition-colors"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeletingTbId(null)}
                                className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 justify-end">
                              <button
                                onClick={() => openTbModal(t)}
                                className="text-gold hover:text-gold/80 text-xs transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeletingTbId(t.id)}
                                className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Scheme Form Modal (Create / Edit)
      ════════════════════════════════════════════════════════════════════ */}
      {showSchemeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">
                {scheme ? 'Edit Scheme' : 'Create Scheme'}
              </h2>
              <button
                onClick={() => setShowSchemeForm(false)}
                className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSchemeSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">
                  Scheme Name <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Standard Commission 2026"
                  value={schemeName}
                  onChange={e => setSchemeName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">
                  Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={schemeType}
                  onChange={e => setSchemeType(e.target.value as CommissionScheme['type'])}
                  className={selectCls}
                >
                  <option value="flat_rate">Flat Rate</option>
                  <option value="tiered">Tiered</option>
                  <option value="target_based">Target Based</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">
                  Tier Application
                </label>
                <select
                  value={schemeTierApp}
                  onChange={e => setSchemeTierApp(e.target.value as CommissionScheme['tier_application'])}
                  className={selectCls}
                >
                  <option value="flat">Flat — all revenue at the highest reached tier</option>
                  <option value="marginal">Marginal — each band taxed at its own rate</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">
                  Effective From <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  type="date"
                  value={schemeEffFrom}
                  onChange={e => setSchemeEffFrom(e.target.value)}
                  className={inputCls}
                />
              </div>
              {schemeFormError && (
                <p className="text-red-400 text-sm">{schemeFormError}</p>
              )}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSchemeForm(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schemeFormLoading}
                  className="px-5 py-2 bg-gold text-white rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {schemeFormLoading ? 'Saving…' : (scheme ? 'Save Changes' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Tier Modal (Add / Edit)
      ════════════════════════════════════════════════════════════════════ */}
      {showTierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">
                {editingTier ? 'Edit Tier' : 'Add Tier'}
              </h2>
              <button
                onClick={() => setShowTierModal(false)}
                className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleTierSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">
                    Tier Order <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1"
                    value={tierOrder}
                    onChange={e => setTierOrder(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">
                    Rate % <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="10.00"
                    value={tierRate}
                    onChange={e => setTierRate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">
                    Min Revenue (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={tierMinRev}
                    onChange={e => setTierMinRev(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">
                    Max Revenue (€){' '}
                    <span className="text-gray-600 text-[10px]">blank = open</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="open-ended"
                    value={tierMaxRev}
                    onChange={e => setTierMaxRev(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">
                  Flat Bonus (€)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={tierFlatBonus}
                  onChange={e => setTierFlatBonus(e.target.value)}
                  className={inputCls}
                />
                <p className="text-gray-600 text-xs mt-1">
                  Fixed bonus paid when this tier is reached (in addition to rate).
                </p>
              </div>
              {tierError && <p className="text-red-400 text-sm">{tierError}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowTierModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tierLoading}
                  className="px-5 py-2 bg-gold text-white rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {tierLoading ? 'Saving…' : (editingTier ? 'Save Changes' : 'Add Tier')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Threshold Modal (Add / Edit)
      ════════════════════════════════════════════════════════════════════ */}
      {showThreshModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">
                {editingThresh ? 'Edit Threshold' : 'Add Threshold'}
              </h2>
              <button
                onClick={() => setShowThreshModal(false)}
                className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleThreshSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">
                    Target % <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="80.0"
                    value={threshPct}
                    onChange={e => setThreshPct(e.target.value)}
                    className={inputCls}
                  />
                  <p className="text-gray-600 text-[10px] mt-1">Clinic attainment threshold</p>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">
                    Multiplier <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="1.00"
                    value={threshMultiplier}
                    onChange={e => setThreshMultiplier(e.target.value)}
                    className={inputCls}
                  />
                  <p className="text-gray-600 text-[10px] mt-1">Applied to base commission</p>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-xs font-medium mb-1.5">
                  Label{' '}
                  <span className="text-gray-600 text-[10px]">optional</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. High Performer"
                  value={threshLabel}
                  onChange={e => setThreshLabel(e.target.value)}
                  className={inputCls}
                />
              </div>
              {threshError && <p className="text-red-400 text-sm">{threshError}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowThreshModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={threshLoading}
                  className="px-5 py-2 bg-gold text-white rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {threshLoading ? 'Saving…' : (editingThresh ? 'Save Changes' : 'Add Threshold')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Team Bonus Modal (Add / Edit)
      ════════════════════════════════════════════════════════════════════ */}
      {showTbModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold text-lg">
                {editingTb ? 'Edit Team Bonus Tier' : 'Add Team Bonus Tier'}
              </h2>
              <button
                onClick={() => setShowTbModal(false)}
                className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleTbSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">
                    Tier Order <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1"
                    value={tbOrder}
                    onChange={e => setTbOrder(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">
                    Bonus / Staff (€) <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={tbBonusPerStaff}
                    onChange={e => setTbBonusPerStaff(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">
                    Min Clinic Revenue (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={tbMinRev}
                    onChange={e => setTbMinRev(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs font-medium mb-1.5">
                    Max Clinic Revenue (€){' '}
                    <span className="text-gray-600 text-[10px]">blank = open</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="open-ended"
                    value={tbMaxRev}
                    onChange={e => setTbMaxRev(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              {tbError && <p className="text-red-400 text-sm">{tbError}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowTbModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tbLoading}
                  className="px-5 py-2 bg-gold text-white rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {tbLoading ? 'Saving…' : (editingTb ? 'Save Changes' : 'Add Tier')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

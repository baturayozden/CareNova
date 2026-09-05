import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import NewCaseModal from '../components/NewCaseModal';
import { Building2, CreditCard, Download, Search, X } from 'lucide-react';
import { formatDate } from '../utils/date';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TreatmentCase {
  id: string;
  tenant_id: string;
  patient_name: string | null;
  treatment_description: string | null;
  total_cost: string | null;
  amount_due: string | null;
  payment_method: string | null;
  payer_type: string | null;
  status: string;
  created_at: string;
}

const METHOD_LABELS: Record<string, string> = {
  finance:       'Finance',
  bank_transfer: 'Bank Transfer',
  card:          'Card',
  pay_by_bank:   'Pay by Bank',
  cash:          'Cash',
};

const STATUS_CONFIG: Record<string, { bg: string; label: string }> = {
  draft:              { bg: '#475569', label: 'Draft'              },
  awaiting_signature: { bg: '#92400e', label: 'Awaiting Signature' },
  signed:             { bg: '#1e40af', label: 'Signed'             },
  payment_sent:       { bg: '#3730a3', label: 'Payment Sent'       },
  paid:               { bg: '#14532d', label: 'Paid'               },
  finance_referred:   { bg: '#581c87', label: 'Finance Referred'   },
  reversed:           { bg: '#991b1b', label: 'Reversed'           },
  cancelled:          { bg: '#4b5563', label: 'Cancelled'          },
  declined:           { bg: '#991b1b', label: 'Declined'           },
  expired:            { bg: '#78716c', label: 'Expired'            },
  bounced:            { bg: '#9a3412', label: 'Email Bounced'      },
};

const DATE_RANGE_OPTIONS = [
  { value: '',       label: 'All time'      },
  { value: 'today',  label: 'Today'         },
  { value: '7d',     label: 'Last 7 days'   },
  { value: '30d',    label: 'Last 30 days'  },
  { value: 'month',  label: 'This month'    },
  { value: 'custom', label: 'Custom range…' },
];

// Unified control class — all filter inputs and selects share this
const ctrl = [
  'h-10 bg-surface-sunken border border-line text-white rounded-lg px-3 text-sm',
  'focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors',
].join(' ');

const lbl = 'block text-xs text-gray-400 font-medium leading-5';

// ── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { bg: '#475569', label: status || 'Unknown' };
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: '#ffffff' }}
    >
      {cfg.label}
    </span>
  );
}

// ── Export helpers (module-level, no React deps) ─────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type ExportRow = Record<string, string>;

function buildRows(cases: TreatmentCase[]): ExportRow[] {
  return cases.map(c => {
    const raw = c.amount_due ?? c.total_cost;
    return {
      Patient:       c.patient_name || '',
      Treatment:     c.treatment_description || '',
      'Amount (€)':  raw != null ? `€${Number(raw).toFixed(2)}` : '',
      Method:        METHOD_LABELS[c.payment_method ?? ''] ?? (c.payment_method || ''),
      Payer:         c.payer_type === 'third_party' ? 'Third Party' : 'Self',
      Status:        STATUS_CONFIG[c.status]?.label ?? c.status,
      Created:       formatDate(c.created_at),
    };
  });
}

function doCSV(cases: TreatmentCase[]) {
  const rows = buildRows(cases);
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [
    headers.map(esc).join(','),
    ...rows.map(r => headers.map(h => esc(r[h])).join(',')),
  ].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payments_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function doExcel(cases: TreatmentCase[]) {
  const rows = buildRows(cases);
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]).map(h => ({ wch: Math.max(h.length + 4, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Payments');
  XLSX.writeFile(wb, `payments_${todayStr()}.xlsx`);
}

function doPDF(cases: TreatmentCase[], filterSummary: string, clinicName: string) {
  const rows = buildRows(cases);
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const body = rows.map(r => headers.map(h => r[h]));
  const doc = new jsPDF({ orientation: 'landscape' });
  let y = 14;
  doc.setFontSize(14);
  doc.setTextColor(7, 32, 59);
  doc.text('Payment Report', 14, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  if (clinicName) { doc.text(clinicName, 14, y); y += 5; }
  doc.text(
    new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
    14, y,
  );
  y += 5;
  if (filterSummary) { doc.text(`Filters: ${filterSummary}`, 14, y); y += 5; }
  doc.text(`${cases.length} case${cases.length === 1 ? '' : 's'}`, 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [headers],
    body,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [7, 32, 59], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  doc.save(`payments_${todayStr()}.pdf`);
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const isPlatformAdmin = user?.role ? ['super_admin', 'admin'].includes(user.role) : false;

  const [cases,        setCases]        = useState<TreatmentCase[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [showModal,    setShowModal]    = useState(false);

  const [clinics,          setClinics]          = useState<{ id: string; name: string; financeEnabled?: boolean }[]>([]);
  const [clinicsLoading,   setClinicsLoading]   = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  // ── Filter state ────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [minAmount,    setMinAmount]    = useState('');
  const [maxAmount,    setMaxAmount]    = useState('');
  const [dateRange,    setDateRange]    = useState('');
  const [customFrom,   setCustomFrom]   = useState('');
  const [customTo,     setCustomTo]     = useState('');

  // ── Export dropdown state ───────────────────────────────────────────────────
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    function handleOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showExportMenu]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const hasFilters = !!(search || statusFilter || methodFilter || minAmount || maxAmount || dateRange);

  const clinicLabel = useMemo(
    () => clinics.find(c => c.id === selectedClinicId)?.name ?? '',
    [clinics, selectedClinicId],
  );

  const filterSummary = useMemo(() => {
    return [
      statusFilter && `Status: ${STATUS_CONFIG[statusFilter]?.label ?? statusFilter}`,
      methodFilter && `Method: ${METHOD_LABELS[methodFilter] ?? methodFilter}`,
      minAmount    && `Min: €${minAmount}`,
      maxAmount    && `Max: €${maxAmount}`,
      dateRange && dateRange !== 'custom'
        ? `Period: ${DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label ?? dateRange}`
        : null,
      dateRange === 'custom' && customFrom && `From: ${customFrom}`,
      dateRange === 'custom' && customTo   && `To: ${customTo}`,
    ].filter(Boolean).join(', ');
  }, [statusFilter, methodFilter, minAmount, maxAmount, dateRange, customFrom, customTo]);

  function clearFilters() {
    setSearch('');
    setStatusFilter(''); setMethodFilter('');
    setMinAmount('');    setMaxAmount('');
    setDateRange('');    setCustomFrom(''); setCustomTo('');
  }

  // ── Filtered cases ──────────────────────────────────────────────────────────
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (search) {
        const q = search.toLowerCase();
        if (!(c.patient_name || '').toLowerCase().includes(q)) return false;
      }
      if (statusFilter && c.status !== statusFilter) return false;
      if (methodFilter && c.payment_method !== methodFilter) return false;

      const minVal = minAmount !== '' ? parseFloat(minAmount) : null;
      const maxVal = maxAmount !== '' ? parseFloat(maxAmount) : null;
      if (minVal !== null || maxVal !== null) {
        const raw = c.amount_due ?? c.total_cost;
        const amt = raw != null ? parseFloat(raw) : NaN;
        if (isNaN(amt)) return false;
        if (minVal !== null && amt < minVal) return false;
        if (maxVal !== null && amt > maxVal) return false;
      }

      if (dateRange) {
        const created = new Date(c.created_at);
        const now     = new Date();
        if (dateRange === 'today') {
          if (created < new Date(now.getFullYear(), now.getMonth(), now.getDate())) return false;
        } else if (dateRange === '7d') {
          if (created < new Date(now.getTime() - 7 * 864e5)) return false;
        } else if (dateRange === '30d') {
          if (created < new Date(now.getTime() - 30 * 864e5)) return false;
        } else if (dateRange === 'month') {
          if (created < new Date(now.getFullYear(), now.getMonth(), 1)) return false;
        } else if (dateRange === 'custom') {
          if (customFrom && created < new Date(customFrom + 'T00:00:00')) return false;
          if (customTo   && created > new Date(customTo   + 'T23:59:59')) return false;
        }
      }

      return true;
    });
  }, [cases, search, statusFilter, methodFilter, minAmount, maxAmount, dateRange, customFrom, customTo]);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const effectiveTenantId: string | undefined =
    isPlatformAdmin ? (selectedClinicId ?? undefined) : undefined;

  const financeEnabled = isPlatformAdmin
    ? (clinics.find(c => c.id === effectiveTenantId)?.financeEnabled ?? true)
    : (user?.financeEnabled ?? true);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    setClinicsLoading(true);
    api.get<{ clinics: { id: string; name: string; financeEnabled?: boolean }[] }>('/api/clinics')
      .then(res => setClinics(res.data.clinics))
      .catch(() => {})
      .finally(() => setClinicsLoading(false));
  }, [isPlatformAdmin]);

  const fetchCases = useCallback(async () => {
    if (isPlatformAdmin && !effectiveTenantId) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const res = await api.get<{ cases: TreatmentCase[] }>('/api/cases', {
        params: effectiveTenantId ? { tenantId: effectiveTenantId } : undefined,
      });
      setCases(res.data.cases);
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to load payment cases.');
    } finally {
      setLoading(false);
    }
  }, [isPlatformAdmin, effectiveTenantId]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  function formatAmount(val: string | null | undefined): string {
    if (val == null) return '—';
    return `€${Number(val).toFixed(2)}`;
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif font-bold text-white">Payments</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage treatment payment cases</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors"
        >
          <CreditCard size={15} />
          + New Payment Case
        </button>
      </div>

      {/* Clinic selector — platform admin only */}
      {isPlatformAdmin && (
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm font-medium shrink-0">Clinic:</span>
          {clinicsLoading ? (
            <span className="text-gray-500 text-sm">Loading clinics…</span>
          ) : (
            <select
              value={selectedClinicId ?? ''}
              onChange={e => setSelectedClinicId(e.target.value || null)}
              className={`${ctrl} min-w-[240px]`}
            >
              <option value="">— Select a clinic —</option>
              {clinics.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Platform admin — no clinic selected */}
      {isPlatformAdmin && !selectedClinicId ? (
        <div className="bg-surface-sunken border border-line rounded-xl p-12 flex flex-col items-center text-center">
          <Building2 size={48} className="mx-auto mb-4 text-gray-400" />
          <p className="text-white font-semibold text-base mb-1">Select a clinic to view payment cases</p>
          <p className="text-gray-400 text-sm">Choose a clinic from the dropdown above to get started.</p>
        </div>
      ) : loading ? (
        <div className="bg-surface-sunken border border-line rounded-xl p-8 text-center text-gray-400 text-sm">
          Loading cases…
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      ) : (
        <>
          {/* ── Filter bar ─────────────────────────────────────────────────── */}
          <div className="bg-surface-sunken border border-line rounded-xl px-4 py-3 space-y-3">
            <div className="flex flex-wrap gap-3 items-end">

              {/* Search */}
              <div className="flex flex-col gap-1">
                <label className={lbl}>Search</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by patient name…"
                    className="bg-surface-sunken border border-line rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent h-10 min-w-[260px]"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1">
                <label className={lbl}>Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className={ctrl}
                >
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                    <option key={val} value={val}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              {/* Method */}
              <div className="flex flex-col gap-1">
                <label className={lbl}>Method</label>
                <select
                  value={methodFilter}
                  onChange={e => setMethodFilter(e.target.value)}
                  className={ctrl}
                >
                  <option value="">All methods</option>
                  {Object.entries(METHOD_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="flex flex-col gap-1">
                <label className={lbl}>Amount (€)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} placeholder="Min"
                    value={minAmount}
                    onChange={e => setMinAmount(e.target.value)}
                    className={`${ctrl} w-24 placeholder-gray-500`}
                  />
                  <span className="text-gray-500 text-sm leading-10">–</span>
                  <input
                    type="number" min={0} placeholder="Max"
                    value={maxAmount}
                    onChange={e => setMaxAmount(e.target.value)}
                    className={`${ctrl} w-24 placeholder-gray-500`}
                  />
                </div>
              </div>

              {/* Period */}
              <div className="flex flex-col gap-1">
                <label className={lbl}>Period</label>
                <select
                  value={dateRange}
                  onChange={e => setDateRange(e.target.value)}
                  className={ctrl}
                >
                  {DATE_RANGE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Custom date range — visible only when period = custom */}
              {dateRange === 'custom' && (
                <div className="flex flex-col gap-1">
                  <label className={lbl}>From / To</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date" value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      className={`${ctrl} w-36`}
                    />
                    <span className="text-gray-500 text-sm leading-10">–</span>
                    <input
                      type="date" value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      className={`${ctrl} w-36`}
                    />
                  </div>
                </div>
              )}

              {/* Clear — shown only when any filter is active */}
              {hasFilters && (
                <div className="flex flex-col gap-1">
                  <div className="h-5" aria-hidden="true" />
                  <button
                    onClick={clearFilters}
                    className="h-10 flex items-center gap-1.5 px-3 text-sm text-gray-400 hover:text-white border border-line hover:border-gray-500 rounded-lg transition-colors"
                  >
                    <X size={14} />
                    Clear
                  </button>
                </div>
              )}

              {/* Export dropdown */}
              <div className="flex flex-col gap-1">
                <div className="h-5" aria-hidden="true" />
                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={() => setShowExportMenu(v => !v)}
                    disabled={filteredCases.length === 0}
                    className="h-10 flex items-center gap-2 px-4 text-sm font-medium bg-surface-sunken border border-line text-gray-300 hover:text-white hover:bg-line rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download size={14} />
                    Export
                    <span className="text-gray-500 text-xs">▾</span>
                  </button>
                  {showExportMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-surface-sunken border border-line rounded-lg shadow-xl overflow-hidden z-20 min-w-[160px]">
                      {([
                        { label: 'CSV (.csv)',    fn: () => doCSV(filteredCases) },
                        { label: 'Excel (.xlsx)', fn: () => doExcel(filteredCases) },
                        { label: 'PDF (.pdf)',    fn: () => doPDF(filteredCases, filterSummary, clinicLabel) },
                      ] as const).map(({ label, fn }) => (
                        <button
                          key={label}
                          onClick={() => { fn(); setShowExportMenu(false); }}
                          className="w-full px-4 py-2.5 text-sm text-left text-gray-300 hover:text-white hover:bg-surface-sunken transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Result count — shown when any filter active */}
            {hasFilters && (
              <p className="text-xs text-gray-400">
                Showing{' '}
                <span className="text-white font-semibold">{filteredCases.length}</span>
                {' '}of{' '}
                <span className="text-white font-semibold">{cases.length}</span>
                {' '}cases
              </p>
            )}
          </div>

          {/* ── Table ──────────────────────────────────────────────────────── */}
          {filteredCases.length === 0 ? (
            <div className="bg-surface-sunken border border-line rounded-xl p-12 flex flex-col items-center text-center">
              <CreditCard size={40} className="mx-auto mb-4 text-gray-500" />
              {cases.length === 0 ? (
                <>
                  <p className="text-white font-semibold mb-1">No payment cases yet</p>
                  <p className="text-gray-400 text-sm mb-5">Create your first payment case to get started.</p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors"
                  >
                    + New Payment Case
                  </button>
                </>
              ) : (
                <>
                  <p className="text-white font-semibold mb-1">No cases match your filters</p>
                  <p className="text-gray-400 text-sm mb-4">Try adjusting or clearing the filters above.</p>
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-300 hover:text-white border border-line hover:border-gray-500 rounded-lg transition-colors"
                  >
                    <X size={14} />
                    Clear filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-sunken bg-surface/40">
                      <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Patient</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Treatment</th>
                      <th className="text-right px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Amount</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Method</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Payer</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium text-xs uppercase tracking-wide">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-sunken">
                    {filteredCases.map(c => (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/payments/${c.id}`)}
                        className="hover:bg-surface-sunken/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-white font-medium">
                          {c.patient_name || <span className="text-gray-500 italic">Unknown</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate">
                          {c.treatment_description || <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-accent font-semibold">
                          {formatAmount(c.amount_due ?? c.total_cost)}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {METHOD_LABELS[c.payment_method ?? ''] ?? (c.payment_method || '—')}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {c.payer_type === 'third_party' ? 'Third Party' : 'Self'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {formatDate(c.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <NewCaseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(newCase) => {
          setShowModal(false);
          navigate(`/payments/${newCase.id}`);
        }}
        effectiveTenantId={effectiveTenantId}
        financeEnabled={financeEnabled}
        currentUserRole={user?.role}
      />
    </div>
  );
}

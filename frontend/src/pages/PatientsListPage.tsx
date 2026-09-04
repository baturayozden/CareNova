import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Search, UserSquare2, ChevronRight, User, ArrowUp, ArrowDown } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  status: string;
  language: string;
  treatmentInterest: string | null;
  assignedTo: string | null;
  staffName: string | null;
  dealCount: number;
  totalAgreed: number;
  contractSigned: boolean;
  paymentArranged: boolean;
  treatmentDateSet: boolean;
  createdAt: string;
}

interface PatientsResponse {
  patients: Patient[];
  total: number;
  page: number;
  totalPages: number;
}

interface StaffUser { id: string; name: string; }

type SortKey    = 'created_desc' | 'created_asc' | 'name_asc' | 'assigned_asc';
type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  new:       'bg-blue-900 text-blue-300',
  contacted: 'bg-yellow-900 text-yellow-300',
  responded: 'bg-purple-900 text-purple-300',
  qualified: 'bg-cyan-900 text-cyan-300',
  booked:    'bg-green-900 text-green-300',
  attended:  'bg-emerald-900 text-emerald-300',
  lost:      'bg-red-900 text-red-300',
  archived:  'bg-gray-800 text-gray-400',
};

const selectCls = 'bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50 cursor-pointer';
const inputCls  = 'bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold/50';

const COLS = 'grid-cols-[1fr_140px_72px_90px_60px_80px_88px_24px]';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(n: number): string {
  if (!n) return '—';
  return `€${n.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetDates(preset: DatePreset): { dateFrom: string; dateTo: string } {
  const today = new Date();
  if (preset === 'today') {
    const s = toYMD(today);
    return { dateFrom: s, dateTo: s };
  }
  if (preset === 'week') {
    const diff = (today.getDay() + 6) % 7; // days since Monday
    const mon  = new Date(today);
    mon.setDate(today.getDate() - diff);
    return { dateFrom: toYMD(mon), dateTo: toYMD(today) };
  }
  if (preset === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { dateFrom: toYMD(first), dateTo: toYMD(today) };
  }
  return { dateFrom: '', dateTo: '' };
}

// ── Journey progress dots ─────────────────────────────────────────────────────

function JourneyBadge({ p }: { p: Patient }) {
  const steps = [p.contractSigned, p.paymentArranged, p.treatmentDateSet];
  const done  = steps.filter(Boolean).length;
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className="flex gap-1">
        {steps.map((checked, i) => (
          <div key={i} className={`w-2 h-2 rounded-full ${checked ? 'bg-green-400' : 'bg-navy-600'}`} />
        ))}
      </div>
      <span className="text-[10px] text-gray-500">{done}/3</span>
    </div>
  );
}

// ── Sortable column header ────────────────────────────────────────────────────

function SortTh({ label, colSort, sort, onSort, className }: {
  label: string; colSort: SortKey; sort: SortKey; onSort: (v: SortKey) => void; className?: string;
}) {
  const isCreated = colSort === 'created_desc';
  const isActive  = isCreated
    ? (sort === 'created_desc' || sort === 'created_asc')
    : sort === colSort;

  function handleClick() {
    if (isCreated) {
      onSort(sort === 'created_desc' ? 'created_asc' : 'created_desc');
    } else {
      onSort(colSort);
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-0.5 uppercase tracking-widest text-[10px] font-semibold transition-colors ${
        isActive ? 'text-gold' : 'text-gray-600 hover:text-gray-400'
      } ${className ?? ''}`}
    >
      {label}
      {isActive && isCreated && (sort === 'created_asc' ? <ArrowUp size={9} /> : <ArrowDown size={9} />)}
      {isActive && !isCreated && <ArrowUp size={9} />}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PatientsListPage() {
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const [patients,   setPatients]   = useState<Patient[]>([]);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [sort,       setSort]       = useState<SortKey>('created_desc');
  const [assignedTo, setAssignedTo] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [staffList,  setStaffList]  = useState<StaffUser[]>([]);

  // Fetch staff list for "Assigned to" filter
  const tenantId = user?.tenantId;
  useEffect(() => {
    if (!tenantId) return;
    api.get<{ salesUsers: { id: string; firstName: string; lastName: string; email: string }[] }>(
      `/api/clinics/${tenantId}/sales-users`,
      { headers: { 'Cache-Control': 'no-store' } },
    ).then(r => {
        const raw = r.data.salesUsers ?? [];
        console.log('[sales-users] raw:', raw);
        const list: StaffUser[] = raw.map(u => ({
          id:   u.id,
          name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || 'Unknown',
        })).filter(u => u.id);
        console.log('[sales-users] → options:', list);
        setStaffList(list);
      })
      .catch(() => {});
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPatients = useCallback((
    p: number, q: string, s: SortKey, assigned: string, from: string, to: string,
  ) => {
    setLoading(true);
    api.get<PatientsResponse>('/api/patients', {
      params: {
        page: p, limit: 20,
        q:          q        || undefined,
        sort:       s,
        assignedTo: assigned || undefined,
        dateFrom:   from     || undefined,
        dateTo:     to       || undefined,
      },
    })
      .then(r => {
        setPatients(r.data.patients);
        setTotal(r.data.total);
        setTotalPages(r.data.totalPages);
      })
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPatients(page, search, sort, assignedTo, dateFrom, dateTo);
  }, [fetchPatients, page, search, sort, assignedTo, dateFrom, dateTo]);

  function handleSearch(v: string)   { setSearch(v);     setPage(1); }
  function handleSort(v: SortKey)    { setSort(v);       setPage(1); }
  function handleAssigned(v: string) { setAssignedTo(v); setPage(1); }

  function handleDatePreset(v: DatePreset) {
    setDatePreset(v);
    setPage(1);
    if (v !== 'custom') {
      const { dateFrom: f, dateTo: t } = presetDates(v);
      setDateFrom(f);
      setDateTo(t);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-bold text-2xl">Patients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} total</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-gold/50"
            placeholder="Search by name, phone or email…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>

        <CustomSelect
          className={selectCls}
          placeholder="All staff"
          value={assignedTo}
          onChange={handleAssigned}
          options={[
            { id: '', label: 'All staff' },
            ...staffList.map(s => ({ id: s.id, label: s.name })),
          ]}
        />

        <select value={datePreset} onChange={e => handleDatePreset(e.target.value as DatePreset)} className={selectCls}>
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="custom">Custom</option>
        </select>

        {datePreset === 'custom' && (
          <>
            <input
              type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className={inputCls}
            />
            <input
              type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className={inputCls}
            />
          </>
        )}

        <select value={sort} onChange={e => handleSort(e.target.value as SortKey)} className={selectCls}>
          <option value="created_desc">Newest</option>
          <option value="created_asc">Oldest</option>
          <option value="name_asc">Name</option>
          <option value="assigned_asc">Assigned</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-500 text-sm py-8 text-center">Loading…</div>
      ) : patients.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <UserSquare2 size={32} className="text-gray-700" />
          <p className="text-gray-500 text-sm">No patients match filters</p>
        </div>
      ) : (
        <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className={`hidden md:grid ${COLS} gap-3 px-5 py-2.5 border-b border-navy-700`}>
            <SortTh label="Patient"     colSort="name_asc"     sort={sort} onSort={handleSort} />
            <SortTh label="Assigned to" colSort="assigned_asc" sort={sort} onSort={handleSort} />
            <span className="uppercase tracking-widest text-[10px] font-semibold text-gray-600 text-right">Deals</span>
            <span className="uppercase tracking-widest text-[10px] font-semibold text-gray-600 text-right">Total €</span>
            <span className="uppercase tracking-widest text-[10px] font-semibold text-gray-600 text-center">Journey</span>
            <span className="uppercase tracking-widest text-[10px] font-semibold text-gray-600">Status</span>
            <SortTh label="Added" colSort="created_desc" sort={sort} onSort={handleSort} />
            <span />
          </div>

          {patients.map((p, i) => {
            const name     = `${p.firstName} ${p.lastName}`.trim() || p.phone;
            const initials = ((p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')).toUpperCase() || '?';
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/patients/${p.id}`)}
                className={`w-full text-left hover:bg-navy-700 transition-colors ${i > 0 ? 'border-t border-navy-700' : ''}`}
              >
                {/* Mobile */}
                <div className="flex items-center gap-3 px-5 py-4 md:hidden">
                  <div className="w-9 h-9 rounded-full bg-navy-700 flex items-center justify-center text-sm font-semibold text-gray-300 shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{p.phone}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <JourneyBadge p={p} />
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[p.status] ?? 'bg-gray-800 text-gray-400'}`}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                    <ChevronRight size={14} className="text-gray-600" />
                  </div>
                </div>

                {/* Desktop */}
                <div className={`hidden md:grid ${COLS} gap-3 items-center px-5 py-3.5`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-xs font-semibold text-gray-300 shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{name}</p>
                      <p className="text-gray-500 text-xs truncate">{p.phone}</p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    {p.staffName ? (
                      <div className="flex items-center gap-1.5">
                        <User size={11} className="text-gray-600 shrink-0" />
                        <span className="text-gray-300 text-xs truncate">{p.staffName}</span>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-gray-300 text-sm font-medium">{p.dealCount || '—'}</span>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-medium ${p.totalAgreed > 0 ? 'text-gold' : 'text-gray-600'}`}>
                      {fmtGBP(p.totalAgreed)}
                    </span>
                  </div>

                  <div className="flex justify-center">
                    <JourneyBadge p={p} />
                  </div>

                  <div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[p.status] ?? 'bg-gray-800 text-gray-400'}`}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 text-xs">{fmtDate(p.createdAt)}</span>
                  </div>

                  <ChevronRight size={14} className="text-gray-600" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-navy-600 rounded-lg disabled:opacity-30 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-gray-500 text-sm">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-navy-600 rounded-lg disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

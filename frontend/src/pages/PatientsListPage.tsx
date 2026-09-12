import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Search, UserSquare2, ChevronRight, User, ArrowUp, ArrowDown } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import AppMeta from '../components/AppMeta';
import StatusBadge from '../components/StatusBadge';
import { CaseStatus, CASE_STATUS_LABELS } from '../data/caseData';
import { STATUS_TONE, BRANCH_LABELS } from '../lib/caseDisplay';
import DemoName, { useDemoNameText } from '../components/DemoName';

// ── Types ─────────────────────────────────────────────────────────────────────
//
// APP-ADMIN-EKSIKLER-KOMUTU.md Görev 6.3 — this used to be its own
// lead-shaped record (firstName/lastName/phone/dealCount/contractSigned/
// paymentArranged/treatmentDateSet — CareDental's 3-step dental journey),
// fed from a separate, smaller demo dataset than /cases. Now it's a case
// row — same data /cases shows, same 15-stage status, same id space — so
// a row here deep-links straight into /cases/:id.

interface Patient {
  id: string;
  caseNumber: string;
  patientName: string;
  patientCountryFlag: string;
  branch: string;
  status: CaseStatus;
  assignedTo: string | null;
  staffName: string | null;
  totalAgreed: number;
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

const selectCls = 'bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50 cursor-pointer';
const inputCls  = 'bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50';

const COLS = 'grid-cols-[1fr_140px_120px_100px_100px_140px_88px_24px]';

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
        isActive ? 'text-accent' : 'text-gray-600 hover:text-gray-400'
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
  const { t }      = useTranslation('patients');
  const demoNameText = useDemoNameText();

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
        const list: StaffUser[] = raw.map(u => ({
          id:   u.id,
          name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || 'Unknown',
        })).filter(u => u.id);
        setStaffList(list);
      })
      .catch(() => {});
  }, [tenantId]);

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
        setPatients(r.data.patients ?? []);
        setTotal(r.data.total ?? 0);
        setTotalPages(r.data.totalPages ?? 1);
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
      const { dateFrom: f, dateTo: tt } = presetDates(v);
      setDateFrom(f);
      setDateTo(tt);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 p-4 md:p-8">
      <AppMeta title={`${t('title')} | CareNova`} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-bold text-2xl">{t('title')}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{t('subtitle', { count: total })}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            className="w-full bg-surface-sunken border border-line rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-accent/50"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>

        <CustomSelect
          className={selectCls}
          placeholder={t('filters.allStaff')}
          value={assignedTo}
          onChange={handleAssigned}
          options={[
            { id: '', label: t('filters.allStaff') },
            ...staffList.map(s => ({ id: s.id, label: demoNameText(s.name) })),
          ]}
        />

        <select value={datePreset} onChange={e => handleDatePreset(e.target.value as DatePreset)} className={selectCls}>
          <option value="all">{t('filters.allTime')}</option>
          <option value="today">{t('filters.today')}</option>
          <option value="week">{t('filters.thisWeek')}</option>
          <option value="month">{t('filters.thisMonth')}</option>
          <option value="custom">{t('filters.custom')}</option>
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
          <option value="created_desc">{t('sort.newest')}</option>
          <option value="created_asc">{t('sort.oldest')}</option>
          <option value="name_asc">{t('sort.name')}</option>
          <option value="assigned_asc">{t('sort.assigned')}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-500 text-sm py-8 text-center">{t('loading')}</div>
      ) : patients.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <UserSquare2 size={32} className="text-gray-700" />
          <p className="text-gray-500 text-sm">{t('empty')}</p>
        </div>
      ) : (
        <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className={`hidden md:grid ${COLS} gap-3 px-5 py-2.5 border-b border-surface-sunken`}>
            <SortTh label={t('columns.patient')}     colSort="name_asc"     sort={sort} onSort={handleSort} />
            <SortTh label={t('columns.assignedTo')}  colSort="assigned_asc" sort={sort} onSort={handleSort} />
            <span className="uppercase tracking-widest text-[10px] font-semibold text-gray-600">{t('columns.branch')}</span>
            <span className="uppercase tracking-widest text-[10px] font-semibold text-gray-600">{t('columns.caseNumber')}</span>
            <span className="uppercase tracking-widest text-[10px] font-semibold text-gray-600 text-right">{t('columns.amount')}</span>
            <span className="uppercase tracking-widest text-[10px] font-semibold text-gray-600">{t('columns.status')}</span>
            <SortTh label={t('columns.added')} colSort="created_desc" sort={sort} onSort={handleSort} />
            <span />
          </div>

          {patients.map((p, i) => {
            const initials = p.patientName.split(' ').map(part => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/cases/${p.id}`)}
                className={`w-full text-left hover:bg-surface-sunken transition-colors ${i > 0 ? 'border-t border-surface-sunken' : ''}`}
              >
                {/* Mobile */}
                <div className="flex items-center gap-3 px-5 py-4 md:hidden">
                  <div className="w-9 h-9 rounded-full bg-surface-sunken flex items-center justify-center text-sm font-semibold text-gray-300 shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{p.patientCountryFlag} <DemoName>{p.patientName}</DemoName></p>
                    <p className="text-gray-500 text-xs mt-0.5 font-mono">{p.caseNumber}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge tone={STATUS_TONE[p.status]}>{CASE_STATUS_LABELS[p.status]}</StatusBadge>
                    <ChevronRight size={14} className="text-gray-600" />
                  </div>
                </div>

                {/* Desktop */}
                <div className={`hidden md:grid ${COLS} gap-3 items-center px-5 py-3.5`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-surface-sunken flex items-center justify-center text-xs font-semibold text-gray-300 shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{p.patientCountryFlag} <DemoName>{p.patientName}</DemoName></p>
                      <p className="text-gray-500 text-xs truncate font-mono">{p.caseNumber}</p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    {p.staffName ? (
                      <div className="flex items-center gap-1.5">
                        <User size={11} className="text-gray-600 shrink-0" />
                        <span className="text-gray-300 text-xs truncate"><DemoName>{p.staffName}</DemoName></span>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-xs">{t('notAssigned')}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="text-gray-300 text-xs truncate">{BRANCH_LABELS[p.branch] ?? p.branch}</span>
                  </div>

                  <div className="min-w-0">
                    <span className="text-gray-500 text-xs font-mono truncate">{p.caseNumber}</span>
                  </div>

                  <div className="text-right">
                    <span className={`text-sm font-medium ${p.totalAgreed > 0 ? 'text-accent' : 'text-gray-600'}`}>
                      {p.totalAgreed > 0 ? fmtGBP(p.totalAgreed) : t('noQuoteYet')}
                    </span>
                  </div>

                  <div>
                    <StatusBadge tone={STATUS_TONE[p.status]}>{CASE_STATUS_LABELS[p.status]}</StatusBadge>
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
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-line rounded-lg disabled:opacity-30 transition-colors"
          >
            {t('pagination.prev')}
          </button>
          <span className="text-gray-500 text-sm">{t('pagination.pageOf', { page, totalPages })}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-line rounded-lg disabled:opacity-30 transition-colors"
          >
            {t('pagination.next')}
          </button>
        </div>
      )}
    </div>
  );
}

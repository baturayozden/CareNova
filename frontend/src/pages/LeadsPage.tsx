import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { ApiLead, Lead, Message, PaginatedLeadsResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import AddLeadModal from '../components/AddLeadModal';
import BulkLeadModal from '../components/BulkLeadModal';
import { Flame, Thermometer, Snowflake, Ghost, Search, MessageCircle, Globe, Upload, Pencil, CreditCard, Briefcase, FileText } from 'lucide-react';
import { formatDate } from '../utils/date';

interface LeadCase {
  id: string;
  patient_name: string | null;
  treatment_description: string | null;
  amount_due: string | null;
  payment_method: string | null;
  status: string;
  created_at: string;
}

interface LeadDeal {
  id: string;
  treatment_category: string;
  treatment_name: string | null;
  quoted_amount: string | null;
  agreed_amount: string | null;
  deposit_amount: string;
  balance_due_date: string | null;
  status: string;
  verification_status: string;
  deal_date: string;
  staff_first_name: string | null;
  staff_last_name: string | null;
  staff_role: string | null;
  billing_entity_key: string | null;
  billing_entity_name: string | null;
}

interface LeadInvoice {
  id: string;
  invoice_number: string | null;
  amount: string;
  payment_status: 'paid' | 'unpaid';
  payment_method: string | null;
  status: 'draft' | 'finalized';
  issued_at: string;
}

interface SalesUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

// ── helpers ─────────────────────────────────────────────────────────────────

const statusStyles: Record<Lead['status'], string> = {
  new:       'bg-blue-900   text-blue-300   border border-blue-700',
  contacted: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
  responded: 'bg-purple-900 text-purple-300 border border-purple-700',
  qualified: 'bg-cyan-900   text-cyan-300   border border-cyan-700',
  booked:    'bg-green-900  text-green-300  border border-green-700',
  attended:  'bg-emerald-900 text-emerald-300 border border-emerald-700',
  lost:      'bg-red-900    text-red-300    border border-red-700',
  archived:  'bg-gray-800   text-gray-400   border border-gray-600',
};

const languageLabels: Record<string, string> = {
  en: '🇬🇧 EN',
  tr: '🇹🇷 TR',
  ar: '🇸🇦 AR',
  es: '🇪🇸 ES',
  ru: '🇷🇺 RU',
};

// ── Score badge helpers ───────────────────────────────────────────────────────

const ENTITY_LABELS: Record<string, string> = {
  vestadent:   'Vestadent',
  dentafly_uk: 'Dentafly UK',
};

const DEAL_STATUS_LABELS: Record<string, string> = {
  quoted:      'Quoted',
  accepted:    'Accepted',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
  refunded:    'Refunded',
};

function fmtGBP(n: string | number | null | undefined): string {
  if (n === null || n === undefined || n === '') return '—';
  const v = Number(n);
  return isNaN(v) ? '—' : `€${v.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
}

const SCORE_STYLES: Record<string, { badge: string; icon: IconComponent }> = {
  'Hot':        { badge: 'bg-red-900/50 text-red-300 border-red-700/60',         icon: Flame       },
  'Warm':       { badge: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/60', icon: Thermometer },
  'Cool':       { badge: 'bg-blue-900/50 text-blue-300 border-blue-700/60',       icon: Snowflake   },
  'Ghost Risk': { badge: 'bg-gray-800 text-gray-500 border-gray-600',             icon: Ghost       },
};

function ScoreBadge({ lead }: { lead: Lead & { id: string } }) {
  if (lead.leadScore === null || lead.scoreLabel === null) return null;
  const style = SCORE_STYLES[lead.scoreLabel] ?? SCORE_STYLES['Cool'];
  return (
    <div className="relative group inline-flex flex-col gap-1">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${style.badge}`}
        title={lead.scoreReasoning || ''}
      >
        {(() => { const Icon = style.icon; return <Icon size={12} />; })()} {lead.scoreLabel} <span className="opacity-60">·{lead.leadScore}</span>
      </span>
      {lead.scoreTags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {lead.scoreTags.slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] bg-surface-sunken text-gray-400 border border-line px-1.5 py-0.5 rounded-full">
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
      {/* Tooltip */}
      {lead.scoreReasoning && (
        <div className="absolute bottom-full left-0 mb-2 w-52 bg-surface-sunken border border-line-strong rounded-lg px-3 py-2 text-xs text-gray-300 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-xl">
          {lead.scoreReasoning}
        </div>
      )}
    </div>
  );
}

type SortField = 'lastContact' | 'score' | 'value';

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  });
}


function mapApiLead(l: ApiLead): Lead & { id: string } {
  return {
    id:                l.id,
    name:              `${l.firstName} ${l.lastName}`.trim() || l.phone,
    phone:             l.phone,
    email:             l.email ?? null,
    clinic:            l.tenantName || 'CareNova',
    source:            l.source || 'manual',
    status:            l.status,
    language:          (l.language || 'en') as Lead['language'],
    lastContact:       l.lastAiMessageAt || l.updatedAt || l.createdAt,
    aiMessages:        l.aiFollowUpCount,
    aiFollowUpEnabled: l.aiFollowUpEnabled ?? false,
    gdprConsentGiven:  l.gdprConsentGiven ?? false,
    treatment:         l.treatmentInterest || null,
    notes:             l.notes ?? null,
    treatmentValue:    l.treatmentValue || null,
    leadScore:         l.leadScore ?? null,
    scoreLabel:        l.scoreLabel ?? null,
    scoreTags:         l.scoreTags ?? [],
    scoreReasoning:    l.scoreReasoning ?? null,
    assignedTo:        l.assignedTo ?? null,
    createdAt:         l.createdAt,
  };
}

// ── filter types ─────────────────────────────────────────────────────────────

type StatusFilter = 'all' | Lead['status'];

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'New',          value: 'new' },
  { label: 'Contacted',    value: 'contacted' },
  { label: 'Responded',    value: 'responded' },
  { label: 'Booked',       value: 'booked' },
  { label: 'Lost',         value: 'lost' },
  { label: 'Archived',     value: 'archived' },
];

const LANGUAGE_OPTIONS = [
  { label: 'All Languages', value: 'all' },
  { label: '🇬🇧 English',   value: 'en' },
  { label: '🇹🇷 Turkish',   value: 'tr' },
  { label: '🇸🇦 Arabic',    value: 'ar' },
  { label: '🇪🇸 Spanish',   value: 'es' },
  { label: '🇷🇺 Russian',   value: 'ru' },
];

// ── component ────────────────────────────────────────────────────────────────

const ADD_LEAD_ROLES   = ['operasyon_muduru', 'klinik_sahibi', 'hasta_danismani', 'koordinator'];
const CAN_ASSIGN_ROLES = ['operasyon_muduru', 'klinik_sahibi', 'super_admin', 'admin'];

export default function LeadsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const canAddLead  = user ? ADD_LEAD_ROLES.includes(user.role)   : false;
  const canAssign   = user ? CAN_ASSIGN_ROLES.includes(user.role) : false;
  const [searchParams, setSearchParams] = useSearchParams();

  const [leads,         setLeads]         = useState<(Lead & { id: string })[]>([]);
  const [clinicList,    setClinicList]    = useState<{ id: string; name: string }[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [showAddLead,    setShowAddLead]    = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editLead,       setEditLead]       = useState<(Lead & { id: string }) | null>(null);

  // pagination
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);
  const [totalLeads,    setTotalLeads]    = useState(0);
  const PAGE_SIZE = 20;

  // filters
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all');
  const [clinicFilter,  setClinicFilter]  = useState('all');
  const [langFilter,    setLangFilter]    = useState('all');
  const [treatFilter,   setTreatFilter]   = useState('all');
  const [sortBy,        setSortBy]        = useState<SortField>('lastContact');

  // side panel
  const [selectedLead,  setSelectedLead]  = useState<(Lead & { id: string }) | null>(null);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [leadCases,     setLeadCases]     = useState<LeadCase[]>([]);
  const [casesLoading,  setCasesLoading]  = useState(false);
  const [msgLoading,    setMsgLoading]    = useState(false);
  const [leadDeals,     setLeadDeals]     = useState<LeadDeal[]>([]);
  const [dealsLoading,  setDealsLoading]  = useState(false);
  const [leadInvoices,  setLeadInvoices]  = useState<LeadInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // assignment
  const [salesUsers,    setSalesUsers]    = useState<SalesUser[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // ── fetch leads ─────────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async (p: number = page) => {
    try {
      setIsLoading(true);
      const res = await api.get<PaginatedLeadsResponse>(`/api/leads?page=${p}&limit=${PAGE_SIZE}`);
      setLeads(res.data.leads.map(mapApiLead));
      setTotalPages(res.data.totalPages);
      setTotalLeads(res.data.total);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => { fetchLeads(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── fetch all clinics for filter dropdown ────────────────────────────────────
  useEffect(() => {
    api.get<{ clinics: { id: string; name: string }[] }>('/api/clinics')
      .then(r => setClinicList(r.data.clinics))
      .catch(() => {/* silent — dropdown falls back to leads-derived options */});
  }, []);

  // ── fetch sales users for assignment dropdown (admin only) ───────────────────
  useEffect(() => {
    if (!canAssign || !user?.tenantId) return;
    api.get<{ salesUsers: SalesUser[] }>(`/api/clinics/${user.tenantId}/sales-users`)
      .then(r => setSalesUsers(r.data.salesUsers))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── reassign lead + cascade to its cases ────────────────────────────────────
  const handleAssign = async (leadId: string, assignedTo: string | null) => {
    setAssignLoading(true);
    try {
      await api.patch(`/api/leads/${leadId}/assign`, { assignedTo });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, assignedTo } : l));
      setSelectedLead(prev => prev?.id === leadId ? { ...prev, assignedTo } : prev);
    } catch {
      // keep current state on failure
    } finally {
      setAssignLoading(false);
    }
  };

  // ── open lead panel from ?lead= URL param (e.g. clicked from Dashboard) ──────

  useEffect(() => {
    const targetId = searchParams.get('lead');
    if (!targetId) return;
    setSearchParams({}, { replace: true }); // clean URL immediately
    // Fetch the lead directly — backend returns 403 if sales user doesn't own it
    api.get<{ lead: ApiLead }>(`/api/leads/${targetId}`)
      .then(r => setSelectedLead(mapApiLead(r.data.lead)))
      .catch(() => {}); // 403 Forbidden or 404 — don't open panel
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── fetch messages when a lead is selected ───────────────────────────────────

  useEffect(() => {
    if (!selectedLead) { setMessages([]); return; }
    setMessages([]);
    setMsgLoading(true);
    api.get<{ messages: Message[] }>(`/api/leads/${selectedLead.id}/messages`)
      .then(r => setMessages(r.data.messages))
      .catch(() => setMessages([]))
      .finally(() => setMsgLoading(false));
  }, [selectedLead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── fetch cases when a lead is selected ─────────────────────────────────────

  useEffect(() => {
    if (!selectedLead) { setLeadCases([]); return; }
    setLeadCases([]);
    setCasesLoading(true);
    api.get<{ cases: LeadCase[] }>(`/api/leads/${selectedLead.id}/cases`)
      .then(r => setLeadCases(r.data.cases))
      .catch(() => setLeadCases([]))
      .finally(() => setCasesLoading(false));
  }, [selectedLead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── fetch deals when a lead is selected ──────────────────────────────────────

  useEffect(() => {
    if (!selectedLead) { setLeadDeals([]); return; }
    setLeadDeals([]);
    setDealsLoading(true);
    api.get<{ deals: LeadDeal[] }>(`/api/commissions/deals`, { params: { leadId: selectedLead.id } })
      .then(r => setLeadDeals(r.data.deals || []))
      .catch(() => setLeadDeals([]))
      .finally(() => setDealsLoading(false));
  }, [selectedLead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── fetch invoices when a lead is selected ────────────────────────────────────

  useEffect(() => {
    if (!selectedLead) { setLeadInvoices([]); return; }
    setLeadInvoices([]);
    setInvoicesLoading(true);
    api.get<{ invoices: LeadInvoice[] }>(`/api/invoices`, { params: { leadId: selectedLead.id } })
      .then(r => setLeadInvoices(r.data.invoices || []))
      .catch(() => setLeadInvoices([]))
      .finally(() => setInvoicesLoading(false));
  }, [selectedLead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 1 when any filter changes
  useEffect(() => { setPage(1); }, [search, statusFilter, clinicFilter, langFilter, treatFilter, sortBy]);

  // ── derived lists ────────────────────────────────────────────────────────────

  // Clinic dropdown: sourced from /api/clinics (all clinics, not just those with leads).
  // Falls back to unique names from current leads if the clinics fetch hasn't resolved yet.
  const clinicOptions = clinicList.length > 0
    ? clinicList
    : Array.from(new Set(leads.map(l => l.clinic))).map(name => ({ id: name, name }));
  const treatOptions  = ['all', ...Array.from(new Set(leads.map(l => l.treatment).filter(Boolean) as string[]))];

  const filtered = leads
    .filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (clinicFilter !== 'all' && l.clinic !== clinicFilter) return false;
      if (langFilter   !== 'all' && l.language !== langFilter) return false;
      if (treatFilter  !== 'all' && l.treatment !== treatFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!l.name.toLowerCase().includes(q) && !l.phone.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score') {
        return (b.leadScore ?? -1) - (a.leadScore ?? -1);
      }
      if (sortBy === 'value') {
        return (b.treatmentValue ?? 0) - (a.treatmentValue ?? 0);
      }
      // default: lastContact desc
      return new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime();
    });

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex">

      {/* ── Main panel ────────────────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-w-0 p-4 md:p-8 transition-all duration-200 ${selectedLead ? 'md:pr-4' : ''}`}>
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl text-white">Leads</h1>
            <p className="text-gray-400 text-sm mt-1">{totalLeads} lead{totalLeads !== 1 ? 's' : ''} total</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canAddLead && (
              <>
                <button
                  onClick={() => setShowBulkUpload(true)}
                  className="text-xs font-medium text-gray-300 hover:text-white px-3 py-1.5 rounded-lg border border-line hover:border-line-strong transition-colors"
                >
                  ↑ Bulk Upload
                </button>
                <button
                  onClick={() => setShowAddLead(true)}
                  className="text-xs font-medium bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Add Lead
                </button>
              </>
            )}
            <button
              onClick={() => fetchLeads(page)}
              className="text-xs text-accent hover:text-accent-hover transition-colors px-3 py-1 border border-line rounded-lg"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Search + filters */}
        <div className="mb-5 flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full bg-surface-sunken border border-line rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-accent"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Clinic */}
          <select
            value={clinicFilter}
            onChange={e => setClinicFilter(e.target.value)}
            className="bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-accent"
          >
            <option value="all">All Clinics</option>
            {clinicOptions.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Language */}
          <select
            value={langFilter}
            onChange={e => setLangFilter(e.target.value)}
            className="bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-accent"
          >
            {LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Treatment */}
          <select
            value={treatFilter}
            onChange={e => setTreatFilter(e.target.value)}
            className="bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-accent"
          >
            <option value="all">All Treatments</option>
            {treatOptions.filter(t => t !== 'all').map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortField)}
            className="bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-accent"
          >
            <option value="lastContact">Sort: Recent</option>
            <option value="score">Sort: AI Score ↓</option>
            <option value="value">Sort: Value ↓</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
            ⚠ {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-500 text-sm">Loading leads…</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-line">
                    <th className="text-left px-6 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Clinic</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">AI Score</th>
                    <th className="text-left px-4 py-3 font-medium">Treatment</th>
                    <th className="text-left px-4 py-3 font-medium">Value</th>
                    <th className="text-left px-4 py-3 font-medium">Lang</th>
                    <th className="text-left px-4 py-3 font-medium">Last Contact</th>
                    <th className="text-left px-4 py-3 font-medium">Msgs</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lead => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                      className={`border-t border-line transition-colors cursor-pointer ${
                        selectedLead?.id === lead.id
                          ? 'bg-surface-sunken border-l-2 border-l-accent'
                          : 'bg-surface-sunken hover:bg-surface-sunken'
                      }`}
                    >
                      <td className="px-6 py-3">
                        <p className="text-white font-medium">{lead.name}</p>
                        <p className="text-gray-500 text-xs">{lead.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{lead.clinic}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[lead.status]}`}>
                          {t(`leadStatus.${lead.status}`, lead.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBadge lead={lead} />
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{lead.treatment || '—'}</td>
                      <td className="px-4 py-3 text-accent text-xs font-medium">
                        {lead.treatmentValue ? `€${lead.treatmentValue.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-xs">
                        {languageLabels[lead.language] ?? lead.language}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatRelativeTime(lead.lastContact)}</td>
                      <td className="px-4 py-3">
                        <span className="text-accent font-semibold">{lead.aiMessages}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && !isLoading && (
                <div className="py-12 text-center text-gray-500 text-sm">
                  No leads match your filters.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-gray-500 text-xs">
              Page <span className="text-white font-medium">{page}</span> of{' '}
              <span className="text-white font-medium">{totalPages}</span>
              <span className="ml-2 text-gray-600">({totalLeads} leads)</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line text-gray-300 hover:text-white hover:border-line-strong disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>

              {/* Page number pills — show up to 5 around current page */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                    if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…');
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === '…' ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-gray-600 text-xs">…</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(n as number)}
                        className={`w-7 h-7 text-xs font-medium rounded-lg transition-colors ${
                          page === n
                            ? 'bg-accent text-white'
                            : 'border border-line text-gray-400 hover:text-white hover:border-line-strong'
                        }`}
                      >
                        {n}
                      </button>
                    )
                  )
                }
              </div>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-line text-gray-300 hover:text-white hover:border-line-strong disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Side panel ────────────────────────────────────────────────────── */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 w-full h-[100dvh] bg-surface flex flex-col overflow-hidden md:relative md:inset-auto md:z-auto md:w-96 md:h-screen md:shrink-0 md:border-l md:border-line md:sticky md:top-0">

          {/* Panel header */}
          <div className="px-6 py-5 border-b border-line flex items-start justify-between">
            <div>
              <h2 className="text-white font-semibold text-lg">{selectedLead.name}</h2>
              <p className="text-gray-500 text-xs mt-0.5">{selectedLead.phone}</p>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <button
                onClick={() => navigate(`/patients/${selectedLead.id}`)}
                className="text-xs text-gray-400 hover:text-white border border-line hover:border-line-strong px-2.5 py-1 rounded-lg transition-colors"
              >
                Full profile
              </button>
              {canAddLead && (
                <button
                  onClick={() => setEditLead(selectedLead)}
                  className="text-xs text-accent hover:text-accent-hover border border-line hover:border-accent/50 px-2.5 py-1 rounded-lg transition-colors"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => setSelectedLead(null)}
                className="text-gray-500 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Lead details */}
          <div className="px-6 py-4 border-b border-line space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Status</span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[selectedLead.status]}`}>
                {t(`leadStatus.${selectedLead.status}`, selectedLead.status)}
              </span>
            </div>
            {selectedLead.createdAt && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">Added</span>
                <span className="text-gray-300 text-xs">
                  {formatDate(selectedLead.createdAt)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Clinic</span>
              <span className="text-gray-300 text-xs">{selectedLead.clinic}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Source</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                selectedLead.source === 'whatsapp'
                  ? 'bg-green-900/40 text-green-400 border border-green-700/50'
                  : selectedLead.source === 'website'
                  ? 'bg-blue-900/40 text-blue-400 border border-blue-700/50'
                  : selectedLead.source === 'bulk_csv'
                  ? 'bg-purple-900/40 text-purple-400 border border-purple-700/50'
                  : 'bg-surface-sunken text-gray-400 border border-line'
              }`}>
                {selectedLead.source === 'whatsapp'  ? <><MessageCircle size={12} /> WhatsApp</>
                  : selectedLead.source === 'website'   ? <><Globe size={12} /> Website</>
                  : selectedLead.source === 'bulk_csv'  ? <><Upload size={12} /> Bulk Import</>
                  : <><Pencil size={12} /> Manual</>}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">Language</span>
              <span className="text-gray-300 text-xs">{languageLabels[selectedLead.language] ?? selectedLead.language}</span>
            </div>
            {selectedLead.email && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">Email</span>
                <span className="text-gray-300 text-xs truncate max-w-[160px]">{selectedLead.email}</span>
              </div>
            )}
            {selectedLead.treatment && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">Treatment</span>
                <span className="text-gray-300 text-xs">{selectedLead.treatment}</span>
              </div>
            )}
            {selectedLead.treatmentValue != null && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">Est. Value</span>
                <span className="text-accent text-sm font-semibold">€{selectedLead.treatmentValue.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">AI Messages</span>
              <span className="text-accent font-semibold text-sm">{selectedLead.aiMessages}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-xs">AI follow-up</span>
              {selectedLead.aiFollowUpEnabled
                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 bg-green-900/40 border border-green-700/50 px-2 py-0.5 rounded-full">● Active</span>
                : <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-surface-sunken border border-line px-2 py-0.5 rounded-full">● Off</span>
              }
            </div>
            {selectedLead.notes && (
              <div className="flex flex-col gap-1">
                <span className="text-gray-500 text-xs">Notes</span>
                <p className="text-gray-300 text-xs leading-relaxed bg-surface-sunken border border-line rounded-lg px-3 py-2 whitespace-pre-wrap">
                  {selectedLead.notes}
                </p>
              </div>
            )}
            {selectedLead.leadScore !== null && (
              <div className="pt-1">
                <ScoreBadge lead={selectedLead} />
                {selectedLead.scoreTags.length > 2 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedLead.scoreTags.slice(2).map(tag => (
                      <span key={tag} className="text-[10px] bg-surface-sunken text-gray-400 border border-line px-1.5 py-0.5 rounded-full">
                        {tag.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {canAssign && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-gray-500 text-xs">Assigned to</span>
                <select
                  value={selectedLead.assignedTo || ''}
                  disabled={assignLoading}
                  onChange={e => handleAssign(selectedLead.id, e.target.value || null)}
                  className="bg-surface-sunken border border-line rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent/40 disabled:opacity-50 max-w-[160px]"
                >
                  <option value="">— Unassigned —</option>
                  {salesUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Financial totals summary */}
          {(leadDeals.length > 0 || leadCases.length > 0) && (() => {
            const totalAgreed  = leadDeals.reduce((s, d) => s + (parseFloat(d.agreed_amount  ?? '0') || 0), 0);
            const totalDeposit = leadDeals.reduce((s, d) => s + (parseFloat(d.deposit_amount ?? '0') || 0), 0);
            const totalCaseDue = leadCases.reduce((s, c) => s + (parseFloat(c.amount_due     ?? '0') || 0), 0);
            return (
              <div className="px-6 py-3 border-b border-line bg-surface-sunken/40">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-accent font-semibold text-sm">{fmtGBP(totalAgreed)}</div>
                    <div className="text-gray-600 text-[10px] mt-0.5">Total Agreed</div>
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">{fmtGBP(totalDeposit)}</div>
                    <div className="text-gray-600 text-[10px] mt-0.5">Deposited</div>
                  </div>
                  <div>
                    <div className="text-amber-400 font-semibold text-sm">{fmtGBP(totalCaseDue)}</div>
                    <div className="text-gray-600 text-[10px] mt-0.5">Cases Due</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Payments / Treatment Cases */}
          <div className="px-6 py-4 border-b border-line">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CreditCard size={12} /> Payments
            </p>
            {casesLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : leadCases.length === 0 ? (
              <p className="text-gray-600 text-xs">No payments yet.</p>
            ) : (
              <div className="space-y-2">
                {leadCases.map(c => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/payments/${c.id}`)}
                    className="w-full text-left bg-surface-sunken hover:bg-line border border-line rounded-lg px-3 py-2.5 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-xs font-medium truncate max-w-[160px]">
                        {c.treatment_description || 'Treatment'}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        c.status === 'paid'                ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-700/50' :
                        c.status === 'signed'              ? 'bg-green-900/60 text-green-400 border border-green-700/50' :
                        c.status === 'awaiting_signature'  ? 'bg-yellow-900/60 text-yellow-400 border border-yellow-700/50' :
                        c.status === 'payment_sent'        ? 'bg-blue-900/60 text-blue-400 border border-blue-700/50' :
                        c.status === 'finance_referred'    ? 'bg-purple-900/60 text-purple-400 border border-purple-700/50' :
                                                             'bg-line text-gray-400 border border-line-strong'
                      }`}>
                        {c.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-accent text-xs font-semibold">
                          {c.amount_due ? `€${parseFloat(c.amount_due).toLocaleString('en-GB', { minimumFractionDigits: 0 })}` : '—'}
                        </span>
                        {c.payment_method && (
                          <span className="text-gray-500 text-[10px]">
                            · {c.payment_method === 'bank_transfer' ? 'Bank Transfer' : c.payment_method === 'finance' ? 'Finance' : 'Card'}
                          </span>
                        )}
                      </div>
                      <span className="text-gray-500 text-[10px]">{formatDate(c.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Deals */}
          <div className="px-6 py-4 border-b border-line">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Briefcase size={12} /> Deals
            </p>
            {dealsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : leadDeals.length === 0 ? (
              <p className="text-gray-600 text-xs">No deals yet.</p>
            ) : (
              <div className="space-y-2">
                {leadDeals.map(d => {
                  const agreed  = parseFloat(d.agreed_amount  ?? '0') || 0;
                  const deposit = parseFloat(d.deposit_amount ?? '0') || 0;
                  const balance = agreed - deposit;
                  const overdue = d.balance_due_date ? new Date(d.balance_due_date) < new Date() : false;
                  return (
                    <div key={d.id} className="bg-surface-sunken border border-line rounded-lg px-3 py-2.5">
                      <div className="flex items-start justify-between mb-1.5">
                        <span className="text-white text-xs font-medium truncate max-w-[140px]">
                          {d.treatment_name || d.treatment_category}
                        </span>
                        <span className="text-accent text-xs font-semibold ml-2 shrink-0">
                          {agreed > 0 ? fmtGBP(agreed) : '—'}
                        </span>
                      </div>
                      {(d.staff_first_name || d.staff_last_name) && (
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className="text-gray-400 text-[10px]">
                            {[d.staff_first_name, d.staff_last_name].filter(Boolean).join(' ')}
                          </span>
                          {d.staff_role === 'hasta_danismani' ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-700/40">In quota</span>
                          ) : null}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {d.billing_entity_key && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-line text-gray-300 border border-line-strong">
                            {ENTITY_LABELS[d.billing_entity_key] ?? d.billing_entity_name ?? d.billing_entity_key}
                          </span>
                        )}
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          d.status === 'completed'  ? 'bg-green-900/40 text-green-400 border border-green-700/40' :
                          d.status === 'accepted'   ? 'bg-blue-900/40 text-blue-400 border border-blue-700/40' :
                          d.status === 'in_progress'? 'bg-amber-900/40 text-amber-400 border border-amber-700/40' :
                          d.status === 'cancelled'  ? 'bg-red-900/40 text-red-400 border border-red-700/40' :
                                                      'bg-line text-gray-400 border border-line-strong'
                        }`}>{DEAL_STATUS_LABELS[d.status] ?? d.status}</span>
                      </div>
                      {(deposit > 0 || d.balance_due_date) && (
                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
                          {deposit > 0 && (
                            <span>Deposit: <span className="text-gray-300">{fmtGBP(deposit)}</span></span>
                          )}
                          {agreed > 0 && (
                            <span>Balance: <span className="text-gray-300">{fmtGBP(balance)}</span></span>
                          )}
                          {d.balance_due_date && (
                            <span className={overdue ? 'text-red-400' : ''}>
                              Due: {formatDate(d.balance_due_date)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Invoices */}
          <div className="px-6 py-4 border-b border-line">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FileText size={12} /> Invoices
            </p>
            {invoicesLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : leadInvoices.length === 0 ? (
              <p className="text-gray-600 text-xs">No invoices yet.</p>
            ) : (
              <div className="space-y-2">
                {leadInvoices.map(inv => (
                  <div key={inv.id} className="bg-surface-sunken border border-line rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-xs font-medium">
                        {inv.invoice_number ?? 'Draft'}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        inv.payment_status === 'paid'
                          ? 'bg-green-900/40 text-green-400 border border-green-700/40'
                          : 'bg-amber-900/40 text-amber-400 border border-amber-700/40'
                      }`}>{inv.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-accent text-xs font-semibold">{fmtGBP(inv.amount)}</span>
                      <span className="text-gray-500 text-[10px]">{formatDate(inv.issued_at)}</span>
                    </div>
                    {inv.payment_method && (
                      <span className="text-gray-600 text-[10px]">{inv.payment_method.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conversation history */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider px-2 mb-2">Conversation</p>

            {msgLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">No messages yet.</p>
            ) : (
              messages.map((msg, i) => {
                const isOutbound = msg.direction === 'outbound';
                const prevMsg = messages[i - 1];
                const showDate = !prevMsg ||
                  new Date(prevMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

                return (
                  <React.Fragment key={msg.id}>
                    {showDate && (
                      <div className="text-center text-xs text-gray-600 py-1">
                        {formatDate(msg.createdAt)}
                      </div>
                    )}
                    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        isOutbound
                          ? 'bg-accent text-white rounded-br-sm'
                          : 'bg-surface-sunken text-gray-200 rounded-bl-sm'
                      }`}>
                        <p className="leading-relaxed">{msg.content}</p>
                        <div className={`flex items-center gap-1 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-[10px] ${isOutbound ? 'text-white/70' : 'text-gray-500'}`}>
                            {formatTime(msg.createdAt)}
                          </span>
                          {isOutbound && msg.aiGenerated && (
                            <span className="text-[10px] text-white/70">· AI</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      )}

      <AddLeadModal
        isOpen={showAddLead || !!editLead}
        editLead={editLead}
        onClose={() => { setShowAddLead(false); setEditLead(null); }}
        onCreated={() => { setShowAddLead(false); fetchLeads(1); setPage(1); }}
        onUpdated={(updated) => {
          setEditLead(null);
          fetchLeads(page);
          // Refresh the side panel with updated data
          setSelectedLead(prev => prev?.id === updated.id ? updated : prev);
        }}
      />

      <BulkLeadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onCompleted={() => { setShowBulkUpload(false); setPage(1); fetchLeads(1); }}
      />
    </div>
  );
}

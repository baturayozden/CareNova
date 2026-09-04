import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, MoreHorizontal, CheckCircle, XCircle, Clock, Lock } from 'lucide-react';
import api from '../lib/api';
import { PaginatedLeadsResponse } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Deal {
  id: string;
  lead_id: string | null;
  assigned_staff_id: string | null;
  patient_name: string | null;
  patient_email: string | null;
  patient_phone: string | null;
  treatment_category: string;
  treatment_name: string | null;
  quoted_amount: string | null;
  agreed_amount: string | null;
  deposit_amount: string;
  currency: string;
  deal_date: string;
  expected_start_date: string | null;
  status: string;
  commission_locked: boolean;
  verification_status: string;
  notes: string | null;
  staff_first_name: string | null;
  staff_last_name: string | null;
  billing_entity_id: string | null;
  balance_due_date: string | null;
  case_id: string | null;
}

interface BillingEntity {
  id: string;
  entity_key: string;
  legal_entity_name: string;
  trading_name: string | null;
  is_default: boolean;
}

export interface DealsTabProps {
  tenantId?: string;
  currentUserId: string;
  userRole: string;
  currentUserName?: string;
}

const ENTITY_LABELS: Record<string, string> = {
  vestadent:   'Vestadent',
  dentafly_uk: 'Dentafly UK',
};

function entityLabel(e: BillingEntity): string {
  return ENTITY_LABELS[e.entity_key] ?? e.legal_entity_name;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TREATMENT_CATEGORIES = [
  'implant', 'invisalign', 'composite', 'whitening', 'veneers',
  'orthodontics', 'extraction', 'crown', 'bridge', 'dentures', 'other',
];

const STATUSES = ['quoted', 'accepted', 'in_progress', 'completed', 'cancelled', 'refunded'];

const STATUS_LABELS: Record<string, string> = {
  quoted:      'Quoted',
  accepted:    'Accepted',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
  refunded:    'Refunded',
};

const STATUS_COLORS: Record<string, string> = {
  quoted:      'text-gray-400 bg-gray-400/10',
  accepted:    'text-blue-400 bg-blue-400/10',
  in_progress: 'text-amber-400 bg-amber-400/10',
  completed:   'text-green-400 bg-green-400/10',
  cancelled:   'text-red-400 bg-red-400/10',
  refunded:    'text-orange-400 bg-orange-400/10',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatGBP(n: string | number | null | undefined): string {
  if (n === null || n === undefined || n === '') return '—';
  const val = Number(n);
  if (isNaN(val)) return '—';
  return `€${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function VerifBadge({ status }: { status: string }) {
  if (status === 'auto_matched' || status === 'manually_approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-700 text-white">
        <CheckCircle size={10} /> Verified
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white">
        <XCircle size={10} /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-600 text-amber-950">
      <Clock size={10} /> Unverified
    </span>
  );
}

// ── DealModal ─────────────────────────────────────────────────────────────────

export interface DealModalProps {
  deal: Deal | null;
  tenantId?: string;
  onClose: () => void;
  onSaved: (deal: Deal) => void;
  fixedLeadId?: string;
  fixedPatient?: { name: string; phone: string; email: string | null };
  currentUserRole?: string;
  currentUserId?: string;
  currentUserName?: string;
}

interface StaffUser { id: string; firstName: string; lastName: string; }

const TODAY = new Date().toISOString().slice(0, 10);

interface LeadOption { id: string; firstName: string; lastName: string; phone: string; email: string | null; }

export function DealModal({ deal, tenantId, onClose, onSaved, fixedLeadId, fixedPatient, currentUserRole, currentUserId, currentUserName }: DealModalProps) {
  const isEdit = !!deal;
  const isSelfAssignRole = ['treatment_coordinator', 'sales'].includes(currentUserRole ?? '');
  const isAdminRole      = ['super_admin', 'admin', 'director', 'clinic_admin'].includes(currentUserRole ?? '');

  const [patientName,   setPatientName]   = useState(deal?.patient_name ?? fixedPatient?.name ?? '');
  const [patientEmail,  setPatientEmail]  = useState(deal?.patient_email ?? fixedPatient?.email ?? '');
  const [patientPhone,  setPatientPhone]  = useState(deal?.patient_phone ?? fixedPatient?.phone ?? '');
  const [treatmentCat,  setTreatmentCat]  = useState(deal?.treatment_category ?? '');
  const [treatmentName, setTreatmentName] = useState(deal?.treatment_name ?? '');
  const [quotedAmount,  setQuotedAmount]  = useState(deal?.quoted_amount ?? '');
  const [agreedAmount,  setAgreedAmount]  = useState(deal?.agreed_amount ?? '');
  const [depositAmount, setDepositAmount] = useState(deal?.deposit_amount ?? '0');
  const [dealDate,      setDealDate]      = useState(deal?.deal_date?.slice(0, 10) ?? TODAY);
  const [expectedStart, setExpectedStart] = useState(deal?.expected_start_date?.slice(0, 10) ?? '');
  const [status,        setStatus]        = useState(deal?.status ?? 'quoted');
  const [notes,         setNotes]         = useState(deal?.notes ?? '');
  const [leadId,        setLeadId]        = useState(fixedLeadId ?? deal?.lead_id ?? '');
  const [leadSearch,    setLeadSearch]    = useState('');
  const [leadOptions,   setLeadOptions]   = useState<LeadOption[]>([]);
  const [leadDropdown,  setLeadDropdown]  = useState(false);
  const [leadLoading,   setLeadLoading]   = useState(false);
  const [billingEntityId, setBillingEntityId] = useState(deal?.billing_entity_id ?? '');
  const [balanceDueDate,  setBalanceDueDate]  = useState(deal?.balance_due_date?.slice(0, 10) ?? '');
  const [entities,        setEntities]        = useState<BillingEntity[]>([]);
  // G1b — case creation
  const [createCase,      setCreateCase]      = useState(!isEdit && !!fixedLeadId);
  const [paymentMethod,   setPaymentMethod]   = useState('');
  const [payerType,       setPayerType]       = useState<'self' | 'third_party'>('self');
  const [cardholderName,  setCardholderName]  = useState('');
  const [cardholderEmail, setCardholderEmail] = useState('');
  const [cardholderPhone, setCardholderPhone] = useState('');
  const [cardholderRel,   setCardholderRel]   = useState('');
  const [cardholderAddr,  setCardholderAddr]  = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState(deal?.assigned_staff_id ?? '');
  const [staffList,       setStaffList]       = useState<StaffUser[]>([]);

  const leadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (leadRef.current && !leadRef.current.contains(e.target as Node)) {
        setLeadDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    async function fetchEntities() {
      try {
        const params: Record<string, string> = {};
        if (tenantId) params.tenantId = tenantId;
        const res = await api.get<{ entities: BillingEntity[] }>('/api/billing-entities', { params });
        const list = res.data.entities || [];
        setEntities(list);
        if (!isEdit) {
          const def = list.find(e => e.is_default);
          if (def) setBillingEntityId(def.id);
        }
      } catch {
        // non-fatal — entity selector stays empty
      }
    }
    fetchEntities();
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch assignable staff for admin/director/clinic_admin/super_admin
  useEffect(() => {
    if (!isAdminRole || !tenantId) return;
    api.get<{ salesUsers: StaffUser[] }>(`/api/clinics/${tenantId}/sales-users`)
      .then(r => setStaffList(r.data.salesUsers ?? []))
      .catch(() => {});
  }, [tenantId, isAdminRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // Entity-specific allowed payment methods
  const ENTITY_PAYMENT_METHODS: Record<string, { value: string; label: string }[]> = {
    dentafly_uk: [{ value: 'bank_transfer', label: 'Bank Transfer' }],
    vestadent:   [
      { value: 'card',          label: 'Card' },
      { value: 'bank_transfer', label: 'Bank Transfer' },
      { value: 'finance',       label: 'Finance' },
      { value: 'pay_by_bank',   label: 'Pay by Bank' },
      { value: 'cash',          label: 'Cash' },
    ],
  };
  const ALL_PAYMENT_METHODS = [
    { value: 'card',          label: 'Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'finance',       label: 'Finance' },
    { value: 'pay_by_bank',   label: 'Pay by Bank' },
    { value: 'cash',          label: 'Cash' },
  ];
  const selectedEntity = entities.find(e => e.id === billingEntityId);
  const allowedPaymentMethods = selectedEntity?.entity_key
    ? (ENTITY_PAYMENT_METHODS[selectedEntity.entity_key] ?? ALL_PAYMENT_METHODS)
    : ALL_PAYMENT_METHODS;

  useEffect(() => {
    if (!createCase) return;
    // Reset selection if current method not allowed for new entity
    if (paymentMethod && !allowedPaymentMethods.find(m => m.value === paymentMethod)) {
      setPaymentMethod('');
    }
    // Auto-select when only one option (e.g. dentafly_uk → bank_transfer)
    if (allowedPaymentMethods.length === 1) setPaymentMethod(allowedPaymentMethods[0].value);
  }, [billingEntityId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLeads() {
    if (leadOptions.length > 0) return;
    setLeadLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (tenantId) params.tenantId = tenantId;
      const res = await api.get<PaginatedLeadsResponse>('/api/leads', { params });
      setLeadOptions((res.data.leads || []).map(l => ({
        id:        l.id,
        firstName: l.firstName,
        lastName:  l.lastName,
        phone:     l.phone,
        email:     l.email ?? null,
      })));
    } catch {
      // silently ignore — lead linking is optional
    } finally {
      setLeadLoading(false);
    }
  }

  const filteredLeads = leadSearch.length > 0
    ? leadOptions.filter(l =>
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(leadSearch.toLowerCase()) ||
        (l.phone || '').includes(leadSearch)
      )
    : leadOptions.slice(0, 8);

  function selectLead(lead: LeadOption) {
    setLeadId(lead.id);
    setLeadSearch(`${lead.firstName} ${lead.lastName}`.trim());
    if (!patientName) setPatientName(`${lead.firstName} ${lead.lastName}`.trim());
    if (!patientPhone && lead.phone) setPatientPhone(lead.phone);
    if (!patientEmail && lead.email) setPatientEmail(lead.email);
    setLeadDropdown(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!treatmentCat.trim()) { setError('Treatment category is required.'); return; }
    if (!billingEntityId) { setError('Billing entity is required.'); return; }
    if (!isEdit && createCase && !paymentMethod) {
      setError('Payment method is required when creating a case.');
      return;
    }

    if (isAdminRole && !assignedStaffId) {
      setError('Assigned staff is required — select which TC/sales this deal belongs to.');
      return;
    }

    const body: Record<string, unknown> = {
      patient_name:        patientName.trim()   || undefined,
      patient_email:       patientEmail.trim()  || undefined,
      patient_phone:       patientPhone.trim()  || undefined,
      treatment_category:  treatmentCat.trim(),
      treatment_name:      treatmentName.trim() || undefined,
      quoted_amount:       quotedAmount   !== '' ? parseFloat(quotedAmount)  : undefined,
      agreed_amount:       agreedAmount   !== '' ? parseFloat(agreedAmount)  : undefined,
      deposit_amount:      depositAmount  !== '' ? parseFloat(depositAmount) : 0,
      deal_date:           dealDate       || undefined,
      expected_start_date: expectedStart  || undefined,
      status,
      notes:               notes.trim()   || undefined,
      lead_id:             leadId         || undefined,
      billing_entity_id:   billingEntityId || undefined,
      balance_due_date:    balanceDueDate  || undefined,
    };
    if (isAdminRole) body.assigned_staff_id = assignedStaffId;
    if (tenantId) body.tenantId = tenantId;

    if (!isEdit && createCase) {
      body.create_case    = true;
      body.payment_method = paymentMethod;
      body.payer_type     = payerType;
      if (payerType === 'third_party') {
        body.cardholder_name         = cardholderName.trim()  || undefined;
        body.cardholder_email        = cardholderEmail.trim() || undefined;
        body.cardholder_phone        = cardholderPhone.trim() || undefined;
        body.cardholder_relationship = cardholderRel.trim()   || undefined;
        body.cardholder_address      = cardholderAddr.trim()  || undefined;
      }
    }

    setSubmitting(true);
    try {
      let saved: Deal;
      if (isEdit) {
        const res = await api.put<{ deal: Deal }>(`/api/commissions/deals/${deal.id}`, body);
        saved = res.data.deal;
      } else {
        const res = await api.post<{ deal: Deal }>('/api/commissions/deals', body);
        saved = res.data.deal;
      }
      onSaved(saved);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save deal.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gold/50 focus:border-gold/50';
  const labelCls = 'block text-xs text-gray-400 mb-1 font-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-navy-700">
          <h2 className="text-white font-semibold text-base">{isEdit ? 'Edit Deal' : 'New Deal'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Lead link — hidden when lead is pre-fixed (PatientProfilePage) */}
          {!fixedLeadId && <div ref={leadRef} className="relative">
            <label className={labelCls}>Link to Lead <span className="text-gray-600">(optional)</span></label>
            <div className="relative">
              <input
                className={inputCls}
                placeholder="Search by name or phone…"
                value={leadSearch}
                onFocus={() => { setLeadDropdown(true); loadLeads(); }}
                onChange={e => { setLeadSearch(e.target.value); setLeadDropdown(true); setLeadId(''); }}
              />
              {leadId && (
                <button type="button"
                  onClick={() => { setLeadId(''); setLeadSearch(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">
                  ✕
                </button>
              )}
            </div>
            {leadDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-navy-800 border border-navy-600 rounded-lg shadow-xl max-h-44 overflow-y-auto">
                {leadLoading ? (
                  <p className="px-3 py-2 text-sm text-gray-400">Loading…</p>
                ) : filteredLeads.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500">No leads found</p>
                ) : filteredLeads.map(l => (
                  <button key={l.id} type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-navy-700 text-white"
                    onClick={() => selectLead(l)}>
                    <span className="font-medium">{l.firstName} {l.lastName}</span>
                    {l.phone && <span className="ml-2 text-gray-400 text-xs">{l.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>}

          {/* Assigned to — admin dropdown / TC+sales self-label */}
          {isSelfAssignRole && currentUserName && (
            <div>
              <label className={labelCls}>Assigned To</label>
              <p className="text-white text-sm px-3 py-2 bg-navy-800 border border-navy-600 rounded-lg">{currentUserName}</p>
            </div>
          )}
          {isAdminRole && (
            <div>
              <label className={labelCls}>Assigned To <span className="text-red-400">*</span></label>
              <select
                className={inputCls}
                value={assignedStaffId}
                onChange={e => setAssignedStaffId(e.target.value)}
                required
              >
                <option value="">— Select TC / Sales —</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Patient name */}
          <div>
            <label className={labelCls}>Patient Name</label>
            <input className={inputCls} value={patientName}
              onChange={e => setPatientName(e.target.value)} placeholder="Full name" />
          </div>

          {/* Patient contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Patient Phone <span className="text-gray-600">(optional)</span></label>
              <input className={inputCls} type="tel" value={patientPhone}
                onChange={e => setPatientPhone(e.target.value)} placeholder="+44 7700 000000" />
            </div>
            <div>
              <label className={labelCls}>Patient Email <span className="text-gray-600">(optional)</span></label>
              <input className={inputCls} type="email" value={patientEmail}
                onChange={e => setPatientEmail(e.target.value)} placeholder="patient@email.com" />
            </div>
          </div>

          {/* Treatment category (required) */}
          <div>
            <label className={labelCls}>Treatment Category <span className="text-red-400">*</span></label>
            <input className={inputCls} list="deal-tc-cats" value={treatmentCat}
              onChange={e => setTreatmentCat(e.target.value)}
              placeholder="e.g. implant, invisalign, composite…" />
            <datalist id="deal-tc-cats">
              {TREATMENT_CATEGORIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          {/* Treatment name */}
          <div>
            <label className={labelCls}>Treatment Name <span className="text-gray-600">(optional)</span></label>
            <input className={inputCls} value={treatmentName}
              onChange={e => setTreatmentName(e.target.value)} placeholder="e.g. Single Implant + Crown" />
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Quoted (€)</label>
              <input className={inputCls} type="number" min="0" step="0.01" value={quotedAmount}
                onChange={e => setQuotedAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Agreed (€)</label>
              <input className={inputCls} type="number" min="0" step="0.01" value={agreedAmount}
                onChange={e => setAgreedAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Deposit (€)</label>
              <input className={inputCls} type="number" min="0" step="0.01" value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Deal Date</label>
              <input className={inputCls} type="date" value={dealDate}
                onChange={e => setDealDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Expected Start</label>
              <input className={inputCls} type="date" value={expectedStart}
                onChange={e => setExpectedStart(e.target.value)} />
            </div>
          </div>

          {/* Billing entity */}
          <div>
            <label className={labelCls}>Billing Entity <span className="text-red-400">*</span></label>
            <select
              className={inputCls}
              value={billingEntityId}
              onChange={e => setBillingEntityId(e.target.value)}
              required
            >
              <option value="">— Select —</option>
              {entities.map(e => (
                <option key={e.id} value={e.id}>
                  {entityLabel(e)}
                </option>
              ))}
            </select>
          </div>

          {/* Balance due date + remaining */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Balance Due Date <span className="text-gray-600">(optional)</span></label>
              <input
                className={inputCls}
                type="date"
                value={balanceDueDate}
                onChange={e => setBalanceDueDate(e.target.value)}
              />
            </div>
            {(() => {
              const agreed  = parseFloat(agreedAmount);
              const deposit = parseFloat(depositAmount);
              if (!isNaN(agreed) && agreed > 0 && !isNaN(deposit)) {
                return (
                  <div>
                    <label className={labelCls}>Balance Remaining</label>
                    <div className="flex items-center h-[38px] px-3 bg-navy-800 border border-navy-600 rounded-lg text-sm text-gray-300">
                      {formatGBP(agreed - deposit)}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Status — read-only for non-admins when deal is linked to a payment case */}
          {(() => {
            const statusLocked = isEdit && !!deal?.case_id && !isAdminRole;
            return (
              <div>
                <label className={labelCls}>Status</label>
                <select
                  className={`${inputCls} ${statusLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  disabled={statusLocked}
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                  ))}
                </select>
                {statusLocked && (
                  <p className="text-xs text-gray-500 mt-1">Status is synced from the linked payment case.</p>
                )}
              </div>
            );
          })()}

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={inputCls} rows={2} value={notes}
              onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>

          {/* G1b — Create Payment Case (new deal only) */}
          {!isEdit && (
            <div className="border-t border-navy-700 pt-4 space-y-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createCase}
                  onChange={e => setCreateCase(e.target.checked)}
                  className="w-4 h-4 accent-gold"
                />
                <span className="text-sm text-white font-medium">Create Payment Case</span>
              </label>

              {createCase && (
                <>
                  <div>
                    <label className={labelCls}>Payment Method <span className="text-red-400">*</span></label>
                    <select
                      className={inputCls}
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                    >
                      <option value="">— Select —</option>
                      {allowedPaymentMethods.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Payer</label>
                    <select
                      className={inputCls}
                      value={payerType}
                      onChange={e => setPayerType(e.target.value as 'self' | 'third_party')}
                    >
                      <option value="self">Self (Patient pays)</option>
                      <option value="third_party">Third Party</option>
                    </select>
                  </div>

                  {payerType === 'third_party' && (
                    <div className="bg-navy-800 rounded-lg p-3 space-y-3">
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Third Party Details</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Name</label>
                          <input className={inputCls} value={cardholderName}
                            onChange={e => setCardholderName(e.target.value)} placeholder="Full name" />
                        </div>
                        <div>
                          <label className={labelCls}>Relationship</label>
                          <input className={inputCls} value={cardholderRel}
                            onChange={e => setCardholderRel(e.target.value)} placeholder="e.g. Spouse, Parent" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Email</label>
                          <input className={inputCls} type="email" value={cardholderEmail}
                            onChange={e => setCardholderEmail(e.target.value)} placeholder="email@example.com" />
                        </div>
                        <div>
                          <label className={labelCls}>Phone</label>
                          <input className={inputCls} type="tel" value={cardholderPhone}
                            onChange={e => setCardholderPhone(e.target.value)} placeholder="+44 7700 000000" />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Address <span className="text-gray-600">(optional)</span></label>
                        <input className={inputCls} value={cardholderAddr}
                          onChange={e => setCardholderAddr(e.target.value)} placeholder="Full address" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2 bg-gold text-white rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 transition-colors">
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : (!isEdit && createCase ? 'Create Deal + Case' : 'Create Deal')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── DealsTab ──────────────────────────────────────────────────────────────────

export default function DealsTab({ tenantId, currentUserId, userRole, currentUserName }: DealsTabProps) {
  const [deals,     setDeals]     = useState<Deal[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [tcFilter,          setTcFilter]         = useState<string>('');
  const [unverifiedOnly,    setUnverifiedOnly]   = useState(false);
  const [verifying,         setVerifying]        = useState<string | null>(null);
  // undefined = modal closed; null = new deal; Deal = edit
  const [modalDeal, setModalDeal] = useState<Deal | null | undefined>(undefined);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);
  const [openMenu,  setOpenMenu]  = useState<string | null>(null);
  const [menuPos,   setMenuPos]   = useState<{ top: number; right: number } | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isTC         = userRole === 'treatment_coordinator';
  const isAdminRole  = ['super_admin', 'admin', 'director', 'clinic_admin'].includes(userRole ?? '');
  const showAdmin    = !isTC; // show TC column, filter, summary for all non-TC roles

  function canManage(deal: Deal): boolean {
    if (deal.commission_locked) return false;
    if (isTC) return deal.assigned_staff_id === currentUserId;
    return true;
  }

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (tenantId) params.tenantId = tenantId;
      const res = await api.get<{ deals: Deal[] }>('/api/commissions/deals', { params });
      setDeals(res.data.deals);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load deals.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  useEffect(() => {
    if (!openMenu) return;
    function handler(e: MouseEvent) {
      const ref = menuRefs.current[openMenu!];
      if (ref && !ref.contains(e.target as Node)) { setOpenMenu(null); setMenuPos(null); }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const params: Record<string, string> = {};
      if (tenantId) params.tenantId = tenantId;
      await api.delete(`/api/commissions/deals/${deleteId}`, { params });
      setDeals(prev => prev.filter(d => d.id !== deleteId));
      setDeleteId(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete deal.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleVerify(dealId: string, action: 'approve' | 'reject') {
    setVerifying(dealId);
    try {
      const body: Record<string, string> = { action };
      if (tenantId) body.tenantId = tenantId;
      const res = await api.patch<{ deal: Deal }>(`/api/commissions/deals/${dealId}/verify`, body);
      setDeals(prev => prev.map(d => d.id === dealId ? res.data.deal : d));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to update verification.');
    } finally {
      setVerifying(null);
      setOpenMenu(null);
      setMenuPos(null);
    }
  }

  function onSaved(saved: Deal) {
    setDeals(prev => {
      const idx = prev.findIndex(d => d.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setModalDeal(undefined);
  }

  // Unique TCs in the current deal list (for filter dropdown)
  const tcOptions = showAdmin
    ? Array.from(
        new Map(
          deals
            .filter(d => d.assigned_staff_id && (d.staff_first_name || d.staff_last_name))
            .map(d => [
              d.assigned_staff_id!,
              { id: d.assigned_staff_id!, name: `${d.staff_first_name ?? ''} ${d.staff_last_name ?? ''}`.trim() },
            ])
        ).values()
      )
    : [];

  const visibleDeals = deals
    .filter(d => !tcFilter || d.assigned_staff_id === tcFilter)
    .filter(d => !unverifiedOnly || d.verification_status === 'unverified');

  // Per-TC summary (admin view)
  const summaryByTC: { id: string; name: string; count: number; total: number }[] = showAdmin
    ? Array.from(
        visibleDeals.reduce((map, d) => {
          const key = d.assigned_staff_id ?? '__none__';
          const name = d.assigned_staff_id
            ? `${d.staff_first_name ?? ''} ${d.staff_last_name ?? ''}`.trim() || 'Unknown'
            : 'Unassigned';
          const existing = map.get(key) ?? { id: key, name, count: 0, total: 0 };
          existing.count += 1;
          existing.total += Number(d.agreed_amount ?? 0);
          map.set(key, existing);
          return map;
        }, new Map<string, { id: string; name: string; count: number; total: number }>())
        .values()
      ).sort((a, b) => b.total - a.total)
    : [];

  return (
    <>
      {/* Header row: TC filter (admin) + New Deal button */}
      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          {showAdmin && tcOptions.length > 0 && (
            <select
              value={tcFilter}
              onChange={e => setTcFilter(e.target.value)}
              className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
            >
              <option value="">All TCs</option>
              {tcOptions.map(tc => (
                <option key={tc.id} value={tc.id}>{tc.name}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-400 hover:text-gray-200 transition-colors">
            <input
              type="checkbox"
              checked={unverifiedOnly}
              onChange={e => setUnverifiedOnly(e.target.checked)}
              className="w-3.5 h-3.5 accent-gold"
            />
            Unverified only
          </label>
        </div>

        <button
          onClick={() => setModalDeal(null)}
          className="flex items-center gap-2 px-4 py-2 bg-gold text-white rounded-lg text-sm font-semibold hover:bg-gold/90 transition-colors"
        >
          <span className="text-base leading-none">+</span>
          New Deal
        </button>
      </div>

      {/* Summary strip (admin only, when there are deals) */}
      {showAdmin && summaryByTC.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summaryByTC.map(tc => (
            <button
              key={tc.id}
              onClick={() => setTcFilter(tcFilter === tc.id ? '' : tc.id)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                tcFilter === tc.id
                  ? 'bg-gold/20 border-gold/50 text-gold'
                  : 'bg-navy-800 border-navy-600 text-gray-300 hover:border-gold/40 hover:text-white'
              }`}
            >
              <span>{tc.name}</span>
              <span className="text-gray-500">·</span>
              <span>{tc.count} deal{tc.count !== 1 ? 's' : ''}</span>
              <span className="text-gray-500">·</span>
              <span>{formatGBP(tc.total)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-navy-800 border border-navy-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Loading deals…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-red-400 text-sm">{error}</div>
        ) : visibleDeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase size={40} className="text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm font-medium">
              {tcFilter ? 'No deals for this TC' : 'No deals yet — record your first sale'}
            </p>
            {!tcFilter && (
              <button onClick={() => setModalDeal(null)}
                className="mt-4 px-4 py-1.5 bg-gold text-white rounded-lg text-sm font-semibold hover:bg-gold/90 transition-colors">
                + New Deal
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-700">
                  <th className="text-left py-3 pl-5 pr-4 text-xs text-gray-400 font-medium whitespace-nowrap">Deal Date</th>
                  <th className="text-left py-3 pr-4 text-xs text-gray-400 font-medium">Patient</th>
                  {showAdmin && (
                    <th className="text-left py-3 pr-4 text-xs text-gray-400 font-medium whitespace-nowrap">TC</th>
                  )}
                  <th className="text-left py-3 pr-4 text-xs text-gray-400 font-medium">Treatment</th>
                  <th className="text-right py-3 pr-4 text-xs text-gray-400 font-medium whitespace-nowrap">Agreed (€)</th>
                  <th className="text-left py-3 pr-4 text-xs text-gray-400 font-medium">Status</th>
                  <th className="text-left py-3 pr-4 text-xs text-gray-400 font-medium">Verification</th>
                  <th className="py-3 pr-4 w-10" />
                </tr>
              </thead>
              <tbody>
                {visibleDeals.map(deal => (
                  <tr key={deal.id} className="border-b border-navy-700/50 last:border-0 hover:bg-navy-800/60 transition-colors">
                    <td className="py-3 pl-5 pr-4 text-gray-300 whitespace-nowrap text-sm">
                      {fmtDate(deal.deal_date)}
                    </td>
                    <td className="py-3 pr-4 max-w-[180px]">
                      <div className="text-white font-medium truncate">
                        {deal.patient_name ?? <span className="text-gray-500 italic font-normal">—</span>}
                      </div>
                      {(deal.patient_phone || deal.patient_email) && (
                        <div className="text-gray-500 text-xs mt-0.5 truncate">
                          {deal.patient_phone && <span>{deal.patient_phone}</span>}
                          {deal.patient_phone && deal.patient_email && <span className="mx-1">·</span>}
                          {deal.patient_email && <span>{deal.patient_email}</span>}
                        </div>
                      )}
                    </td>
                    {showAdmin && (
                      <td className="py-3 pr-4 text-gray-300 whitespace-nowrap text-sm">
                        {deal.staff_first_name
                          ? `${deal.staff_first_name} ${deal.staff_last_name ?? ''}`.trim()
                          : <span className="text-gray-600 italic">—</span>}
                      </td>
                    )}
                    <td className="py-3 pr-4 text-gray-300">
                      <span className="font-medium capitalize">{deal.treatment_category}</span>
                      {deal.treatment_name && (
                        <span className="text-gray-500 text-xs ml-1.5">· {deal.treatment_name}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right text-white font-semibold whitespace-nowrap">
                      {formatGBP(deal.agreed_amount)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[deal.status] ?? 'text-gray-400 bg-gray-400/10'}`}>
                        {STATUS_LABELS[deal.status] ?? deal.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <VerifBadge status={deal.verification_status} />
                    </td>
                    <td className="py-3 pr-4">
                      {deal.commission_locked ? (
                        <span title="Locked — commission period approved" className="flex justify-center text-gray-600 cursor-default">
                          <Lock size={14} />
                        </span>
                      ) : canManage(deal) ? (
                        <div className="flex justify-center" ref={el => { menuRefs.current[deal.id] = el; }}>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (openMenu === deal.id) {
                                setOpenMenu(null); setMenuPos(null);
                              } else {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                setOpenMenu(deal.id);
                              }
                            }}
                            className="p-1 rounded text-gray-400 hover:text-white hover:bg-navy-700 transition-colors"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {openMenu === deal.id && menuPos && createPortal(
                            <div
                              style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}
                              className="bg-navy-800 border border-navy-600 rounded-lg shadow-xl py-1 w-36"
                              onMouseDown={e => e.stopPropagation()}
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-navy-700 transition-colors"
                                onClick={() => { setModalDeal(deal); setOpenMenu(null); setMenuPos(null); }}
                              >
                                Edit
                              </button>
                              {isAdminRole && deal.verification_status !== 'manually_approved' && (
                                <button
                                  disabled={verifying === deal.id}
                                  className="w-full text-left px-4 py-2 text-sm text-green-400 hover:bg-navy-700 transition-colors disabled:opacity-50"
                                  onClick={() => handleVerify(deal.id, 'approve')}
                                >
                                  {verifying === deal.id ? 'Verifying…' : 'Verify'}
                                </button>
                              )}
                              {isAdminRole && deal.verification_status !== 'rejected' && (
                                <button
                                  disabled={verifying === deal.id}
                                  className="w-full text-left px-4 py-2 text-sm text-yellow-400 hover:bg-navy-700 transition-colors disabled:opacity-50"
                                  onClick={() => handleVerify(deal.id, 'reject')}
                                >
                                  Reject
                                </button>
                              )}
                              <button
                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-navy-700 transition-colors"
                                onClick={() => { setDeleteId(deal.id); setOpenMenu(null); setMenuPos(null); }}
                              >
                                Delete
                              </button>
                            </div>,
                            document.body,
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DealModal — undefined=closed, null=new, Deal=edit */}
      {modalDeal !== undefined && (
        <DealModal
          deal={modalDeal}
          tenantId={tenantId}
          onClose={() => setModalDeal(undefined)}
          onSaved={onSaved}
          currentUserRole={userRole}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-navy-900 border border-navy-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold mb-2">Delete Deal</h3>
            <p className="text-gray-400 text-sm mb-5">
              This deal will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} disabled={deleting}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-500 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import CustomSelect from './CustomSelect';
import { createPortal } from 'react-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
}

interface BillingEntity {
  id: string;
  entity_key: string;
  legal_entity_name: string;
  trading_name: string | null;
  is_default: boolean;
}

interface StaffUser {
  id: string;
  name: string;
}

interface EditCase {
  id: string;
  lead_id?: string | null;
  patient_name?: string | null;
  patient_dob?: string | null;
  patient_address?: string | null;
  patient_phone?: string | null;
  patient_email?: string | null;
  treatment_description?: string | null;
  total_cost?: string | null;
  amount_due?: string | null;
  payment_method?: string | null;
  payer_type?: string | null;
  cardholder_name?: string | null;
  cardholder_relationship?: string | null;
  cardholder_address?: string | null;
  cardholder_phone?: string | null;
  cardholder_email?: string | null;
  card_scheme?: string | null;
  card_first4?: string | null;
  card_last4?: string | null;
  photo_id_type?: string | null;
  photo_id_ref?: string | null;
  status?: string;
}

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: { id: string }) => void;
  effectiveTenantId?: string;
  editCase?: EditCase | null;
  financeEnabled?: boolean;
  currentUserRole?: string;
}

const ENTITY_LABELS: Record<string, string> = {
  vestadent:   'Vestadent',
  dentafly_uk: 'Dentafly UK',
};

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

const ALL_PAYMENT_METHODS_BASE = [
  { value: 'card',          label: 'Card'          },
  { value: 'pay_by_bank',   label: 'Pay by Bank'  },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'finance',       label: 'Finance'       },
  { value: 'cash',          label: 'Cash'          },
];

const ALL_STATUSES = [
  { value: 'draft',              label: 'Draft'              },
  { value: 'awaiting_signature', label: 'Awaiting Signature' },
  { value: 'signed',             label: 'Signed'             },
  { value: 'payment_sent',       label: 'Payment Sent'       },
  { value: 'paid',               label: 'Paid'               },
  { value: 'finance_referred',   label: 'Finance Referred'   },
  { value: 'reversed',           label: 'Reversed'           },
  { value: 'cancelled',          label: 'Cancelled'          },
];

const CREATE_STATUSES = ALL_STATUSES.slice(0, 6);

export default function NewCaseModal({
  isOpen,
  onClose,
  onCreated,
  effectiveTenantId,
  editCase,
  financeEnabled = true,
  currentUserRole,
}: NewCaseModalProps) {
  const { user } = useAuth();
  const isEdit = !!editCase;
  const isAdminRole = ['super_admin', 'admin', 'operasyon_muduru', 'klinik_sahibi'].includes(currentUserRole ?? '');
  // For non-platform-admin users effectiveTenantId is undefined — fall back to their own tenantId.
  const staffTenantId = effectiveTenantId ?? user?.tenantId ?? '';

  const [leads,        setLeads]        = useState<Lead[]>([]);
  const [search,       setSearch]       = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Entity + staff
  const [entities,        setEntities]        = useState<BillingEntity[]>([]);
  const [billingEntityId, setBillingEntityId] = useState('');
  const [staffList,       setStaffList]       = useState<StaffUser[]>([]);
  const [assignedStaffId, setAssignedStaffId] = useState('');

  // Patient
  const [patientName,    setPatientName]    = useState('');
  const [patientPhone,   setPatientPhone]   = useState('');
  const [patientEmail,   setPatientEmail]   = useState('');
  const [patientDob,     setPatientDob]     = useState('');
  const [patientAddress, setPatientAddress] = useState('');

  // Treatment & payment
  const [treatmentDesc,  setTreatmentDesc]  = useState('');
  const [totalCost,      setTotalCost]      = useState('');
  const [amountDue,      setAmountDue]      = useState('');
  const [amountDueDirty, setAmountDueDirty] = useState(false);
  const [depositAmount,  setDepositAmount]  = useState('');
  const [paymentMethod,  setPaymentMethod]  = useState('');
  const [payerType,      setPayerType]      = useState('self');

  // Cardholder (card + third_party only)
  const [cardholderName,         setCardholderName]         = useState('');
  const [cardholderRelationship, setCardholderRelationship] = useState('');
  const [cardholderAddress,      setCardholderAddress]      = useState('');
  const [cardholderPhone,        setCardholderPhone]        = useState('');
  const [cardholderEmail,        setCardholderEmail]        = useState('');
  const [cardScheme,             setCardScheme]             = useState('');
  const [cardFirst4,             setCardFirst4]             = useState('');
  const [cardLast4,              setCardLast4]              = useState('');
  const [photoIdType,            setPhotoIdType]            = useState('');
  const [photoIdRef,             setPhotoIdRef]             = useState('');

  const [status,     setStatus]     = useState('draft');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  // Load leads for the search dropdown (create mode only)
  useEffect(() => {
    if (!isOpen) return;
    api.get<{ leads: Lead[] }>('/api/leads', {
      params: effectiveTenantId ? { tenantId: effectiveTenantId } : undefined,
    }).then(res => setLeads(res.data.leads)).catch(() => {});
  }, [isOpen, effectiveTenantId]);

  // Fetch billing entities (create mode only)
  useEffect(() => {
    if (!isOpen || isEdit) return;
    const params: Record<string, string> = {};
    if (effectiveTenantId) params.tenantId = effectiveTenantId;
    api.get<{ entities: BillingEntity[] }>('/api/billing-entities', { params })
      .then(res => {
        const list = res.data.entities || [];
        setEntities(list);
        const def = list.find(e => e.is_default);
        if (def) setBillingEntityId(def.id);
      })
      .catch(() => {});
  }, [isOpen, isEdit, effectiveTenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch assignable staff (admin/director roles, create mode only)
  useEffect(() => {
    if (!isOpen || isEdit || !isAdminRole || !staffTenantId) return;
    api.get<{ salesUsers: { id: string; firstName: string; lastName: string; email: string }[] }>(
      `/api/clinics/${staffTenantId}/sales-users`,
      { headers: { 'Cache-Control': 'no-store' } },
    ).then(res => {
        const raw = res.data.salesUsers ?? [];
        console.log('[sales-users] raw:', raw);
        const list: StaffUser[] = raw.map(u => ({
          id:   u.id,
          name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || 'Unknown',
        })).filter(u => u.id);
        console.log('[sales-users] → options:', list);
        setStaffList(list);
      })
      .catch(() => {});
  }, [isOpen, isEdit, isAdminRole, staffTenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-populate form in edit mode
  useEffect(() => {
    if (!isOpen || !editCase) return;
    setSearch('');
    setSelectedLead(null);
    setPatientName(editCase.patient_name          || '');
    setPatientPhone(editCase.patient_phone         || '');
    setPatientEmail(editCase.patient_email         || '');
    setPatientDob(editCase.patient_dob ? String(editCase.patient_dob).slice(0, 10) : '');
    setPatientAddress(editCase.patient_address     || '');
    setTreatmentDesc(editCase.treatment_description || '');
    setTotalCost(editCase.total_cost  ? String(editCase.total_cost)  : '');
    setAmountDue(editCase.amount_due  ? String(editCase.amount_due)  : '');
    setPaymentMethod(editCase.payment_method       || '');
    setPayerType(editCase.payer_type               || 'self');
    setCardholderName(editCase.cardholder_name         || '');
    setCardholderRelationship(editCase.cardholder_relationship || '');
    setCardholderAddress(editCase.cardholder_address   || '');
    setCardholderPhone(editCase.cardholder_phone       || '');
    setCardholderEmail(editCase.cardholder_email       || '');
    setCardScheme(editCase.card_scheme                 || '');
    setCardFirst4(editCase.card_first4                 || '');
    setCardLast4(editCase.card_last4                   || '');
    setPhotoIdType(editCase.photo_id_type              || '');
    setPhotoIdRef(editCase.photo_id_ref                || '');
    setStatus(editCase.status || 'draft');
    setAmountDueDirty(true);
  }, [isOpen, editCase]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-select / reset payment method when entity changes (create mode)
  useEffect(() => {
    if (isEdit) return;
    const selectedEntity = entities.find(e => e.id === billingEntityId);
    const allowed = selectedEntity?.entity_key
      ? (ENTITY_PAYMENT_METHODS[selectedEntity.entity_key] ?? ALL_PAYMENT_METHODS_BASE)
      : ALL_PAYMENT_METHODS_BASE;
    if (paymentMethod && !allowed.find(m => m.value === paymentMethod)) {
      setPaymentMethod('');
    }
    if (allowed.length === 1) setPaymentMethod(allowed[0].value);
  }, [billingEntityId]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickLead(lead: Lead) {
    setSelectedLead(lead);
    setSearch(`${lead.firstName} ${lead.lastName}`);
    setPatientName(`${lead.firstName} ${lead.lastName}`);
    setPatientPhone(lead.phone || '');
    setPatientEmail(lead.email || '');
    setShowDropdown(false);
  }

  function clearLead() {
    setSelectedLead(null);
    setSearch('');
  }

  function handleTotalCostChange(val: string) {
    setTotalCost(val);
    if (!amountDueDirty) setAmountDue(val);
  }

  function handleAmountDueChange(val: string) {
    setAmountDue(val);
    setAmountDueDirty(true);
  }

  function handlePaymentMethodChange(val: string) {
    setPaymentMethod(val);
    if (val !== 'card' && val !== 'bank_transfer' && val !== 'finance') setPayerType('self');
  }

  const filteredLeads = leads.filter(l => {
    const q = search.toLowerCase();
    return (
      `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
      (l.phone || '').includes(q)
    );
  });

  function reset() {
    setSelectedLead(null); setSearch('');
    setPatientName(''); setPatientPhone(''); setPatientEmail('');
    setPatientDob(''); setPatientAddress(''); setTreatmentDesc('');
    setTotalCost(''); setAmountDue(''); setAmountDueDirty(false);
    setDepositAmount('');
    setPaymentMethod(''); setPayerType('self'); setStatus('draft');
    setCardholderName(''); setCardholderRelationship('');
    setCardholderAddress(''); setCardholderPhone(''); setCardholderEmail('');
    setCardScheme(''); setCardFirst4(''); setCardLast4('');
    setPhotoIdType(''); setPhotoIdRef('');
    setBillingEntityId(''); setAssignedStaffId('');
    setError('');
  }

  function handleClose() { reset(); onClose(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const incCh = (paymentMethod === 'card' || paymentMethod === 'bank_transfer' || paymentMethod === 'finance') && payerType === 'third_party';

    if (incCh) {
      if (!cardholderName.trim()) {
        setError('Cardholder name is required for third-party card payments.');
        return;
      }
      if (!cardholderPhone.trim() && !cardholderEmail.trim()) {
        setError('Cardholder phone or email is required for third-party card payments.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const body: Record<string, string | undefined> = {
        patientName:          patientName    || undefined,
        patientPhone:         patientPhone   || undefined,
        patientEmail:         patientEmail   || undefined,
        patientDob:           patientDob     || undefined,
        patientAddress:       patientAddress || undefined,
        treatmentDescription: treatmentDesc  || undefined,
        totalCost:            totalCost      || undefined,
        amountDue:            amountDue      || undefined,
        paymentMethod:        paymentMethod  || undefined,
        payerType:            (paymentMethod === 'card' || paymentMethod === 'bank_transfer' || paymentMethod === 'finance') ? (payerType || 'self') : 'self',
        status,
        ...(paymentMethod === 'card' && {
          cardScheme: cardScheme || undefined,
          cardFirst4: cardFirst4 || undefined,
          cardLast4:  cardLast4  || undefined,
        }),
        ...(incCh && {
          cardholderName:         cardholderName         || undefined,
          cardholderRelationship: cardholderRelationship || undefined,
          cardholderAddress:      cardholderAddress      || undefined,
          cardholderPhone:        cardholderPhone        || undefined,
          cardholderEmail:        cardholderEmail        || undefined,
          photoIdType:            photoIdType            || undefined,
          photoIdRef:             photoIdRef             || undefined,
        }),
        ...(!isEdit && billingEntityId && { billingEntityId }),
        ...(!isEdit && depositAmount   && { depositAmount }),
        ...(!isEdit && isAdminRole && assignedStaffId && { assignedStaffId }),
      };
      if (effectiveTenantId) body.tenantId = effectiveTenantId;
      if (!isEdit) body.leadId = selectedLead?.id;

      let result: { id: string };
      if (isEdit) {
        const res = await api.patch<{ case: { id: string } }>(`/api/cases/${editCase!.id}`, body);
        result = res.data.case;
      } else {
        const res = await api.post<{ case: { id: string } }>('/api/cases', body);
        result = res.data.case;
      }
      reset();
      onCreated(result);
    } catch (err: unknown) {
      setError(
        (err as any)?.response?.data?.error ||
        (isEdit ? 'Failed to update case.' : 'Failed to create case.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const inputCls = 'w-full min-w-0 bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/40';
  const labelCls = 'block text-xs font-medium text-gray-400 mb-1';
  const optCls   = 'bg-white text-gray-900';
  const statusOptions = isEdit ? ALL_STATUSES : CREATE_STATUSES;

  const selectedEntity = entities.find(e => e.id === billingEntityId);
  const entityPaymentMethods = selectedEntity?.entity_key
    ? (ENTITY_PAYMENT_METHODS[selectedEntity.entity_key] ?? ALL_PAYMENT_METHODS_BASE)
    : ALL_PAYMENT_METHODS_BASE;
  const paymentMethods = isEdit
    ? (financeEnabled ? ALL_PAYMENT_METHODS_BASE : ALL_PAYMENT_METHODS_BASE.filter(m => m.value !== 'finance'))
    : (financeEnabled ? entityPaymentMethods : entityPaymentMethods.filter(m => m.value !== 'finance'));
  const showCardholder = (paymentMethod === 'card' || paymentMethod === 'bank_transfer' || paymentMethod === 'finance') && payerType === 'third_party';

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={handleClose} />
      <div className="relative bg-surface-sunken border border-line rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-sunken sticky top-0 bg-surface-sunken z-10">
          <h2 className="text-white font-semibold text-base">
            {isEdit ? 'Edit Payment Case' : 'New Payment Case'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Lead search — create mode only */}
          {!isEdit && (
            <div>
              <label className={labelCls}>Link to Lead <span className="text-gray-600">(optional)</span></label>
              <div className="relative" ref={searchRef}>
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowDropdown(true); if (!e.target.value) clearLead(); }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search by name or phone…"
                  className={inputCls}
                  autoComplete="off"
                />
                {selectedLead && (
                  <button
                    type="button"
                    onClick={clearLead}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-sm"
                  >✕</button>
                )}
                {showDropdown && filteredLeads.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-surface-sunken border border-line rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredLeads.slice(0, 20).map(l => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => pickLead(l)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-200 hover:bg-line transition-colors"
                      >
                        <span className="font-medium">{l.firstName} {l.lastName}</span>
                        <span className="text-gray-500 text-xs">{l.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Billing entity — create mode only */}
          {!isEdit && (
            <div>
              <label className={labelCls}>Billing Entity <span className="text-red-400">*</span></label>
              <select
                className={inputCls}
                value={billingEntityId}
                onChange={e => setBillingEntityId(e.target.value)}
                required
              >
                <option className={optCls} value="">— Select entity —</option>
                {entities.map(e => (
                  <option className={optCls} key={e.id} value={e.id}>
                    {ENTITY_LABELS[e.entity_key] ?? e.legal_entity_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Assigned staff — admin/director only, create mode only */}
          {!isEdit && isAdminRole && (
            <div>
              <label className={labelCls}>Assigned To <span className="text-red-400">*</span></label>
              <CustomSelect
                className={inputCls}
                placeholder="— Select staff —"
                value={assignedStaffId}
                onChange={setAssignedStaffId}
                options={staffList.map(s => ({ id: s.id, label: s.name }))}
              />
            </div>
          )}

          {/* Patient info */}
          <div className="border-t border-surface-sunken pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Patient</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2">
                <label className={labelCls}>Full Name</label>
                <input className={inputCls} value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input className={inputCls} value={patientPhone} onChange={e => setPatientPhone(e.target.value)} placeholder="+44 …" />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={patientEmail} onChange={e => setPatientEmail(e.target.value)} placeholder="jane@…" />
              </div>
              <div className="min-w-0">
                <label className={labelCls}>Date of Birth</label>
                <input
                  className={`${inputCls} appearance-none box-border`}
                  type="date"
                  value={patientDob}
                  onChange={e => setPatientDob(e.target.value)}
                  style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', WebkitAppearance: 'none', appearance: 'none', textAlign: 'left', paddingTop: '0.5rem', paddingBottom: '0.5rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', minHeight: '2.375rem', lineHeight: '1.25rem' }}
                />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <input className={inputCls} value={patientAddress} onChange={e => setPatientAddress(e.target.value)} placeholder="123 High St…" />
              </div>
            </div>
          </div>

          {/* Treatment & Payment */}
          <div className="border-t border-surface-sunken pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Treatment & Payment</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Treatment Description</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={2}
                  value={treatmentDesc}
                  onChange={e => setTreatmentDesc(e.target.value)}
                  placeholder="Implant, crown, whitening…"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Total Cost (€)</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalCost}
                    onChange={e => handleTotalCostChange(e.target.value)}
                    placeholder="3500.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Amount Due (€)
                    {!amountDueDirty && totalCost && (
                      <span className="ml-1 text-gray-600 text-[10px]">= Total</span>
                    )}
                  </label>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountDue}
                    onChange={e => handleAmountDueChange(e.target.value)}
                    placeholder="1750.00"
                  />
                </div>
              </div>
              {!isEdit && (
                <div>
                  <label className={labelCls}>Deposit Amount (€)</label>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>Payment Method</label>
                <select className={inputCls} value={paymentMethod} onChange={e => handlePaymentMethodChange(e.target.value)}>
                  <option className={optCls} value="">— Select —</option>
                  {paymentMethods.map(m => <option className={optCls} key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              {/* Payer type — card, bank transfer and finance */}
              {(paymentMethod === 'card' || paymentMethod === 'bank_transfer' || paymentMethod === 'finance') && (
                <div>
                  <label className={labelCls}>Who pays?</label>
                  <div className="flex gap-5 mt-1">
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="radio"
                        name="payerType"
                        value="self"
                        checked={payerType === 'self'}
                        onChange={() => setPayerType('self')}
                      />
                      Patient pays
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="radio"
                        name="payerType"
                        value="third_party"
                        checked={payerType === 'third_party'}
                        onChange={() => setPayerType('third_party')}
                      />
                      Someone else pays
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card details — all card payments (self + third_party) */}
          {paymentMethod === 'card' && (
            <div className="border-t border-surface-sunken pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Card Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-1 sm:col-span-2">
                  <label className={labelCls}>Card Scheme</label>
                  <input className={inputCls} value={cardScheme} onChange={e => setCardScheme(e.target.value)} placeholder="Visa, Mastercard…" />
                </div>
                <div>
                  <label className={labelCls}>First 4 Digits</label>
                  <input
                    className={inputCls}
                    value={cardFirst4}
                    onChange={e => setCardFirst4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="1234"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className={labelCls}>Last 4 Digits</label>
                  <input
                    className={inputCls}
                    value={cardLast4}
                    onChange={e => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="5678"
                    maxLength={4}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Cardholder identity — third_party only */}
          {showCardholder && (
            <div className="border-t border-surface-sunken pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Cardholder</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-1 sm:col-span-2">
                  <label className={labelCls}>Cardholder Name</label>
                  <input className={inputCls} value={cardholderName} onChange={e => setCardholderName(e.target.value)} placeholder="John Smith" />
                </div>
                <div>
                  <label className={labelCls}>Relationship to Patient</label>
                  <input className={inputCls} value={cardholderRelationship} onChange={e => setCardholderRelationship(e.target.value)} placeholder="Spouse, parent…" />
                </div>
                <div>
                  <label className={labelCls}>Cardholder Phone</label>
                  <input className={inputCls} value={cardholderPhone} onChange={e => setCardholderPhone(e.target.value)} placeholder="+44 …" />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className={labelCls}>Cardholder Email</label>
                  <input className={inputCls} type="email" value={cardholderEmail} onChange={e => setCardholderEmail(e.target.value)} placeholder="john@…" />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className={labelCls}>Cardholder Address</label>
                  <input className={inputCls} value={cardholderAddress} onChange={e => setCardholderAddress(e.target.value)} placeholder="123 High St…" />
                </div>
              </div>
            </div>
          )}

          {/* Photo ID — card + third_party only */}
          {showCardholder && (
            <div className="border-t border-surface-sunken pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Photo ID</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>ID Type</label>
                  <select className={inputCls} value={photoIdType} onChange={e => setPhotoIdType(e.target.value)}>
                    <option className={optCls} value="">Select ID type…</option>
                    <option className={optCls} value="passport">Passport</option>
                    <option className={optCls} value="driving_licence">Driving licence</option>
                    <option className={optCls} value="national_id">National ID</option>
                    <option className={optCls} value="residence_permit">Residence permit</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Reference / Number</label>
                  <input className={inputCls} value={photoIdRef} onChange={e => setPhotoIdRef(e.target.value)} placeholder="AB123456" />
                </div>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="border-t border-surface-sunken pt-4">
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
              {statusOptions.map(s => <option className={optCls} key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-surface-sunken transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (!isEdit && isAdminRole && !assignedStaffId)}
              className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {submitting
                ? (isEdit ? 'Saving…' : 'Creating…')
                : (isEdit ? 'Save Changes' : 'Create Case')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

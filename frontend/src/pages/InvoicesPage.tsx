import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import {
  FileText, Plus, Search, X, Download, MoreHorizontal, Send,
  ChevronDown, Eye, Edit, Trash2, Check, CalendarDays, CreditCard,
} from 'lucide-react';
import { formatDate } from '../utils/date';

const TODAY = new Date().toISOString().slice(0, 10);

// VAT-inclusive math: Net = Total / 1.20, VAT = Total − Net (pence-level to avoid float drift)
function calcVat(amountStr: string) {
  const total = parseFloat(amountStr) || 0;
  if (!total) return null;
  const totalPence = Math.round(total * 100);
  const netPence   = Math.round(totalPence / 1.20);
  const vatPence   = totalPence - netPence;
  return {
    net: (netPence / 100).toFixed(2),
    vat: (vatPence / 100).toFixed(2),
    total: total.toFixed(2),
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoice_number: string | null;
  patient_name: string | null;
  patient_email: string | null;
  patient_address: string | null;
  treatment_description: string | null;
  amount: string;
  payment_status: 'paid' | 'unpaid';
  payment_method: string | null;
  status: 'draft' | 'finalized';
  issued_at: string;
  sent_at: string | null;
  case_id: string | null;
  lead_id: string | null;
  vat_applied: boolean;
  vat_rate: number | null;
  vat_amount: string | null;
  net_amount: string | null;
}

interface InvoiceSummary {
  paidLast30: number;
  unpaidCount: number;
  unpaidTotal: number;
  draftCount: number;
}

interface TreatmentCase {
  id: string;
  patient_name: string | null;
  patient_email: string | null;
  patient_address: string | null;
  treatment_description: string | null;
  amount_due: string | null;
  payment_method: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  card:          'Card',
  bank_transfer: 'Bank Transfer',
  finance:       'Finance',
};

const DATE_OPTIONS = [
  { value: '',       label: 'All time'     },
  { value: '7d',     label: 'Last 7 days'  },
  { value: '30d',    label: 'Last 30 days' },
  { value: 'month',  label: 'This month'   },
];

const ctrl =
  'h-10 bg-surface-sunken border border-line text-white rounded-lg px-3 text-sm ' +
  'focus:outline-none focus:border-accent transition-colors';

const EMPTY_SUMMARY: InvoiceSummary = { paidLast30: 0, unpaidCount: 0, unpaidTotal: 0, draftCount: 0 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(val: string | number | null | undefined): string {
  if (val == null || val === '') return '—';
  const n = parseFloat(String(val));
  return isNaN(n) ? '—' : `€${n.toFixed(2)}`;
}

function dateRangeBounds(range: string): { from: string; to: string } | null {
  const now = new Date();
  if (range === '7d') {
    const from = new Date(now); from.setDate(from.getDate() - 7);
    return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  if (range === '30d') {
    const from = new Date(now); from.setDate(from.getDate() - 30);
    return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  if (range === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  return null;
}

function exportCSV(rows: Invoice[]) {
  const header = ['Invoice #', 'Status', 'Date', 'Patient', 'Treatment', 'Amount', 'Payment', 'Method', 'Sent'];
  const lines  = rows.map(r => [
    r.invoice_number ?? 'Draft',
    r.status,
    formatDate(r.issued_at),
    r.patient_name ?? '',
    r.treatment_description ?? '',
    fmtGBP(r.amount),
    r.payment_status,
    METHOD_LABELS[r.payment_method ?? ''] ?? r.payment_method ?? '',
    r.sent_at ? formatDate(r.sent_at) : 'Not sent',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csv  = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.status === 'draft') {
    return (
      <span
        className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
        style={{ backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}
      >
        Draft
      </span>
    );
  }
  const cfg =
    invoice.payment_status === 'paid'
      ? { bg: '#14532d', label: 'Paid'   }
      : { bg: '#92400e', label: 'Unpaid' };
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: '#ffffff' }}>
      {cfg.label}
    </span>
  );
}

// ── Row action menu ───────────────────────────────────────────────────────────

interface RowMenuProps {
  invoice:          Invoice;
  onSend:           (inv: Invoice) => void;
  onEdit:           (inv: Invoice) => void;
  onFinalize:       (inv: Invoice) => void;
  onDelete:         (inv: Invoice) => void;
  onPaymentChanged: (inv: Invoice) => void;
}

function RowMenu({ invoice, onSend, onEdit, onFinalize, onDelete, onPaymentChanged }: RowMenuProps) {
  const [open,        setOpen]        = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(v => !v);
  }

  async function handleView() {
    setOpen(false);
    try {
      const res = await api.get(`/api/invoices/${invoice.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch {
      alert('Failed to load invoice.');
    }
  }

  async function handleDownload() {
    setOpen(false);
    try {
      const res = await api.get(`/api/invoices/${invoice.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `${invoice.invoice_number ?? 'draft-invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download PDF.');
    }
  }

  async function handleMarkPaid() {
    setOpen(false);
    setMarkingPaid(true);
    const newStatus = invoice.payment_status === 'unpaid' ? 'paid' : 'unpaid';
    try {
      const res = await api.patch<{ invoice: Invoice }>(`/api/invoices/${invoice.id}`, { paymentStatus: newStatus });
      onPaymentChanged(res.data.invoice);
    } catch {
      alert('Failed to update payment status.');
    } finally {
      setMarkingPaid(false);
    }
  }

  const isDraft = invoice.status === 'draft';

  return (
    <>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); handleToggle(); }}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-surface-sunken transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{ top: menuPos.top, right: menuPos.right }}
          className="fixed w-48 bg-surface-sunken border border-line rounded-xl shadow-xl z-50 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {isDraft ? (
            <>
              <button
                onClick={() => { setOpen(false); onEdit(invoice); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-sunken transition-colors"
              >
                <Edit size={14} /> Edit draft
              </button>
              <button
                onClick={handleView}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-sunken transition-colors"
              >
                <Eye size={14} /> Preview PDF
              </button>
              <button
                onClick={() => { setOpen(false); onFinalize(invoice); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-sunken transition-colors"
              >
                <Check size={14} /> Finalize
              </button>
              <div className="border-t border-surface-sunken" />
              <button
                onClick={() => { setOpen(false); onDelete(invoice); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-surface-sunken transition-colors"
              >
                <Trash2 size={14} /> Delete draft
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleView}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-sunken transition-colors"
              >
                <Eye size={14} /> View invoice
              </button>
              <button
                onClick={handleDownload}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-sunken transition-colors"
              >
                <Download size={14} /> Download PDF
              </button>
              {invoice.patient_email && (
                <button
                  onClick={() => { setOpen(false); onSend(invoice); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-sunken transition-colors"
                >
                  <Send size={14} /> Send email
                </button>
              )}
              <div className="border-t border-surface-sunken" />
              <button
                onClick={handleMarkPaid}
                disabled={markingPaid}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors disabled:opacity-50 ${
                  invoice.payment_status === 'unpaid'
                    ? 'text-green-400 hover:text-green-300 hover:bg-surface-sunken'
                    : 'text-amber-400 hover:text-amber-300 hover:bg-surface-sunken'
                }`}
              >
                <CreditCard size={14} />
                {markingPaid ? 'Updating…' : invoice.payment_status === 'unpaid' ? 'Mark as Paid' : 'Mark as Unpaid'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

// ── Shared input style ────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-surface-sunken border border-line text-white rounded-lg px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:border-accent transition-colors';

// ── Create Invoice Modal ──────────────────────────────────────────────────────

interface CreateModalProps {
  onClose:   () => void;
  onCreated: (inv: Invoice, msg: string) => void;
}

function CreateInvoiceModal({ onClose, onCreated }: CreateModalProps) {
  const [tab,          setTab]          = useState<'case' | 'manual'>('case');
  const [cases,        setCases]        = useState<TreatmentCase[]>([]);
  const [caseSearch,   setCaseSearch]   = useState('');
  const [selectedCase, setSelectedCase] = useState<TreatmentCase | null>(null);

  const [patientName,  setPatientName]  = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientAddr,  setPatientAddr]  = useState('');
  const [description,  setDescription]  = useState('');
  const [amount,       setAmount]       = useState('');
  const [payStatus,    setPayStatus]    = useState<'unpaid' | 'paid'>('unpaid');
  const [payMethod,    setPayMethod]    = useState('card');
  const [invoiceDate,  setInvoiceDate]  = useState(TODAY);
  const [vatApplied,   setVatApplied]   = useState(false);

  const vatBreakdown = vatApplied ? calcVat(amount) : null;

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => {
    api.get<{ cases: TreatmentCase[] }>('/api/cases')
      .then(r => setCases(r.data.cases))
      .catch(() => {});
  }, []);

  const filteredCases = useMemo(() => {
    if (!caseSearch) return cases;
    const q = caseSearch.toLowerCase();
    return cases.filter(c =>
      (c.patient_name ?? '').toLowerCase().includes(q) ||
      (c.treatment_description ?? '').toLowerCase().includes(q),
    );
  }, [cases, caseSearch]);

  function selectCase(c: TreatmentCase) {
    setSelectedCase(c);
    setPatientName(c.patient_name ?? '');
    setPatientEmail(c.patient_email ?? '');
    setPatientAddr(c.patient_address ?? '');
    setDescription(c.treatment_description ?? '');
    setAmount(c.amount_due ?? '');
    setPayMethod(c.payment_method ?? 'card');
  }

  async function submit(mode: 'draft' | 'create' | 'send') {
    setError('');
    const saveAsDraft = mode === 'draft';

    if (!saveAsDraft) {
      if (!patientName.trim()) { setError('Patient name is required.'); return; }
      if (!amount || isNaN(parseFloat(amount))) { setError('A valid amount is required.'); return; }
      if (mode === 'send' && !patientEmail.trim()) {
        setError('Patient email is required to send the invoice.'); return;
      }
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        patientName:          patientName.trim() || undefined,
        patientEmail:         patientEmail.trim() || undefined,
        patientAddress:       patientAddr.trim()  || undefined,
        treatmentDescription: description.trim()  || undefined,
        amount:               amount ? parseFloat(amount) : undefined,
        paymentStatus:        payStatus,
        paymentMethod:        payMethod,
        sendEmail:            mode === 'send',
        saveAsDraft,
        issuedAt:             invoiceDate || undefined,
        vatApplied,
      };
      if (tab === 'case' && selectedCase) body.caseId = selectedCase.id;

      const res = await api.post<{ invoice: Invoice }>('/api/invoices', body);
      const inv = res.data.invoice;
      const msg =
        saveAsDraft
          ? `Draft saved for ${inv.patient_name ?? 'patient'}.`
          : mode === 'send'
            ? `Invoice ${inv.invoice_number} created and sent to ${inv.patient_email}.`
            : `Invoice ${inv.invoice_number} created.`;
      onCreated(inv, msg);
      onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create invoice.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-line shrink-0">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <FileText size={18} className="text-accent" /> Create Invoice
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex px-6 pt-4 gap-3 shrink-0">
          {(['case', 'manual'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-surface-sunken text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'case' ? 'From treatment case' : 'Manual entry'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {tab === 'case' && (
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Select treatment case</label>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={caseSearch}
                  onChange={e => setCaseSearch(e.target.value)}
                  placeholder="Search cases…"
                  className={`${inputCls} pl-8`}
                />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 border border-surface-sunken rounded-lg p-1">
                {filteredCases.length === 0 && (
                  <p className="text-gray-500 text-sm px-2 py-3 text-center">No cases found</p>
                )}
                {filteredCases.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectCase(c)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedCase?.id === c.id
                        ? 'bg-accent/20 border border-accent/40 text-white'
                        : 'text-gray-300 hover:bg-surface-sunken'
                    }`}
                  >
                    <span className="font-medium">{c.patient_name ?? '—'}</span>
                    {c.treatment_description && (
                      <span className="text-gray-500 ml-2 text-xs">{c.treatment_description}</span>
                    )}
                    {c.amount_due && (
                      <span className="float-right text-gray-400 text-xs">{fmtGBP(c.amount_due)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Patient name <span className="text-red-400">*</span></label>
              <input value={patientName} onChange={e => setPatientName(e.target.value)} className={inputCls} placeholder="John Smith" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Email</label>
              <input value={patientEmail} onChange={e => setPatientEmail(e.target.value)} type="email" className={inputCls} placeholder="john@example.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Amount (€) <span className="text-red-400">*</span></label>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" min="0" className={inputCls} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Address</label>
              <input value={patientAddr} onChange={e => setPatientAddr(e.target.value)} className={inputCls} placeholder="42 Baker St, London, W1U 7AJ" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Treatment description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} placeholder="Composite filling — upper left molar" />
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-2">Payment status</label>
              <div className="flex gap-3">
                {(['unpaid', 'paid'] as const).map(s => (
                  <label key={s} className="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="radio" name="payStatus" value={s}
                      checked={payStatus === s} onChange={() => setPayStatus(s)}
                      className="accent-accent"
                    />
                    {s === 'paid' ? 'Paid' : 'Unpaid'}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Payment method</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={ctrl + ' w-full'}>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="finance">Finance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5">Invoice date</label>
            <input
              type="date" value={invoiceDate} max={TODAY}
              onChange={e => setInvoiceDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* VAT toggle */}
          <div className="rounded-lg border border-line bg-surface-sunken/50 px-4 py-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setVatApplied(v => !v)}
                className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${vatApplied ? 'bg-accent' : 'bg-line'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${vatApplied ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm text-gray-300 font-medium">Apply 20% VAT (inclusive)</span>
            </label>
            {vatApplied && vatBreakdown && (
              <div className="mt-2.5 ml-12 text-xs space-y-0.5">
                <div className="flex justify-between text-gray-400">
                  <span>Net (ex. VAT)</span>
                  <span>€{vatBreakdown.net}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>VAT (20%)</span>
                  <span>€{vatBreakdown.vat}</span>
                </div>
                <div className="flex justify-between text-white font-medium border-t border-line pt-0.5 mt-1">
                  <span>Total</span>
                  <span>€{vatBreakdown.total}</span>
                </div>
              </div>
            )}
            {vatApplied && !vatBreakdown && (
              <p className="mt-1.5 ml-12 text-xs text-gray-500">Enter an amount above to see the VAT breakdown.</p>
            )}
            {!vatApplied && (
              <p className="mt-1.5 ml-12 text-xs text-gray-500">Not applicable for VAT-exempt entities (VATA 1994, Group 7).</p>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-line shrink-0">
          <button
            onClick={() => submit('draft')}
            disabled={submitting}
            className="px-4 bg-surface-sunken hover:bg-line text-gray-300 hover:text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            Save as Draft
          </button>
          <button
            onClick={() => submit('create')}
            disabled={submitting}
            className="flex-1 bg-accent hover:bg-accent-hover text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
          <button
            onClick={() => submit('send')}
            disabled={submitting}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            <Send size={14} /> {submitting ? 'Creating…' : 'Create & Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Draft Modal ──────────────────────────────────────────────────────────

interface EditModalProps {
  invoice:   Invoice;
  onClose:   () => void;
  onUpdated: (inv: Invoice) => void;
}

function EditInvoiceModal({ invoice, onClose, onUpdated }: EditModalProps) {
  const [patientName,  setPatientName]  = useState(invoice.patient_name  ?? '');
  const [patientEmail, setPatientEmail] = useState(invoice.patient_email ?? '');
  const [patientAddr,  setPatientAddr]  = useState(invoice.patient_address ?? '');
  const [description,  setDescription]  = useState(invoice.treatment_description ?? '');
  const [amount,       setAmount]       = useState(invoice.amount ?? '');
  const [payStatus,    setPayStatus]    = useState<'unpaid' | 'paid'>(invoice.payment_status);
  const [payMethod,    setPayMethod]    = useState(invoice.payment_method ?? 'card');
  const [invoiceDate,  setInvoiceDate]  = useState(invoice.issued_at?.slice(0, 10) ?? TODAY);
  const [vatApplied,   setVatApplied]   = useState(invoice.vat_applied ?? false);

  const vatBreakdown = vatApplied ? calcVat(amount) : null;

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  async function handleSave() {
    setError('');
    if (!patientName.trim()) { setError('Patient name is required.'); return; }
    if (!amount || isNaN(parseFloat(amount))) { setError('A valid amount is required.'); return; }

    setSubmitting(true);
    try {
      const res = await api.patch<{ invoice: Invoice }>(`/api/invoices/${invoice.id}`, {
        patientName:          patientName.trim(),
        patientEmail:         patientEmail.trim() || null,
        patientAddress:       patientAddr.trim()  || null,
        treatmentDescription: description.trim()  || null,
        amount:               parseFloat(amount),
        paymentStatus:        payStatus,
        paymentMethod:        payMethod,
        issuedAt:             invoiceDate || undefined,
        vatApplied,
      });
      onUpdated(res.data.invoice);
      onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save changes.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-line shrink-0">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <Edit size={18} className="text-accent" /> Edit Draft
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Patient name <span className="text-red-400">*</span></label>
              <input value={patientName} onChange={e => setPatientName(e.target.value)} className={inputCls} placeholder="John Smith" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Email</label>
              <input value={patientEmail} onChange={e => setPatientEmail(e.target.value)} type="email" className={inputCls} placeholder="john@example.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Amount (€) <span className="text-red-400">*</span></label>
              <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" min="0" className={inputCls} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Address</label>
              <input value={patientAddr} onChange={e => setPatientAddr(e.target.value)} className={inputCls} placeholder="42 Baker St, London, W1U 7AJ" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Treatment description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} placeholder="Composite filling — upper left molar" />
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-2">Payment status</label>
              <div className="flex gap-3">
                {(['unpaid', 'paid'] as const).map(s => (
                  <label key={s} className="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="radio" name="editPayStatus" value={s}
                      checked={payStatus === s} onChange={() => setPayStatus(s)}
                      className="accent-accent"
                    />
                    {s === 'paid' ? 'Paid' : 'Unpaid'}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Payment method</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={ctrl + ' w-full'}>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="finance">Finance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 font-medium mb-1.5">Invoice date</label>
            <input
              type="date" value={invoiceDate} max={TODAY}
              onChange={e => setInvoiceDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* VAT toggle */}
          <div className="rounded-lg border border-line bg-surface-sunken/50 px-4 py-3">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setVatApplied(v => !v)}
                className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${vatApplied ? 'bg-accent' : 'bg-line'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${vatApplied ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm text-gray-300 font-medium">Apply 20% VAT (inclusive)</span>
            </label>
            {vatApplied && vatBreakdown && (
              <div className="mt-2.5 ml-12 text-xs space-y-0.5">
                <div className="flex justify-between text-gray-400">
                  <span>Net (ex. VAT)</span>
                  <span>€{vatBreakdown.net}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>VAT (20%)</span>
                  <span>€{vatBreakdown.vat}</span>
                </div>
                <div className="flex justify-between text-white font-medium border-t border-line pt-0.5 mt-1">
                  <span>Total</span>
                  <span>€{vatBreakdown.total}</span>
                </div>
              </div>
            )}
            {vatApplied && !vatBreakdown && (
              <p className="mt-1.5 ml-12 text-xs text-gray-500">Enter an amount above to see the VAT breakdown.</p>
            )}
            {!vatApplied && (
              <p className="mt-1.5 ml-12 text-xs text-gray-500">Not applicable for VAT-exempt entities (VATA 1994, Group 7).</p>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-line shrink-0">
          <button onClick={onClose} disabled={submitting}
            className="px-5 bg-surface-sunken hover:bg-line text-gray-300 hover:text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60">
            Cancel
          </button>
          <button onClick={handleSave} disabled={submitting}
            className="flex-1 bg-accent hover:bg-accent-hover text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60">
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Finalize confirm modal ────────────────────────────────────────────────────

interface FinalizeModalProps {
  invoice:     Invoice;
  onClose:     () => void;
  onFinalized: (inv: Invoice, msg: string) => void;
}

function ConfirmFinalizeModal({ invoice, onClose, onFinalized }: FinalizeModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  async function handleFinalize(sendEmail: boolean) {
    setError(''); setSubmitting(true);
    try {
      const res = await api.post<{ invoice: Invoice }>(`/api/invoices/${invoice.id}/finalize`, { sendEmail });
      const inv = res.data.invoice;
      const msg = sendEmail
        ? `Invoice ${inv.invoice_number} finalized and sent to ${inv.patient_email}.`
        : `Invoice ${inv.invoice_number} finalized.`;
      onFinalized(inv, msg);
      onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to finalize invoice.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
            <Check size={18} className="text-accent" />
          </div>
          <div>
            <p className="text-white font-semibold">Finalize invoice?</p>
            <p className="text-gray-400 text-sm">This cannot be undone.</p>
          </div>
        </div>

        <div className="bg-surface-sunken rounded-xl px-4 py-3 mb-4 text-sm space-y-1">
          <p className="text-white font-medium">{invoice.patient_name ?? '—'}</p>
          <p className="text-gray-400">{fmtGBP(invoice.amount)}</p>
          {invoice.treatment_description && (
            <p className="text-gray-500 text-xs">{invoice.treatment_description}</p>
          )}
        </div>

        <p className="text-gray-500 text-xs mb-4">
          An invoice number will be assigned. Finalized invoices are locked and cannot be edited.
        </p>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <div className="flex flex-col gap-3">
          {invoice.patient_email && (
            <button
              onClick={() => handleFinalize(true)}
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              <Send size={14} /> {submitting ? 'Finalizing…' : 'Finalize & Send'}
            </button>
          )}
          <button
            onClick={() => handleFinalize(false)}
            disabled={submitting}
            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {submitting ? 'Finalizing…' : 'Finalize'}
          </button>
          <button onClick={onClose} disabled={submitting}
            className="w-full bg-surface-sunken hover:bg-line text-gray-300 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete draft confirm modal ────────────────────────────────────────────────

interface DeleteModalProps {
  invoice:   Invoice;
  onClose:   () => void;
  onDeleted: (id: string) => void;
}

function ConfirmDeleteModal({ invoice, onClose, onDeleted }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState('');

  async function handleDelete() {
    setError(''); setDeleting(true);
    try {
      await api.delete(`/api/invoices/${invoice.id}`);
      onDeleted(invoice.id);
      onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to delete draft.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Delete draft?</p>
            <p className="text-gray-400 text-sm">This cannot be undone.</p>
          </div>
        </div>
        <p className="text-gray-400 text-sm mb-1">
          <span className="text-white font-medium">{invoice.patient_name ?? 'Draft invoice'}</span>
          {invoice.amount ? ` — ${fmtGBP(invoice.amount)}` : ''}
        </p>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} disabled={deleting}
            className="flex-1 bg-surface-sunken hover:bg-line text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Send email confirm (re-send) ──────────────────────────────────────────────

function SendConfirmModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const [sending, setSending] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleSend() {
    setSending(true);
    try {
      await api.post(`/api/invoices`, {
        patientName:          invoice.patient_name,
        patientEmail:         invoice.patient_email,
        amount:               invoice.amount,
        paymentStatus:        invoice.payment_status,
        paymentMethod:        invoice.payment_method,
        treatmentDescription: invoice.treatment_description,
        sendEmail: true,
      });
      setDone(true);
    } catch {
      setError('Failed to send email.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-sm shadow-2xl p-6">
        {done ? (
          <>
            <p className="text-white font-semibold mb-2">Invoice sent</p>
            <p className="text-gray-400 text-sm mb-5">Email delivered to {invoice.patient_email}.</p>
            <button onClick={onClose} className="w-full bg-surface-sunken hover:bg-line text-white py-2.5 rounded-lg text-sm font-medium transition-colors">Close</button>
          </>
        ) : (
          <>
            <p className="text-white font-semibold mb-2">Send invoice by email?</p>
            <p className="text-gray-400 text-sm mb-1">{invoice.invoice_number} — {fmtGBP(invoice.amount)}</p>
            <p className="text-gray-500 text-sm mb-5">To: {invoice.patient_email}</p>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} disabled={sending} className="flex-1 bg-surface-sunken hover:bg-line text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60">Cancel</button>
              <button onClick={handleSend} disabled={sending} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Invoice detail modal (read-only) ─────────────────────────────────────────

interface DetailModalProps {
  invoice:          Invoice;
  onClose:          () => void;
  onEdit:           (inv: Invoice) => void;
  onFinalize:       (inv: Invoice) => void;
  onDelete:         (inv: Invoice) => void;
  onSend:           (inv: Invoice) => void;
  onDateChanged:    (inv: Invoice) => void;
  onPaymentChanged: (inv: Invoice) => void;
}

function InvoiceDetailModal({ invoice, onClose, onEdit, onFinalize, onDelete, onSend, onDateChanged, onPaymentChanged }: DetailModalProps) {
  const [showDateEdit,   setShowDateEdit]   = useState(false);
  const [editDateVal,    setEditDateVal]    = useState('');
  const [dateSubmitting, setDateSubmitting] = useState(false);
  const [dateError,      setDateError]      = useState('');

  const [showPayEdit,   setShowPayEdit]   = useState(false);
  const [editPayStatus, setEditPayStatus] = useState<'paid' | 'unpaid'>(invoice.payment_status);
  const [editPayMethod, setEditPayMethod] = useState(invoice.payment_method ?? 'card');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError,      setPayError]      = useState('');

  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSaveDate() {
    setDateError('');
    setDateSubmitting(true);
    try {
      const res = await api.patch<{ invoice: Invoice }>(`/api/invoices/${invoice.id}`, { issuedAt: editDateVal });
      onDateChanged(res.data.invoice);
      setShowDateEdit(false);
    } catch (err: unknown) {
      setDateError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to update date.');
    } finally {
      setDateSubmitting(false);
    }
  }

  async function handleSavePayment() {
    setPayError('');
    setPaySubmitting(true);
    try {
      const res = await api.patch<{ invoice: Invoice }>(`/api/invoices/${invoice.id}`, {
        paymentStatus: editPayStatus,
        paymentMethod: editPayMethod,
      });
      onPaymentChanged(res.data.invoice);
      setShowPayEdit(false);
    } catch (err: unknown) {
      setPayError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to update payment.');
    } finally {
      setPaySubmitting(false);
    }
  }

  async function handleViewPdf() {
    try {
      const res = await api.get(`/api/invoices/${invoice.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch {
      alert('Failed to load PDF.');
    }
  }

  async function handleDownloadPdf() {
    try {
      const res = await api.get(`/api/invoices/${invoice.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `${invoice.invoice_number ?? 'draft-invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download PDF.');
    }
  }

  const isDraft = invoice.status === 'draft';

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Invoice #',       value: invoice.invoice_number ?? <span className="text-gray-600 italic">Not yet assigned (Draft)</span> },
    { label: 'Status',          value: <StatusBadge invoice={invoice} /> },
    { label: 'Patient',         value: invoice.patient_name ?? '—' },
    { label: 'Email',           value: invoice.patient_email ?? '—' },
    { label: 'Address',         value: invoice.patient_address ?? '—' },
    { label: 'Treatment',       value: invoice.treatment_description ?? '—' },
    { label: 'Amount',          value: <span className="font-semibold text-white">{fmtGBP(invoice.amount)}</span> },
    { label: 'Payment method',  value: METHOD_LABELS[invoice.payment_method ?? ''] ?? '—' },
    { label: 'Issued',          value: formatDate(invoice.issued_at) },
    ...(invoice.sent_at ? [{ label: 'Email sent', value: formatDate(invoice.sent_at) }] : []),
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-line shrink-0">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <FileText size={18} className="text-accent" />
            {invoice.invoice_number ?? 'Draft Invoice'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Fields */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          <dl className="space-y-3">
            {fields.map(f => (
              <div key={f.label} className="flex items-start gap-3">
                <dt className="text-xs text-gray-500 font-medium w-32 shrink-0 pt-0.5">{f.label}</dt>
                <dd className="text-sm text-gray-300 flex-1">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-line shrink-0 space-y-2">
          {/* PDF row */}
          <div className="flex gap-2">
            <button
              onClick={handleViewPdf}
              className="flex-1 flex items-center justify-center gap-1.5 bg-surface-sunken hover:bg-line text-gray-300 hover:text-white py-2 rounded-lg text-sm transition-colors"
            >
              <Eye size={14} /> View PDF
            </button>
            <button
              onClick={handleDownloadPdf}
              className="flex-1 flex items-center justify-center gap-1.5 bg-surface-sunken hover:bg-line text-gray-300 hover:text-white py-2 rounded-lg text-sm transition-colors"
            >
              <Download size={14} /> Download
            </button>
          </div>

          {/* Draft actions */}
          {isDraft && (
            <div className="flex gap-2">
              <button
                onClick={() => { onClose(); onEdit(invoice); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-surface-sunken hover:bg-line text-gray-300 hover:text-white py-2 rounded-lg text-sm transition-colors"
              >
                <Edit size={14} /> Edit
              </button>
              <button
                onClick={() => { onClose(); onFinalize(invoice); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                <Check size={14} /> Finalize
              </button>
              <button
                onClick={() => { onClose(); onDelete(invoice); }}
                className="w-9 flex items-center justify-center bg-surface-sunken hover:bg-red-900/40 text-red-400 hover:text-red-300 py-2 rounded-lg text-sm transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          {/* Finalized: send email */}
          {!isDraft && invoice.patient_email && (
            <button
              onClick={() => { onClose(); onSend(invoice); }}
              className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              <Send size={14} /> Send email
            </button>
          )}

          {/* Finalized: change date only */}
          {!isDraft && (
            showDateEdit ? (
              <div className="space-y-2 p-3 bg-surface-sunken rounded-lg border border-line">
                <p className="text-xs text-amber-400">Only the invoice date can be changed. Amount and patient details are locked.</p>
                <input
                  type="date" value={editDateVal} max={TODAY}
                  onChange={e => setEditDateVal(e.target.value)}
                  className="w-full bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
                {dateError && <p className="text-red-400 text-xs">{dateError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDateEdit(false); setDateError(''); }}
                    disabled={dateSubmitting}
                    className="flex-1 bg-surface-sunken hover:bg-line text-gray-300 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDate}
                    disabled={dateSubmitting || !editDateVal}
                    className="flex-1 bg-accent hover:bg-accent/90 text-white font-medium py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                  >
                    {dateSubmitting ? 'Saving…' : 'Save date'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setShowDateEdit(true); setEditDateVal(invoice.issued_at?.slice(0, 10) ?? TODAY); }}
                className="w-full flex items-center justify-center gap-1.5 bg-surface-sunken hover:bg-line text-gray-300 hover:text-white py-2 rounded-lg text-sm transition-colors"
              >
                <CalendarDays size={14} /> Change date
              </button>
            )
          )}

          {/* Finalized: change payment status / method */}
          {!isDraft && (
            showPayEdit ? (
              <div className="space-y-2 p-3 bg-surface-sunken rounded-lg border border-line">
                <p className="text-xs text-amber-400">Amount and patient details are locked. Payment status and method can be updated.</p>
                <div className="flex gap-3">
                  {(['unpaid', 'paid'] as const).map(s => (
                    <label key={s} className="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="radio" name="detailPayStatus" value={s}
                        checked={editPayStatus === s} onChange={() => setEditPayStatus(s)}
                        className="accent-accent"
                      />
                      {s === 'paid' ? 'Paid' : 'Unpaid'}
                    </label>
                  ))}
                </div>
                <select
                  value={editPayMethod}
                  onChange={e => setEditPayMethod(e.target.value)}
                  className="w-full bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent/50"
                >
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="finance">Finance</option>
                </select>
                {payError && <p className="text-red-400 text-xs">{payError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowPayEdit(false); setPayError(''); }}
                    disabled={paySubmitting}
                    className="flex-1 bg-surface-sunken hover:bg-line text-gray-300 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePayment}
                    disabled={paySubmitting}
                    className="flex-1 bg-accent hover:bg-accent/90 text-white font-medium py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                  >
                    {paySubmitting ? 'Saving…' : 'Save payment'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setShowPayEdit(true); setEditPayStatus(invoice.payment_status); setEditPayMethod(invoice.payment_method ?? 'card'); }}
                className="w-full flex items-center justify-center gap-1.5 bg-surface-sunken hover:bg-line text-gray-300 hover:text-white py-2 rounded-lg text-sm transition-colors"
              >
                <CreditCard size={14} /> Change payment
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { user } = useAuth();

  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [summary,   setSummary]   = useState<InvoiceSummary>(EMPTY_SUMMARY);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const [showModal,      setShowModal]      = useState(false);
  const [detailTarget,   setDetailTarget]   = useState<Invoice | null>(null);
  const [sendTarget,     setSendTarget]     = useState<Invoice | null>(null);
  const [editTarget,     setEditTarget]     = useState<Invoice | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<Invoice | null>(null);
  const [deleteTarget,   setDeleteTarget]   = useState<Invoice | null>(null);

  const [toast,    setToast]    = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }

  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [methodFilter,  setMethodFilter]  = useState('');
  const [dateRange,     setDateRange]     = useState('');

  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExport) return;
    function h(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showExport]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<{ invoices: Invoice[]; summary: InvoiceSummary }>('/api/invoices');
      setInvoices(res.data.invoices ?? []);
      setSummary(res.data.summary ?? EMPTY_SUMMARY);
    } catch {
      setError('Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const filtered = useMemo(() => {
    const bounds = dateRange ? dateRangeBounds(dateRange) : null;
    return invoices.filter(inv => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !(inv.patient_name ?? '').toLowerCase().includes(q) &&
          !(inv.invoice_number ?? '').toLowerCase().includes(q)
        ) return false;
      }
      if (statusFilter === 'draft') {
        if (inv.status !== 'draft') return false;
      } else if (statusFilter) {
        if (inv.payment_status !== statusFilter || inv.status !== 'finalized') return false;
      }
      if (methodFilter && inv.payment_method !== methodFilter) return false;
      if (bounds) {
        const d = (inv.issued_at ?? '').slice(0, 10);
        if (!d || d < bounds.from || d > bounds.to) return false;
      }
      return true;
    });
  }, [invoices, search, statusFilter, methodFilter, dateRange]);

  const hasFilters = !!(search || statusFilter || methodFilter || dateRange);

  function clearFilters() { setSearch(''); setStatusFilter(''); setMethodFilter(''); setDateRange(''); }

  function handleCreated(inv: Invoice, msg: string) {
    setInvoices(prev => [inv, ...prev]);
    if (inv.status === 'draft') {
      setSummary(prev => ({ ...prev, draftCount: prev.draftCount + 1 }));
    } else {
      setSummary(prev => ({
        ...prev,
        unpaidCount: inv.payment_status === 'unpaid' ? prev.unpaidCount + 1 : prev.unpaidCount,
        unpaidTotal: inv.payment_status === 'unpaid'
          ? prev.unpaidTotal + parseFloat(inv.amount) : prev.unpaidTotal,
      }));
    }
    showToast(msg);
  }

  function handleUpdated(inv: Invoice) {
    setInvoices(prev => prev.map(i => i.id === inv.id ? inv : i));
    showToast('Draft saved.');
  }

  function handleFinalized(inv: Invoice, msg: string) {
    setInvoices(prev => prev.map(i => i.id === inv.id ? inv : i));
    setSummary(prev => ({
      ...prev,
      draftCount:  Math.max(0, prev.draftCount - 1),
      unpaidCount: inv.payment_status === 'unpaid' ? prev.unpaidCount + 1 : prev.unpaidCount,
      unpaidTotal: inv.payment_status === 'unpaid'
        ? prev.unpaidTotal + parseFloat(inv.amount) : prev.unpaidTotal,
    }));
    showToast(msg);
  }

  function handleDeleted(id: string) {
    setInvoices(prev => prev.filter(i => i.id !== id));
    setSummary(prev => ({ ...prev, draftCount: Math.max(0, prev.draftCount - 1) }));
    showToast('Draft deleted.');
  }

  function handleDateChanged(inv: Invoice) {
    setInvoices(prev => prev.map(i => i.id === inv.id ? inv : i));
    setDetailTarget(inv);
    showToast('Invoice date updated.');
  }

  function handlePaymentChanged(inv: Invoice) {
    const old = invoices.find(i => i.id === inv.id);
    setInvoices(prev => prev.map(i => i.id === inv.id ? inv : i));
    if (old && old.payment_status !== inv.payment_status) {
      const amount = parseFloat(inv.amount);
      setSummary(s => inv.payment_status === 'paid'
        ? { ...s, unpaidCount: Math.max(0, s.unpaidCount - 1), unpaidTotal: Math.max(0, s.unpaidTotal - amount) }
        : { ...s, unpaidCount: s.unpaidCount + 1, unpaidTotal: s.unpaidTotal + amount },
      );
    }
    setDetailTarget(prev => prev?.id === inv.id ? inv : prev);
    showToast(inv.payment_status === 'paid' ? 'Invoice marked as paid.' : 'Invoice marked as unpaid.');
  }

  const canCreate = user && ['director', 'clinic_admin', 'treatment_coordinator', 'admin', 'super_admin'].includes(user.role);

  return (
    <div className="min-h-screen bg-surface-page text-white">
      {/* Page header */}
      <div className="px-6 py-6 border-b border-surface-sunken">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Invoices</h1>
            <p className="text-gray-400 text-sm mt-0.5">UK-standard invoices for dental treatments</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Plus size={16} /> Create Invoice
            </button>
          )}
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl">
          <div className="bg-surface-sunken border border-line rounded-xl px-5 py-4">
            <p className="text-gray-400 text-xs font-medium mb-1">Paid — Last 30 days</p>
            <p className="text-2xl font-bold text-green-400">{fmtGBP(summary.paidLast30)}</p>
          </div>
          <div className="bg-surface-sunken border border-line rounded-xl px-5 py-4">
            <p className="text-gray-400 text-xs font-medium mb-1">Unpaid ({summary.unpaidCount})</p>
            <p className="text-2xl font-bold text-amber-400">{fmtGBP(summary.unpaidTotal)}</p>
          </div>
          <div className="bg-surface-sunken border border-line rounded-xl px-5 py-4">
            <p className="text-gray-400 text-xs font-medium mb-1">Drafts</p>
            <p className="text-2xl font-bold text-slate-400">{summary.draftCount}</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-4 border-b border-surface-sunken flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or invoice #…"
            className={ctrl + ' pl-8 w-full'}
          />
        </div>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={ctrl}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>

        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} className={ctrl}>
          <option value="">All methods</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="finance">Finance</option>
        </select>

        <div className="relative">
          <select value={dateRange} onChange={e => setDateRange(e.target.value)} className={ctrl + ' pr-8 appearance-none'}>
            {DATE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors">
            <X size={14} /> Clear
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setShowExport(v => !v)}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 h-10 px-3 bg-surface-sunken border border-line text-gray-300 hover:text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <Download size={14} /> Export
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-surface-sunken border border-line rounded-xl shadow-xl z-10 overflow-hidden">
                <button
                  onClick={() => { exportCSV(filtered); setShowExport(false); }}
                  className="w-full px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface-sunken transition-colors text-left"
                >
                  CSV (.csv)
                </button>
              </div>
            )}
          </div>

          <span className="text-gray-500 text-sm">
            <span className="text-white font-semibold">{filtered.length}</span> invoice{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText size={40} className="text-ink-subtle mb-4" />
            <p className="text-gray-400 font-medium">No invoices yet</p>
            {!hasFilters && canCreate && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Plus size={14} /> Create your first invoice
              </button>
            )}
            {hasFilters && (
              <button onClick={clearFilters} className="mt-3 text-sm text-gray-400 hover:text-white transition-colors">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-sunken">
                  {['Date', 'Customer', 'Payment Method', 'Treatment', 'Status', 'Amount', ''].map(h => (
                    <th key={h} className="text-left text-xs text-gray-400 font-medium pb-3 pr-4 last:pr-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-sunken">
                {filtered.map(inv => (
                  <tr
                    key={inv.id}
                    onClick={() => setDetailTarget(inv)}
                    className="hover:bg-surface-sunken/40 transition-colors group cursor-pointer"
                  >
                    <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">{formatDate(inv.issued_at)}</td>
                    <td className="py-3 pr-4 font-medium max-w-[180px]">
                      <span className="block truncate">{inv.patient_name ?? '—'}</span>
                      {inv.patient_email && (
                        <span className="block text-xs text-gray-500 truncate">{inv.patient_email}</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-400 whitespace-nowrap text-sm">
                      {METHOD_LABELS[inv.payment_method ?? ''] ?? '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-400 max-w-[200px]">
                      <span className="block truncate">{inv.treatment_description ?? '—'}</span>
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <StatusBadge invoice={inv} />
                    </td>
                    <td className="py-3 pr-4 font-semibold whitespace-nowrap">{fmtGBP(inv.amount)}</td>
                    <td className="py-3">
                      <RowMenu
                        invoice={inv}
                        onSend={setSendTarget}
                        onEdit={setEditTarget}
                        onFinalize={setFinalizeTarget}
                        onDelete={setDeleteTarget}
                        onPaymentChanged={handlePaymentChanged}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <CreateInvoiceModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
      {detailTarget && (
        <InvoiceDetailModal
          invoice={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={inv => { setDetailTarget(null); setEditTarget(inv); }}
          onFinalize={inv => { setDetailTarget(null); setFinalizeTarget(inv); }}
          onDelete={inv => { setDetailTarget(null); setDeleteTarget(inv); }}
          onSend={inv => { setDetailTarget(null); setSendTarget(inv); }}
          onDateChanged={handleDateChanged}
          onPaymentChanged={handlePaymentChanged}
        />
      )}
      {sendTarget && (
        <SendConfirmModal invoice={sendTarget} onClose={() => setSendTarget(null)} />
      )}
      {editTarget && (
        <EditInvoiceModal
          invoice={editTarget}
          onClose={() => setEditTarget(null)}
          onUpdated={inv => { handleUpdated(inv); setEditTarget(null); }}
        />
      )}
      {finalizeTarget && (
        <ConfirmFinalizeModal
          invoice={finalizeTarget}
          onClose={() => setFinalizeTarget(null)}
          onFinalized={(inv, msg) => { handleFinalized(inv, msg); setFinalizeTarget(null); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          invoice={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={id => { handleDeleted(id); setDeleteTarget(null); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-green-900 border border-green-700 text-white px-5 py-3 rounded-xl shadow-xl z-50 text-sm font-medium max-w-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

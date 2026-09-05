import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { ApiLead, Message } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, Phone, Mail, Globe, User, MessageCircle, Pencil,
  CheckSquare, Square, FileText, CreditCard, Briefcase, X, Check, Plus,
  Lock, MoreHorizontal, Send, Upload, Trash2, ExternalLink,
} from 'lucide-react';
import { formatDate } from '../utils/date';
import { Deal, DealModal } from '../components/DealsTab';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadCase {
  id: string;
  patient_name: string | null;
  treatment_description: string | null;
  amount_due: string | null;
  payment_method: string | null;
  status: string;
  paid_at: string | null;
  signed_at: string | null;
  signwell_document_id: string | null;
  created_at: string;
}

interface LeadDeal {
  id: string;
  lead_id: string | null;
  patient_name: string | null;
  patient_email: string | null;
  patient_phone: string | null;
  treatment_category: string;
  treatment_name: string | null;
  agreed_amount: string | null;
  deposit_amount: string;
  balance_due_date: string | null;
  expected_start_date: string | null;
  status: string;
  deal_date: string;
  staff_first_name: string | null;
  staff_last_name: string | null;
  staff_role: string | null;
  billing_entity_id: string | null;
  billing_entity_key: string | null;
  billing_entity_name: string | null;
  commission_locked: boolean;
  assigned_staff_id: string | null;
  notes: string | null;
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

interface AiFlag { severity: 'high' | 'medium' | 'low'; issue: string; }

interface ChecklistItem {
  item_key: string;
  checked: boolean;
  checked_by_name: string | null;
  checked_at: string | null;
}

interface PatientDocument {
  id: string;
  doc_type: string;
  file_path: string;
  original_name: string | null;
  mime_type: string | null;
  uploaded_at: string;
  uploaded_by_name: string | null;
  url: string | null;
  verification_status: 'unreviewed' | 'flagged' | 'human_approved' | 'rejected';
  ai_flags: AiFlag[] | null;
  ai_analysis: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
}

interface SalesUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'new',       label: 'New'       },
  { value: 'contacted', label: 'Contacted' },
  { value: 'responded', label: 'Responded' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'booked',    label: 'Booked'    },
  { value: 'attended',  label: 'Attended'  },
  { value: 'lost',      label: 'Lost'      },
  { value: 'archived',  label: 'Archived'  },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: '🇬🇧 English' },
  { value: 'tr', label: '🇹🇷 Turkish' },
  { value: 'ar', label: '🇸🇦 Arabic'  },
  { value: 'es', label: '🇪🇸 Spanish' },
  { value: 'ru', label: '🇷🇺 Russian' },
];

const STATUS_STYLES: Record<string, string> = {
  new:       'bg-blue-900 text-blue-300 border border-blue-700',
  contacted: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
  responded: 'bg-purple-900 text-purple-300 border border-purple-700',
  qualified: 'bg-cyan-900 text-cyan-300 border border-cyan-700',
  booked:    'bg-green-900 text-green-300 border border-green-700',
  attended:  'bg-emerald-900 text-emerald-300 border border-emerald-700',
  lost:      'bg-red-900 text-red-300 border border-red-700',
  archived:  'bg-gray-800 text-gray-400 border border-gray-600',
};

const CASE_STATUS_STYLES: Record<string, string> = {
  pending:         'bg-yellow-900 text-yellow-300',
  agreement_sent:  'bg-blue-900 text-blue-300',
  signed:          'bg-purple-900 text-purple-300',
  payment_sent:    'bg-indigo-900 text-indigo-300',
  paid:            'bg-green-900 text-green-300',
  cancelled:       'bg-red-900 text-red-300',
};

const DEAL_STATUS_STYLES: Record<string, string> = {
  quoted:      'bg-blue-900 text-blue-300',
  accepted:    'bg-green-900 text-green-300',
  in_progress: 'bg-yellow-900 text-yellow-300',
  completed:   'bg-emerald-900 text-emerald-300',
  cancelled:   'bg-red-900 text-red-300',
  refunded:    'bg-gray-800 text-gray-400',
};

const ENTITY_LABELS: Record<string, string> = {
  vestadent:   'Vestadent',
  dentafly_uk: 'Dentafly UK',
};

const METHOD_LABELS: Record<string, string> = {
  finance:       'Finance',
  bank_transfer: 'Bank Transfer',
  card:          'Card',
  pay_by_bank:   'Pay by Bank',
  cash:          'Cash',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  id_card:          'ID Card',
  driving_licence:  'Driving Licence',
  passport:         'Passport',
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp:     'WhatsApp',
  website:      'Website',
  bulk_csv:     'Bulk Import',
  manual:       'Manual',
  invoice:      'Invoice',
  payment_case: 'Payment case',
};

function sourceLabel(s: string): string {
  return SOURCE_LABELS[s] ?? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtGBP(n: string | number | null | undefined): string {
  if (n === null || n === undefined || n === '') return '—';
  const v = Number(n);
  return isNaN(v) ? '—' : `€${v.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
}

function statusLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

// ── Component ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'deals' | 'payments' | 'invoices' | 'conversation';

export default function PatientProfilePage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const canEdit = user?.role
    ? ['director', 'clinic_admin', 'treatment_coordinator', 'receptionist', 'sales'].includes(user.role)
    : false;
  const canAssign = user?.role
    ? ['director', 'clinic_admin', 'super_admin', 'admin'].includes(user.role)
    : false;
  const canDelete = user?.role === 'clinic_admin' || user?.role === 'super_admin';
  const currentUserName = user ? `${user.firstName} ${user.lastName}`.trim() : undefined;

  // ── Data state ───────────────────────────────────────────────────────────────
  const [lead,      setLead]     = useState<ApiLead | null>(null);
  const [deals,     setDeals]    = useState<LeadDeal[]>([]);
  const [cases,     setCases]    = useState<LeadCase[]>([]);
  const [invoices,  setInvoices] = useState<LeadInvoice[]>([]);
  const [messages,  setMessages] = useState<Message[]>([]);
  const [documents,       setDocuments]       = useState<PatientDocument[]>([]);
  const [manualChecklist, setManualChecklist] = useState<ChecklistItem[]>([]);
  const [togglingCheck,   setTogglingCheck]   = useState<string | null>(null);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // ── Document upload state ─────────────────────────────────────────────────
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const analysisPoll  = useRef<ReturnType<typeof setInterval> | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const [uploadError,  setUploadError]  = useState('');
  const [docLoadError, setDocLoadError] = useState('');
  const [deletingDoc,  setDeletingDoc]  = useState<string | null>(null);
  const [docType,      setDocType]      = useState<'id_card' | 'driving_licence' | 'passport'>('passport');
  const [reviewingDoc,  setReviewingDoc]  = useState<string | null>(null);
  const [analyzingDoc,  setAnalyzingDoc]  = useState<string | null>(null);

  // ── Signed-doc state (per case) ──────────────────────────────────────────────
  const [docFetching, setDocFetching] = useState<Record<string, boolean>>({});
  const [docError,    setDocError]    = useState<Record<string, string>>({});

  // ── Delete (archive) patient state ───────────────────────────────────────────
  const [deletePreview,    setDeletePreview]    = useState<{ deals: number; cases: number; documents: number; invoices: number } | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteLoading,    setDeleteLoading]    = useState(false);
  const [deleteError,      setDeleteError]      = useState('');

  // ── Send-agreement state (per case) ──────────────────────────────────────────
  const [agrSending, setAgrSending] = useState<Record<string, boolean>>({});
  const [agrError,   setAgrError]   = useState<Record<string, string>>({});
  const [agrSent,    setAgrSent]    = useState<Record<string, boolean>>({});

  async function handleDeletePreview() {
    setDeleteError('');
    setDeleteLoading(true);
    try {
      const res = await api.get<{ deals: number; cases: number; documents: number; invoices: number }>(
        `/api/patients/${leadId}/delete-preview`,
      );
      setDeletePreview(res.data);
      setDeleteConfirming(true);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.error || 'Failed to load patient summary.');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await api.delete(`/api/patients/${leadId}`);
      navigate('/patients');
    } catch (err: any) {
      setDeleteError(err?.response?.data?.error || 'Failed to archive patient.');
      setDeleteLoading(false);
    }
  }

  async function handleSendAgreement(caseId: string) {
    setAgrSending(p => ({ ...p, [caseId]: true }));
    setAgrError(p => ({ ...p, [caseId]: '' }));
    try {
      await api.post(`/api/cases/${caseId}/send-agreement`);
      setAgrSent(p => ({ ...p, [caseId]: true }));
      fetchAll();
    } catch (err: any) {
      setAgrError(p => ({ ...p, [caseId]: err?.response?.data?.error || 'Failed to send agreement.' }));
    } finally {
      setAgrSending(p => ({ ...p, [caseId]: false }));
    }
  }

  function startAnalysisPolling() {
    if (analysisPoll.current) clearInterval(analysisPoll.current);
    let attempts = 0;
    analysisPoll.current = setInterval(async () => {
      attempts++;
      try {
        const r = await api.get<{ documents: PatientDocument[] }>(
          `/api/patients/${leadId}/documents`,
        );
        const docs = r.data.documents ?? [];
        setDocuments(docs);
        const stillPending = docs.some(
          d => d.mime_type !== 'application/pdf' && d.ai_analysis === null,
        );
        if (!stillPending || attempts >= 10) {
          clearInterval(analysisPoll.current!);
          analysisPoll.current = null;
        }
      } catch {
        clearInterval(analysisPoll.current!);
        analysisPoll.current = null;
      }
    }, 3000);
  }

  async function handleUploadDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('doc_type', docType);
      const res = await api.post<{ document: PatientDocument }>(
        `/api/patients/${leadId}/documents`, form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      // Add the new doc immediately (ai_analysis=null → shows "⏳ Analyzing...")
      setDocuments(prev => [res.data.document, ...prev.filter(d => d.id !== res.data.document.id)]);
      // Poll every 3s until the AI analysis fills in (max 30s / 10 attempts)
      startAnalysisPolling();
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDoc(docId: string) {
    setDeletingDoc(docId);
    try {
      await api.delete(`/api/patients/${leadId}/documents/${docId}`);
      fetchAll();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete document.');
    } finally {
      setDeletingDoc(null);
    }
  }

  async function handleReviewDoc(docId: string, decision: 'approved' | 'rejected') {
    setReviewingDoc(docId);
    try {
      const res = await api.patch<{ document: PatientDocument }>(
        `/api/patients/${leadId}/documents/${docId}/review`,
        { decision },
      );
      setDocuments(prev => prev.map(d => d.id === docId ? res.data.document : d));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to update review.');
    } finally {
      setReviewingDoc(null);
    }
  }

  async function handleAnalyzeDoc(docId: string) {
    setAnalyzingDoc(docId);
    // Optimistically clear ai_analysis so the card shows "⏳ Analyzing..."
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ai_analysis: null, verification_status: 'unreviewed' } : d));
    try {
      await api.post(`/api/patients/${leadId}/documents/${docId}/analyze`);
      startAnalysisPolling();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to start AI analysis.');
      fetchAll();
    } finally {
      setAnalyzingDoc(null);
    }
  }

  async function handleToggleCheck(itemKey: string, currentlyChecked: boolean) {
    setTogglingCheck(itemKey);
    try {
      const res = await api.patch<{ item: ChecklistItem }>(
        `/api/patients/${leadId}/checklist-manual`,
        { item_key: itemKey, checked: !currentlyChecked },
      );
      setManualChecklist(prev => {
        const exists = prev.some(i => i.item_key === itemKey);
        if (exists) return prev.map(i => i.item_key === itemKey ? res.data.item : i);
        return [...prev, res.data.item];
      });
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to update checklist.');
    } finally {
      setTogglingCheck(null);
    }
  }

  async function handleViewSignedDoc(caseId: string) {
    setDocFetching(p => ({ ...p, [caseId]: true }));
    setDocError(p => ({ ...p, [caseId]: '' }));
    try {
      const res = await api.get<{ url: string }>(`/api/cases/${caseId}/signed-doc`);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setDocError(p => ({ ...p, [caseId]: err?.response?.data?.error || 'Could not retrieve document.' }));
    } finally {
      setDocFetching(p => ({ ...p, [caseId]: false }));
    }
  }

  // ── New Sale / edit deal modal state ─────────────────────────────────────────
  const [showNewSale,  setShowNewSale]  = useState(false);
  const [editingDeal,  setEditingDeal]  = useState<LeadDeal | null>(null);
  const [deleteId,     setDeleteId]     = useState<string | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [openMenu,     setOpenMenu]     = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Deal edit/delete helpers ──────────────────────────────────────────────────
  const isTC = user?.role === 'treatment_coordinator';
  function canManage(deal: LeadDeal): boolean {
    if (deal.commission_locked) return false;
    if (isTC) return deal.assigned_staff_id === user?.id;
    return true;
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/commissions/deals/${deleteId}`);
      setDeleteId(null);
      fetchAll();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete deal.');
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!openMenu) return;
    function handler(e: MouseEvent) {
      const ref = menuRefs.current[openMenu!];
      if (ref && !ref.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  // ── Edit modal state ──────────────────────────────────────────────────────────
  const [editOpen,       setEditOpen]       = useState(false);
  const [editFirstName,  setEditFirstName]  = useState('');
  const [editLastName,   setEditLastName]   = useState('');
  const [editPhone,      setEditPhone]      = useState('');
  const [editEmail,      setEditEmail]      = useState('');
  const [editLanguage,   setEditLanguage]   = useState('en');
  const [editTreatment,  setEditTreatment]  = useState('');
  const [editNotes,      setEditNotes]      = useState('');
  const [editStatus,     setEditStatus]     = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editAiEnabled,  setEditAiEnabled]  = useState(false);
  const [editGdpr,       setEditGdpr]       = useState(false);
  const [editSaving,     setEditSaving]     = useState(false);
  const [editError,      setEditError]      = useState('');

  // ── Fetch data ───────────────────────────────────────────────────────────────
  const fetchAll = useCallback(() => {
    if (!leadId) return;
    setLoading(true);
    // Documents fetched separately so storage errors surface explicitly.
    api.get<{ documents: PatientDocument[] }>(`/api/patients/${leadId}/documents`)
      .then(r => { setDocuments(r.data.documents ?? []); setDocLoadError(''); })
      .catch((err: any) => {
        setDocLoadError(err?.response?.data?.error || 'Failed to load documents.');
        setDocuments([]);
      });

    // Manual checklist — non-blocking, silent on error
    api.get<{ items: ChecklistItem[] }>(`/api/patients/${leadId}/checklist-manual`)
      .then(r => setManualChecklist(r.data.items ?? []))
      .catch(() => {});

    Promise.all([
      api.get<{ lead: ApiLead }>(`/api/leads/${leadId}`),
      api.get<{ deals: LeadDeal[] }>(`/api/commissions/deals`, { params: { leadId } }),
      api.get<{ cases: LeadCase[] }>(`/api/leads/${leadId}/cases`),
      api.get<{ invoices: LeadInvoice[] }>(`/api/invoices`, { params: { leadId } }),
      api.get<{ messages: Message[] }>(`/api/leads/${leadId}/messages`),
    ])
      .then(([leadRes, dealsRes, casesRes, invoicesRes, msgsRes]) => {
        setLead(leadRes.data.lead);
        setDeals(dealsRes.data.deals ?? []);
        setCases(casesRes.data.cases ?? []);
        setInvoices(invoicesRes.data.invoices ?? []);
        setMessages(msgsRes.data.messages ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!canAssign || !user?.tenantId) return;
    api.get<{ salesUsers: SalesUser[] }>(`/api/clinics/${user.tenantId}/sales-users`)
      .then(r => setSalesUsers(r.data.salesUsers ?? []))
      .catch(() => setSalesUsers([]));
  }, [canAssign, user?.tenantId]);

  // ── Open edit modal ───────────────────────────────────────────────────────────
  function openEdit() {
    if (!lead) return;
    setEditFirstName(lead.firstName ?? '');
    setEditLastName(lead.lastName ?? '');
    setEditPhone(lead.phone ?? '');
    setEditEmail(lead.email ?? '');
    setEditLanguage(lead.language ?? 'en');
    setEditTreatment(lead.treatmentInterest ?? '');
    setEditNotes(lead.notes ?? '');
    setEditStatus(lead.status ?? 'new');
    setEditAssignedTo(lead.assignedTo ?? '');
    setEditAiEnabled(lead.aiFollowUpEnabled ?? false);
    setEditGdpr(lead.gdprConsentGiven ?? false);
    setEditError('');
    setEditOpen(true);
  }

  async function handleSave() {
    if (!leadId || !lead) return;
    setEditSaving(true);
    setEditError('');
    try {
      const body: Record<string, unknown> = {
        tenantId:         lead.tenantId,
        firstName:        editFirstName,
        lastName:         editLastName,
        phone:            editPhone,
        email:            editEmail || null,
        language:         editLanguage,
        treatmentInterest: editTreatment || null,
        notes:            editNotes || null,
        status:           editStatus,
        aiFollowUpEnabled: editAiEnabled,
        gdprConsentGiven:  editGdpr,
      };
      if (canAssign) body.assignedTo = editAssignedTo || null;

      const res = await api.patch<{ lead: ApiLead }>(`/api/leads/${leadId}`, body);
      setLead(res.data.lead);
      setEditOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setEditError(msg || 'Failed to save changes.');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Checklist ─────────────────────────────────────────────────────────────────
  const contractSigned = cases.some(c =>
    ['signed', 'payment_sent', 'paid'].includes(c.status),
  );
  const paymentArranged = deals.some(d => parseFloat(d.deposit_amount || '0') > 0)
    || cases.some(c => c.paid_at !== null);
  const treatmentDateSet = deals.some(d => !!d.expected_start_date);

  // ── Financial summary ─────────────────────────────────────────────────────────
  const totalAgreed  = deals.reduce((s, d) => s + (parseFloat(d.agreed_amount  ?? '0') || 0), 0);
  const totalDeposit = deals.reduce((s, d) => s + (parseFloat(d.deposit_amount ?? '0') || 0), 0);
  const balance      = totalAgreed - totalDeposit;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-500">
        <p>Patient not found.</p>
        <button onClick={() => navigate('/patients')} className="text-accent hover:underline text-sm">
          ← Back to patients
        </button>
      </div>
    );
  }

  const fullName = `${lead.firstName} ${lead.lastName}`.trim() || lead.phone;
  const initials = ((lead.firstName?.[0] ?? '') + (lead.lastName?.[0] ?? '')).toUpperCase() || '?';
  const assignedUser = salesUsers.find(u => u.id === lead.assignedTo);

  // ── Tabs ──────────────────────────────────────────────────────────────────────
  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',      label: 'Overview'      },
    { key: 'deals',         label: `Deals (${deals.length})`    },
    { key: 'payments',      label: `Payments (${cases.length})` },
    { key: 'invoices',      label: `Invoices (${invoices.length})` },
    { key: 'conversation',  label: `Chat (${messages.length})`  },
  ];

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full overflow-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-line flex items-center gap-4 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-semibold text-lg">{fullName}</h1>
          <p className="text-gray-500 text-xs">{lead.phone}</p>
        </div>
        {canDelete && (
          <button
            onClick={handleDeletePreview}
            disabled={deleteLoading}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-line hover:border-red-500/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 size={12} />
            Archive
          </button>
        )}
        {canEdit && (
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover border border-line hover:border-accent/50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Pencil size={12} />
            Edit
          </button>
        )}
      </div>

      {/* ── Body: 2-column layout ──────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row flex-1 gap-4 lg:gap-6 p-4 lg:p-6 min-h-0 overflow-auto">

        {/* ── Left: patient card + checklist ─────────────────────────────── */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 flex flex-col gap-4">

          {/* Patient card */}
          <div className="bg-surface-sunken border border-line rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-surface font-bold text-lg shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold truncate">{fullName}</p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${STATUS_STYLES[lead.status] ?? 'bg-gray-800 text-gray-400'}`}>
                  {statusLabel(lead.status)}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <Phone size={13} className="text-gray-500 shrink-0" />
                <span className="truncate">{lead.phone}</span>
              </div>
              {lead.email && (
                <div className="flex items-center gap-2 text-gray-300">
                  <Mail size={13} className="text-gray-500 shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-300">
                <Globe size={13} className="text-gray-500 shrink-0" />
                <span>{LANGUAGE_OPTIONS.find(l => l.value === lead.language)?.label ?? lead.language}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <MessageCircle size={13} className="text-gray-500 shrink-0" />
                <span>{sourceLabel(lead.source)}</span>
              </div>
              {lead.treatmentInterest && (
                <div className="flex items-center gap-2 text-gray-300">
                  <Briefcase size={13} className="text-gray-500 shrink-0" />
                  <span className="truncate">{lead.treatmentInterest}</span>
                </div>
              )}
              {lead.assignedTo && (
                <div className="flex items-center gap-2 text-gray-300">
                  <User size={13} className="text-gray-500 shrink-0" />
                  <span className="truncate">
                    {assignedUser
                      ? `${assignedUser.firstName} ${assignedUser.lastName}`
                      : 'Assigned'}
                  </span>
                </div>
              )}
            </div>

            {lead.notes && (
              <div className="mt-4 pt-4 border-t border-surface-sunken">
                <p className="text-gray-500 text-xs mb-1">Notes</p>
                <p className="text-gray-300 text-sm leading-relaxed">{lead.notes}</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-surface-sunken text-xs text-gray-500">
              Added {formatDate(lead.createdAt)}
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-surface-sunken border border-line rounded-xl p-5">
            <p className="text-white font-semibold text-sm mb-4">Patient Journey</p>
            <div className="space-y-3">

              {/* ID uploaded */}
              <div className="flex items-center gap-3">
                {documents.length > 0
                  ? <CheckSquare size={16} className="text-green-400 shrink-0" />
                  : <Square      size={16} className="text-gray-500 shrink-0" />
                }
                <div>
                  <p className={`text-sm ${documents.length > 0 ? 'text-green-300' : 'text-gray-400'}`}>
                    ID uploaded
                  </p>
                  {documents.length > 0 && (
                    <p className="text-gray-500 text-xs">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>

              {/* Contract signed */}
              <div className="flex items-center gap-3">
                {contractSigned
                  ? <CheckSquare size={16} className="text-green-400 shrink-0" />
                  : <Square      size={16} className="text-gray-500 shrink-0" />
                }
                <div>
                  <p className={`text-sm ${contractSigned ? 'text-green-300' : 'text-gray-400'}`}>
                    Contract signed
                  </p>
                  {contractSigned && (
                    <p className="text-gray-500 text-xs">Agreement accepted</p>
                  )}
                </div>
              </div>

              {/* Payment arranged */}
              <div className="flex items-center gap-3">
                {paymentArranged
                  ? <CheckSquare size={16} className="text-green-400 shrink-0" />
                  : <Square      size={16} className="text-gray-500 shrink-0" />
                }
                <div>
                  <p className={`text-sm ${paymentArranged ? 'text-green-300' : 'text-gray-400'}`}>
                    Payment arranged
                  </p>
                  {paymentArranged && (
                    <p className="text-gray-500 text-xs">Deposit or full payment received</p>
                  )}
                </div>
              </div>

              {/* Treatment date set */}
              <div className="flex items-center gap-3">
                {treatmentDateSet
                  ? <CheckSquare size={16} className="text-green-400 shrink-0" />
                  : <Square      size={16} className="text-gray-500 shrink-0" />
                }
                <div>
                  <p className={`text-sm ${treatmentDateSet ? 'text-green-300' : 'text-gray-400'}`}>
                    Treatment date set
                  </p>
                  {treatmentDateSet && deals.find(d => d.expected_start_date) && (
                    <p className="text-gray-500 text-xs">
                      {formatDate(deals.find(d => d.expected_start_date)!.expected_start_date!)}
                    </p>
                  )}
                </div>
              </div>

              {/* Physical ID check — MANUAL, clickable */}
              {(() => {
                const item     = manualChecklist.find(i => i.item_key === 'physical_id_check');
                const checked  = !!item?.checked;
                const toggling = togglingCheck === 'physical_id_check';
                return (
                  <div className="flex items-start gap-3 border-t border-surface-sunken pt-3 mt-1">
                    <button
                      onClick={() => handleToggleCheck('physical_id_check', checked)}
                      disabled={toggling}
                      className={`mt-0.5 shrink-0 transition-colors disabled:opacity-40 ${checked ? 'text-blue-400 hover:text-blue-300' : 'text-gray-500 hover:text-gray-300'}`}
                      title={checked ? 'Uncheck' : 'Mark as checked'}
                    >
                      {checked
                        ? <CheckSquare size={16} />
                        : <Square      size={16} />
                      }
                    </button>
                    <div>
                      <p className={`text-sm font-medium ${checked ? 'text-blue-300' : 'text-gray-400'}`}>
                        Physical ID check
                      </p>
                      <p className="text-gray-600 text-xs">
                        Original document seen and verified at reception.
                      </p>
                      {checked && item && (
                        <p className="text-gray-500 text-xs mt-0.5">
                          ✓ {item.checked_by_name ?? '—'} · {item.checked_at ? item.checked_at.slice(0, 10) : ''}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
          {/* Documents */}
          <div className="bg-surface-sunken border border-line rounded-xl p-5">
            <p className="text-white font-semibold text-sm mb-3">Documents</p>
            <div className="flex items-center gap-2 mb-3">
              <select
                value={docType}
                onChange={e => setDocType(e.target.value as typeof docType)}
                disabled={uploading}
                className="flex-1 bg-surface-sunken border border-line rounded-lg px-2 py-1.5 text-gray-300 text-xs focus:outline-none focus:border-accent/50 disabled:opacity-40"
              >
                <option value="passport">Passport</option>
                <option value="id_card">ID Card</option>
                <option value="driving_licence">Driving Licence</option>
              </select>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover border border-line hover:border-accent/50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 shrink-0"
              >
                <Upload size={11} />
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={handleUploadDoc}
              />
            </div>

            {uploadError && (
              <p className="text-red-400 text-xs mb-2">{uploadError}</p>
            )}
            {docLoadError && (
              <p className="text-red-400 text-xs mb-2">{docLoadError}</p>
            )}

            {!docLoadError && documents.length === 0 ? (
              <p className="text-gray-600 text-xs">No documents yet</p>
            ) : !docLoadError ? (
              <div className="space-y-3">
                {documents.map(doc => {
                  const vs = doc.verification_status ?? 'unreviewed';
                  const isFlagged  = vs === 'flagged';
                  const isApproved = vs === 'human_approved';
                  const isRejected = vs === 'rejected';
                  const flags = Array.isArray(doc.ai_flags) ? doc.ai_flags : [];
                  const isHighRisk = isFlagged && flags.some(f => f.severity?.toLowerCase() === 'high');
                  const isReviewing = reviewingDoc === doc.id;

                  return (
                    <div key={doc.id} className={`rounded-lg border px-3 py-2.5 ${
                      isHighRisk  ? 'border-red-500/50 bg-red-900/10' :
                      isFlagged   ? 'border-yellow-500/40 bg-yellow-900/10' :
                                    'border-line bg-surface-sunken/50'
                    }`}>
                      {/* Warning banner */}
                      {isHighRisk && (
                        <p className="text-red-400 text-[10px] font-semibold mb-2">
                          🚨 HIGH RISK — MRZ mismatch or strong fraud signal detected. Do not proceed without in-person verification.
                        </p>
                      )}
                      {!isHighRisk && isFlagged && (
                        <p className="text-yellow-400 text-[10px] font-medium mb-2">
                          ⚠️ This document has suspicious signals. Review carefully before approving.
                        </p>
                      )}

                      {/* Header row: icon + name + actions */}
                      <div className="flex items-center gap-2">
                        <FileText size={13} className="text-gray-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-300 text-xs truncate">
                            {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                          </p>
                          <p className="text-gray-600 text-[10px] truncate">
                            {doc.original_name ?? ''}
                          </p>
                          <p className="text-gray-600 text-[10px] truncate">
                            {doc.uploaded_by_name ?? 'Unknown'} · {doc.uploaded_at.slice(0, 10)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {doc.url && (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="p-1 text-gray-500 hover:text-blue-400 transition-colors" title="View">
                              <ExternalLink size={12} />
                            </a>
                          )}
                          <button onClick={() => handleDeleteDoc(doc.id)} disabled={deletingDoc === doc.id}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40" title="Delete">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Verification status badge */}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-green-400 bg-green-900/20 border border-green-700/30 rounded px-1.5 py-0.5">
                            🟢 Approved by {doc.reviewed_by_name ?? '—'}
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-900/20 border border-red-700/30 rounded px-1.5 py-0.5">
                            🔴 Rejected
                          </span>
                        )}
                        {isHighRisk && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-900/20 border border-red-600/40 rounded px-1.5 py-0.5 font-semibold">
                            🔴 HIGH RISK — verify in person
                          </span>
                        )}
                        {isFlagged && !isHighRisk && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-900/20 border border-yellow-700/30 rounded px-1.5 py-0.5">
                            🟡 Flagged — review needed
                          </span>
                        )}
                        {vs === 'unreviewed' && doc.ai_analysis === null && doc.mime_type !== 'application/pdf' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 bg-blue-900/20 border border-blue-700/30 rounded px-1.5 py-0.5">
                            ⏳ Analyzing...
                          </span>
                        )}
                        {vs === 'unreviewed' && (doc.ai_analysis !== null || doc.mime_type === 'application/pdf') && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 bg-surface-sunken border border-line rounded px-1.5 py-0.5">
                            ⚪ Not reviewed
                          </span>
                        )}
                      </div>

                      {/* AI analysis summary */}
                      {doc.ai_analysis && (
                        <p className="mt-1.5 text-gray-500 text-[10px] leading-relaxed">
                          AI: {doc.ai_analysis}
                        </p>
                      )}

                      {/* AI flags list */}
                      {flags.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {flags.map((f, i) => (
                            <p key={i} className={`text-[10px] leading-snug ${f.severity?.toLowerCase() === 'high' ? 'text-red-400' : f.severity?.toLowerCase() === 'medium' ? 'text-yellow-400' : 'text-gray-500'}`}>
                              [{f.severity.toUpperCase()}] {f.issue}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Re-check button — manual re-trigger for any image doc */}
                      {doc.mime_type !== 'application/pdf' && doc.ai_analysis !== null && (
                        <div className="mt-1.5">
                          <button
                            onClick={() => handleAnalyzeDoc(doc.id)}
                            disabled={analyzingDoc === doc.id}
                            className="text-[10px] px-3 py-1.5 rounded bg-line border border-line-strong text-gray-200 hover:text-white hover:bg-line-strong transition-colors disabled:opacity-40"
                          >
                            {analyzingDoc === doc.id ? '⏳ Analysing…' : '🔁 Re-check'}
                          </button>
                        </div>
                      )}

                      {/* Approve / Reject buttons — only for unreviewed and flagged */}
                      {(vs === 'unreviewed' || vs === 'flagged') && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => {
                              if (isHighRisk && !window.confirm('This document has HIGH RISK flags. Are you sure you want to approve it?')) return;
                              handleReviewDoc(doc.id, 'approved');
                            }}
                            disabled={isReviewing}
                            className="text-[10px] px-3 py-1.5 rounded bg-green-700 border border-green-600 text-white font-medium hover:bg-green-600 transition-colors disabled:opacity-40"
                          >
                            {isReviewing ? '…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReviewDoc(doc.id, 'rejected')}
                            disabled={isReviewing}
                            className="text-[10px] px-3 py-1.5 rounded bg-red-700 border border-red-600 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-40"
                          >
                            {isReviewing ? '…' : 'Reject'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Right: financial summary + tabs ────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Financial summary cards */}
          {(deals.length > 0 || cases.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-surface-sunken border border-line rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">Total Agreed</p>
                <p className="text-white font-bold text-xl">{fmtGBP(totalAgreed)}</p>
                <p className="text-gray-600 text-xs mt-1">{deals.length} deal{deals.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="bg-surface-sunken border border-line rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">Deposited</p>
                <p className="text-accent font-bold text-xl">{fmtGBP(totalDeposit)}</p>
                <p className="text-gray-600 text-xs mt-1">
                  {totalAgreed > 0 ? `${Math.round((totalDeposit / totalAgreed) * 100)}%` : '—'}
                </p>
              </div>
              <div className="bg-surface-sunken border border-line rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">Balance Due</p>
                <p className={`font-bold text-xl ${balance > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                  {fmtGBP(balance)}
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  {balance <= 0 ? 'Fully paid' : 'Outstanding'}
                </p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-surface-sunken border border-line rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-surface-sunken shrink-0 overflow-x-auto">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === t.key
                      ? 'text-accent border-b-2 border-accent -mb-px'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto p-3 sm:p-5">

              {/* Overview tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">Summary</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-surface-sunken/50 rounded-lg px-4 py-3">
                        <p className="text-gray-500 text-xs mb-1">Status</p>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[lead.status] ?? 'bg-gray-800 text-gray-400'}`}>
                          {statusLabel(lead.status)}
                        </span>
                      </div>
                      <div className="bg-surface-sunken/50 rounded-lg px-4 py-3">
                        <p className="text-gray-500 text-xs mb-1">Language</p>
                        <p className="text-gray-300">{LANGUAGE_OPTIONS.find(l => l.value === lead.language)?.label ?? lead.language}</p>
                      </div>
                      <div className="bg-surface-sunken/50 rounded-lg px-4 py-3">
                        <p className="text-gray-500 text-xs mb-1">AI Follow-up</p>
                        <p className={lead.aiFollowUpEnabled ? 'text-green-400' : 'text-gray-500'}>
                          {lead.aiFollowUpEnabled ? `Enabled · ${lead.aiFollowUpCount} sent` : 'Disabled'}
                        </p>
                      </div>
                      <div className="bg-surface-sunken/50 rounded-lg px-4 py-3">
                        <p className="text-gray-500 text-xs mb-1">GDPR Consent</p>
                        <p className={lead.gdprConsentGiven ? 'text-green-400' : 'text-red-400'}>
                          {lead.gdprConsentGiven ? 'Given' : 'Not given'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {lead.treatmentInterest && (
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">Treatment Interest</p>
                      <p className="text-gray-300 text-sm">{lead.treatmentInterest}</p>
                    </div>
                  )}

                  {lead.notes && (
                    <div>
                      <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">Notes</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{lead.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Deals tab */}
              {activeTab === 'deals' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest">
                      {deals.length} deal{deals.length !== 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={() => setShowNewSale(true)}
                      className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover border border-line hover:border-accent/50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus size={12} />
                      New Sale
                    </button>
                  </div>
                  {deals.length === 0 ? (
                    <div className="text-center py-12">
                      <Briefcase size={28} className="text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No deals yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {deals.map(d => (
                        <div key={d.id} className="bg-surface-sunken/50 border border-line rounded-lg p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-white font-medium text-sm">
                                {d.treatment_name ?? d.treatment_category}
                              </p>
                              <p className="text-gray-500 text-xs mt-0.5">
                                {d.billing_entity_key ? (ENTITY_LABELS[d.billing_entity_key] ?? d.billing_entity_name) : ''}
                                {d.staff_first_name ? ` · ${d.staff_first_name} ${d.staff_last_name ?? ''}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DEAL_STATUS_STYLES[d.status] ?? 'bg-gray-800 text-gray-400'}`}>
                                {statusLabel(d.status)}
                              </span>
                              {d.commission_locked ? (
                                <span title="Locked — commission period approved" className="text-gray-600 cursor-default">
                                  <Lock size={13} />
                                </span>
                              ) : canManage(d) ? (
                                <div className="relative" ref={el => { menuRefs.current[d.id] = el; }}>
                                  <button
                                    onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === d.id ? null : d.id); }}
                                    className="p-1 rounded text-gray-500 hover:text-white hover:bg-line transition-colors"
                                  >
                                    <MoreHorizontal size={14} />
                                  </button>
                                  {openMenu === d.id && (
                                    <div
                                      className="absolute right-0 top-7 z-20 bg-surface-sunken border border-line rounded-lg shadow-xl py-1 w-28"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <button
                                        className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-surface-sunken transition-colors"
                                        onClick={() => { setEditingDeal(d); setOpenMenu(null); }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-surface-sunken transition-colors"
                                        onClick={() => { setDeleteId(d.id); setOpenMenu(null); }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex gap-4 text-xs">
                            <div>
                              <p className="text-gray-500">Agreed</p>
                              <p className="text-white font-medium">{fmtGBP(d.agreed_amount)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Deposit</p>
                              <p className="text-accent font-medium">{fmtGBP(d.deposit_amount)}</p>
                            </div>
                            {d.balance_due_date && (
                              <div>
                                <p className="text-gray-500">Balance due</p>
                                <p className="text-orange-400">{formatDate(d.balance_due_date)}</p>
                              </div>
                            )}
                            {d.expected_start_date && (
                              <div>
                                <p className="text-gray-500">Start date</p>
                                <p className="text-gray-300">{formatDate(d.expected_start_date)}</p>
                              </div>
                            )}
                          </div>
                          {d.notes && (
                            <p className="mt-2 text-gray-500 text-xs leading-relaxed line-clamp-3">
                              {d.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Payments (cases) tab */}
              {activeTab === 'payments' && (
                <div>
                  {cases.length === 0 ? (
                    <div className="text-center py-12">
                      <CreditCard size={28} className="text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No payment cases yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cases.map(c => (
                        <div key={c.id} className="bg-surface-sunken/50 border border-line rounded-lg p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-white font-medium text-sm">
                                {c.treatment_description ?? c.patient_name ?? 'Case'}
                              </p>
                              <p className="text-gray-500 text-xs mt-0.5">
                                {METHOD_LABELS[c.payment_method ?? ''] ?? c.payment_method ?? 'No method'}
                              </p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${CASE_STATUS_STYLES[c.status] ?? 'bg-gray-800 text-gray-400'}`}>
                              {statusLabel(c.status)}
                            </span>
                          </div>
                          <div className="flex gap-4 text-xs">
                            <div>
                              <p className="text-gray-500">Amount</p>
                              <p className="text-white font-medium">{fmtGBP(c.amount_due)}</p>
                            </div>
                            {c.paid_at && (
                              <div>
                                <p className="text-gray-500">Paid</p>
                                <p className="text-green-400">{formatDate(c.paid_at)}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-gray-500">Created</p>
                              <p className="text-gray-400">{formatDate(c.created_at)}</p>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-3 flex-wrap">
                            <button
                              onClick={() => navigate(`/payments/${c.id}`)}
                              className="text-xs text-accent hover:underline"
                            >
                              View case →
                            </button>
                            {['card', 'bank_transfer', 'finance'].includes(c.payment_method ?? '') &&
                             !['signed', 'payment_sent', 'paid'].includes(c.status) &&
                             !agrSent[c.id] && (
                              <button
                                onClick={() => handleSendAgreement(c.id)}
                                disabled={agrSending[c.id]}
                                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors"
                              >
                                <Send size={11} />
                                {agrSending[c.id] ? 'Sending…' : 'Send Agreement'}
                              </button>
                            )}
                            {agrSent[c.id] && (
                              <span className="text-xs text-green-400">✓ Agreement sent</span>
                            )}
                            {c.signwell_document_id && ['signed', 'payment_sent', 'paid'].includes(c.status) && (
                              <button
                                onClick={() => handleViewSignedDoc(c.id)}
                                disabled={docFetching[c.id]}
                                className="text-xs text-green-400 hover:text-green-300 disabled:opacity-40 transition-colors"
                              >
                                {docFetching[c.id] ? 'Fetching…' : '📄 View signed agreement'}
                              </button>
                            )}
                            {docError[c.id] && (
                              <span className="text-xs text-red-400">{docError[c.id]}</span>
                            )}
                            {agrError[c.id] && (
                              <span className="text-xs text-red-400">{agrError[c.id]}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Invoices tab */}
              {activeTab === 'invoices' && (
                <div>
                  {invoices.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText size={28} className="text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No invoices yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {invoices.map(inv => (
                        <div key={inv.id} className="bg-surface-sunken/50 border border-line rounded-lg p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-white font-medium text-sm">
                                {inv.invoice_number ?? 'Draft invoice'}
                              </p>
                              <p className="text-gray-500 text-xs mt-0.5">{formatDate(inv.issued_at)}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-white font-semibold text-sm">{fmtGBP(inv.amount)}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                inv.payment_status === 'paid'
                                  ? 'bg-green-900 text-green-300'
                                  : 'bg-yellow-900 text-yellow-300'
                              }`}>
                                {inv.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Conversation tab */}
              {activeTab === 'conversation' && (
                <div>
                  {messages.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageCircle size={28} className="text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No messages yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...messages].reverse().map(m => (
                        <div
                          key={m.id}
                          className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                            m.direction === 'outbound'
                              ? 'bg-accent/20 border border-accent/30 text-gray-200'
                              : 'bg-surface-sunken border border-line text-gray-200'
                          }`}>
                            <p className="leading-relaxed">{m.content}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <p className="text-gray-500 text-[10px]">{formatDate(m.createdAt)}</p>
                              {m.aiGenerated && (
                                <span className="text-[9px] text-accent/70 border border-accent/20 px-1 rounded">AI</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Deal modal ────────────────────────────────────────────────── */}
      {editingDeal && (
        <DealModal
          deal={editingDeal as unknown as Deal}
          tenantId={lead.tenantId}
          fixedLeadId={leadId!}
          fixedPatient={{ name: fullName, phone: lead.phone, email: lead.email ?? null }}
          onClose={() => setEditingDeal(null)}
          onSaved={() => { setEditingDeal(null); fetchAll(); }}
          currentUserRole={user?.role}
          currentUserId={user?.id}
          currentUserName={currentUserName}
        />
      )}

      {/* ── Delete confirm ──────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface border border-surface-sunken rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold mb-2">Delete Deal</h3>
            <p className="text-gray-400 text-sm mb-5">
              This deal will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Sale modal ─────────────────────────────────────────────────── */}
      {showNewSale && (
        <DealModal
          deal={null}
          tenantId={lead.tenantId}
          fixedLeadId={leadId!}
          fixedPatient={{ name: fullName, phone: lead.phone, email: lead.email ?? null }}
          onClose={() => setShowNewSale(false)}
          onSaved={() => { setShowNewSale(false); fetchAll(); }}
          currentUserRole={user?.role}
          currentUserId={user?.id}
          currentUserName={currentUserName}
        />
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────────── */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditOpen(false)} />
          <div className="relative bg-surface-sunken border border-line rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-sunken">
              <h3 className="text-white font-semibold">Edit Patient</h3>
              <button onClick={() => setEditOpen(false)} className="text-gray-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {editError && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-2.5 text-red-300 text-sm">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">First name</label>
                  <input
                    className="w-full bg-surface-sunken border border-line rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                    value={editFirstName}
                    onChange={e => setEditFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Last name</label>
                  <input
                    className="w-full bg-surface-sunken border border-line rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                    value={editLastName}
                    onChange={e => setEditLastName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1">Phone</label>
                <input
                  className="w-full bg-surface-sunken border border-line rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1">Email</label>
                <input
                  type="email"
                  className="w-full bg-surface-sunken border border-line rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Status</label>
                  <select
                    className="w-full bg-surface-sunken border border-line rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Language</label>
                  <select
                    className="w-full bg-surface-sunken border border-line rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                    value={editLanguage}
                    onChange={e => setEditLanguage(e.target.value)}
                  >
                    {LANGUAGE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {canAssign && (
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Assigned to</label>
                  <select
                    className="w-full bg-surface-sunken border border-line rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                    value={editAssignedTo}
                    onChange={e => setEditAssignedTo(e.target.value)}
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

              <div>
                <label className="block text-gray-400 text-xs mb-1">Treatment interest</label>
                <input
                  className="w-full bg-surface-sunken border border-line rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50"
                  value={editTreatment}
                  onChange={e => setEditTreatment(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1">Notes</label>
                <textarea
                  rows={3}
                  className="w-full bg-surface-sunken border border-line rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent/50 resize-none"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => {
                      if (!editGdpr && editAiEnabled) setEditAiEnabled(false);
                      setEditGdpr(v => !v);
                    }}
                    className={`w-8 h-4 rounded-full transition-colors ${editGdpr ? 'bg-accent' : 'bg-line'}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform ${editGdpr ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-gray-400 text-xs">GDPR consent</span>
                </label>
                <label className={`flex items-center gap-2 cursor-pointer ${!editGdpr ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div
                    onClick={() => setEditAiEnabled(v => !v)}
                    className={`w-8 h-4 rounded-full transition-colors ${editAiEnabled ? 'bg-accent' : 'bg-line'}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform ${editAiEnabled ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-gray-400 text-xs">AI follow-up</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-surface-sunken">
              <button
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={editSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-surface font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : <><Check size={14} /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Archive patient confirmation modal ─────────────────────────────── */}
      {deleteConfirming && deletePreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-sunken border border-line rounded-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-surface-sunken flex items-center justify-between">
              <h3 className="text-white font-semibold">Archive patient?</h3>
              <button
                onClick={() => { setDeleteConfirming(false); setDeleteError(''); }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-gray-300 text-sm">
                This will archive <strong className="text-white">{fullName}</strong> and all linked records.
                This action cannot be undone.
              </p>
              <div className="bg-surface-sunken rounded-lg p-3 text-sm space-y-1.5 text-gray-400">
                <div className="flex justify-between"><span>Deals</span><span className="text-white font-medium">{deletePreview.deals}</span></div>
                <div className="flex justify-between"><span>Payment cases</span><span className="text-white font-medium">{deletePreview.cases}</span></div>
                <div className="flex justify-between"><span>Documents</span><span className="text-white font-medium">{deletePreview.documents}</span></div>
                <div className="flex justify-between"><span>Invoices</span><span className="text-white font-medium">{deletePreview.invoices}</span></div>
              </div>
              {deleteError && <p className="text-red-400 text-xs">{deleteError}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-surface-sunken">
              <button
                onClick={() => { setDeleteConfirming(false); setDeleteError(''); }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {deleteLoading ? 'Archiving…' : <><Trash2 size={14} /> Archive patient</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

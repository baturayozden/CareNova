import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { ArrowLeft, Link as LinkIcon, Pencil, Send } from 'lucide-react';
import NewCaseModal from '../components/NewCaseModal';
import { formatDate } from '../utils/date';

interface LinkRequest {
  id: string;
  kind: string;
  channel: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  opened_at: string | null;
}

interface TreatmentCase {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  patient_name: string | null;
  patient_dob: string | null;
  patient_address: string | null;
  patient_phone: string | null;
  patient_email: string | null;
  treatment_description: string | null;
  total_cost: string | null;
  amount_due: string | null;
  payment_method: string | null;
  payer_type: string | null;
  cardholder_name: string | null;
  cardholder_relationship: string | null;
  cardholder_address: string | null;
  cardholder_phone: string | null;
  cardholder_email: string | null;
  card_scheme: string | null;
  card_first4: string | null;
  card_last4: string | null;
  photo_id_type: string | null;
  photo_id_ref: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
  signed_at: string | null;
  payment_sent_at: string | null;
  paid_at: string | null;
  declined_at: string | null;
  expired_at: string | null;
  signwell_document_id: string | null;
  links: LinkRequest[] | null;
}

interface SendResult {
  channel: string;
  status: string;
  error?: string;
}

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

const PHOTO_ID_LABELS: Record<string, string> = {
  passport:         'Passport',
  driving_licence:  'Driving licence',
  national_id:      'National ID',
  residence_permit: 'Residence permit',
};

const METHOD_LABELS: Record<string, string> = {
  finance:       'Finance',
  bank_transfer: 'Bank Transfer',
  card:          'Card',
};

const LINK_KIND_LABELS: Record<string, string> = {
  bank_details: 'Bank details',
  payment:      'Payment link',
  signature:    'Agreement',
};

const LINK_STATUS_CONFIG: Record<string, { bg: string; label: string }> = {
  created:   { bg: '#475569', label: 'Created'   },
  sent:      { bg: '#1d4ed8', label: 'Sent'      },
  opened:    { bg: '#7c3aed', label: 'Opened'    },
  completed: { bg: '#15803d', label: 'Completed' },
  expired:   { bg: '#991b1b', label: 'Expired'   },
  cancelled: { bg: '#4b5563', label: 'Cancelled' },
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex gap-2 py-1.5 border-b border-surface-sunken/50 last:border-0">
      <span className="text-gray-500 text-sm w-40 shrink-0">{label}</span>
      <span className="text-gray-200 text-sm flex-1">{value}</span>
    </div>
  );
}

function formatAmount(val: string | null | undefined): string {
  if (val == null) return '—';
  return `€${Number(val).toFixed(2)}`;
}


function formatTime(val: string | null | undefined): string {
  if (!val) return '';
  return new Date(val).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tc,            setTc]            = useState<TreatmentCase | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [reloadKey,     setReloadKey]     = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);

  // Send bank details panel state
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [sendEmail,     setSendEmail]     = useState(false);
  const [sendSmsCheck,  setSendSmsCheck]  = useState(false);
  const [sending,       setSending]       = useState(false);
  const [sendResults,   setSendResults]   = useState<SendResult[] | null>(null);

  // Send payment link panel state
  const [showPayPanel,     setShowPayPanel]     = useState(false);
  const [payEmail,         setPayEmail]         = useState(false);
  const [paySmsCheck,      setPaySmsCheck]      = useState(false);
  const [paySending,       setPaySending]       = useState(false);
  const [payResults,       setPayResults]       = useState<SendResult[] | null>(null);

  // Send agreement state
  const [agrSending,  setAgrSending]  = useState(false);
  const [agrError,    setAgrError]    = useState('');
  const [agrResult,   setAgrResult]   = useState<{
    documentId: string;
    links: Array<{ recipient: string; signing_url: string }>;
  } | null>(null);

  // View signed doc state
  const [docFetching, setDocFetching] = useState(false);
  const [docError,    setDocError]    = useState('');

  const [cashPaidSending, setCashPaidSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<{ case: TreatmentCase }>(`/api/cases/${id}`)
      .then(res => setTc(res.data.case))
      .catch(err => setError(err?.response?.data?.error || 'Failed to load case.'))
      .finally(() => setLoading(false));
  }, [id, reloadKey]);

  async function handleSendBankDetails() {
    const channels: string[] = [];
    if (sendEmail)    channels.push('email');
    if (sendSmsCheck) channels.push('sms');
    if (!channels.length) return;

    setSending(true);
    setSendResults(null);
    try {
      const res = await api.post<{ results: SendResult[] }>(
        `/api/cases/${id}/send-bank-details`,
        { channels },
      );
      setSendResults(res.data.results);
      setReloadKey(k => k + 1);
    } catch (err: unknown) {
      setSendResults([{
        channel: 'error',
        status:  'failed',
        error:   (err as any)?.response?.data?.error || 'Send failed',
      }]);
    } finally {
      setSending(false);
    }
  }

  async function handleSendAgreement() {
    setAgrSending(true);
    setAgrError('');
    setAgrResult(null);
    try {
      const res = await api.post<{
        ok: boolean;
        documentId: string;
        links: Array<{ recipient: string; signing_url: string }>;
      }>(`/api/cases/${id}/send-agreement`);
      setAgrResult(res.data);
      setReloadKey(k => k + 1);
    } catch (err: unknown) {
      setAgrError((err as any)?.response?.data?.error || 'Failed to send agreement.');
    } finally {
      setAgrSending(false);
    }
  }

  async function handleViewSignedDoc() {
    setDocFetching(true);
    setDocError('');
    try {
      const res = await api.get<{ url: string }>(`/api/cases/${id}/signed-doc`);
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setDocError((err as any)?.response?.data?.error || 'Could not retrieve signed document.');
    } finally {
      setDocFetching(false);
    }
  }

  async function handleSendPaymentLink() {
    const channels: string[] = [];
    if (payEmail)    channels.push('email');
    if (paySmsCheck) channels.push('sms');
    if (!channels.length) return;

    setPaySending(true);
    setPayResults(null);
    try {
      const res = await api.post<{ results: SendResult[] }>(
        `/api/cases/${id}/send-payment-link`,
        { channels },
      );
      setPayResults(res.data.results);
      setReloadKey(k => k + 1);
    } catch (err: unknown) {
      setPayResults([{
        channel: 'error',
        status:  'failed',
        error:   (err as any)?.response?.data?.error || 'Send failed',
      }]);
    } finally {
      setPaySending(false);
    }
  }

  async function handleMarkCashPaid() {
    if (!tc) return;
    setCashPaidSending(true);
    try {
      await api.patch(`/api/cases/${id}`, { status: 'paid' });
      setReloadKey(k => k + 1);
    } catch (err: unknown) {
      console.error('[CaseDetail] mark cash paid failed:', (err as any)?.response?.data?.error || err);
    } finally {
      setCashPaidSending(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-400 text-sm">Loading case…</div>;
  }

  if (error || !tc) {
    return (
      <div className="p-6">
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error || 'Case not found.'}
        </div>
      </div>
    );
  }

  const links = Array.isArray(tc.links) ? tc.links.filter(Boolean) : [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => navigate('/payments')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Payments
      </button>

      {/* Title + Edit button */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-serif font-bold text-white">
          {tc.patient_name || <span className="text-gray-500 italic">Unknown Patient</span>}
        </h1>
        <StatusBadge status={tc.status} />
        <button
          onClick={() => setShowEditModal(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white border border-line hover:border-line-strong rounded-lg transition-colors"
        >
          <Pencil size={13} />
          Edit
        </button>
      </div>

      {/* Summary card */}
      <div className="bg-surface-sunken border border-line rounded-xl px-5 py-4 space-y-0.5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Summary</p>
        <Row label="Patient Name"  value={tc.patient_name} />
        <Row label="Date of Birth" value={formatDate(tc.patient_dob)} />
        <Row label="Phone"         value={tc.patient_phone} />
        <Row label="Email"         value={tc.patient_email} />
        <Row label="Address"       value={tc.patient_address} />
        <Row label="Treatment"     value={tc.treatment_description} />
        <Row label="Total Cost"    value={tc.total_cost  ? formatAmount(tc.total_cost)  : null} />
        <Row label="Amount Due"    value={tc.amount_due  ? formatAmount(tc.amount_due)  : null} />
        <Row label="Method"        value={METHOD_LABELS[tc.payment_method ?? ''] ?? tc.payment_method} />
        <Row label="Payer"         value={tc.payer_type === 'third_party' ? 'Third Party' : tc.payer_type === 'self' ? 'Self' : null} />
        <Row label="Created"       value={formatDate(tc.created_at)} />
      </div>

      {/* Cardholder — only if third_party */}
      {tc.payer_type === 'third_party' && (tc.cardholder_name || tc.card_last4) && (
        <div className="bg-surface-sunken border border-line rounded-xl px-5 py-4 space-y-0.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Cardholder</p>
          <Row label="Name"         value={tc.cardholder_name} />
          <Row label="Relationship" value={tc.cardholder_relationship} />
          <Row label="Phone"        value={tc.cardholder_phone} />
          <Row label="Email"        value={tc.cardholder_email} />
          <Row label="Address"      value={tc.cardholder_address} />
          <Row label="Card Scheme"  value={tc.card_scheme} />
          <Row label="Card"         value={tc.card_first4 && tc.card_last4 ? `${tc.card_first4} •••• •••• ${tc.card_last4}` : null} />
        </div>
      )}

      {/* ID docs */}
      {(tc.photo_id_type || tc.photo_id_ref) && (
        <div className="bg-surface-sunken border border-line rounded-xl px-5 py-4 space-y-0.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Photo ID</p>
          <Row label="Type"      value={tc.photo_id_type ? (PHOTO_ID_LABELS[tc.photo_id_type] ?? tc.photo_id_type) : null} />
          <Row label="Reference" value={tc.photo_id_ref} />
        </div>
      )}

      {/* Actions — bank_transfer only */}
      {tc.payment_method === 'bank_transfer' && (
        <div className="bg-surface-sunken border border-line rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Actions</p>

          {!showSendPanel ? (
            <button
              onClick={() => { setShowSendPanel(true); setSendResults(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors"
            >
              <Send size={14} />
              Send Bank Details
            </button>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-300">Choose delivery channel(s):</p>

              <label className={`flex items-center gap-3 cursor-pointer ${!tc.patient_email ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <input
                  type="checkbox"
                  checked={sendEmail}
                  disabled={!tc.patient_email}
                  onChange={e => setSendEmail(e.target.checked)}
                  className="w-4 h-4 accent-accent"
                />
                <div>
                  <span className="text-sm text-white">Email</span>
                  {tc.patient_email
                    ? <span className="ml-2 text-xs text-gray-500">{tc.patient_email}</span>
                    : <span className="ml-2 text-xs text-gray-600">no email on file</span>}
                </div>
              </label>

              <label className={`flex items-center gap-3 cursor-pointer ${!tc.patient_phone ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <input
                  type="checkbox"
                  checked={sendSmsCheck}
                  disabled={!tc.patient_phone}
                  onChange={e => setSendSmsCheck(e.target.checked)}
                  className="w-4 h-4 accent-accent"
                />
                <div>
                  <span className="text-sm text-white">SMS</span>
                  {tc.patient_phone
                    ? <span className="ml-2 text-xs text-gray-500">{tc.patient_phone}</span>
                    : <span className="ml-2 text-xs text-gray-600">no phone on file</span>}
                </div>
              </label>

              {sendResults && (
                <div className="space-y-1.5">
                  {sendResults.map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      r.status === 'sent'    ? 'bg-green-900/20 text-green-300 border border-green-800/40' :
                      r.status === 'failed'  ? 'bg-red-900/20 text-red-300 border border-red-800/40' :
                      'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}>
                      <span className="capitalize font-medium">{r.channel}</span>
                      <span>·</span>
                      <span className="capitalize">{r.status}</span>
                      {r.error && <span className="text-xs opacity-70">({r.error})</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSendBankDetails}
                  disabled={sending || (!sendEmail && !sendSmsCheck)}
                  className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-40"
                >
                  {sending ? 'Sending…' : 'Send'}
                </button>
                <button
                  onClick={() => { setShowSendPanel(false); setSendResults(null); setSendEmail(false); setSendSmsCheck(false); }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-surface-sunken transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions — card only */}
      {tc.payment_method === 'card' && tc.status !== 'paid' && (
        <div className="bg-surface-sunken border border-line rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Actions</p>

          {!showPayPanel ? (() => {
            const payGated = tc.payer_type === 'third_party' &&
              !['signed', 'payment_sent', 'paid'].includes(tc.status);
            return (
              <>
                <button
                  onClick={() => { setShowPayPanel(true); setPayResults(null); }}
                  disabled={payGated}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={14} />
                  Send Payment Link
                </button>
                {payGated && (
                  <p className="mt-2 text-xs text-gray-500">Payment link unlocks after the agreement is signed.</p>
                )}
              </>
            );
          })() : (() => {
            const isThirdParty   = tc.payer_type === 'third_party';
            const recipientEmail = isThirdParty ? tc.cardholder_email : tc.patient_email;
            const recipientPhone = isThirdParty ? tc.cardholder_phone : tc.patient_phone;
            const recipientLabel = isThirdParty ? 'Cardholder' : 'Patient';
            return (
              <div className="space-y-4">
                <p className="text-sm text-gray-300">
                  Send payment link to <span className="text-white font-medium">{recipientLabel}</span>:
                </p>

                <label className={`flex items-center gap-3 cursor-pointer ${!recipientEmail ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <input
                    type="checkbox"
                    checked={payEmail}
                    disabled={!recipientEmail}
                    onChange={e => setPayEmail(e.target.checked)}
                    className="w-4 h-4 accent-accent"
                  />
                  <div>
                    <span className="text-sm text-white">Email</span>
                    {recipientEmail
                      ? <span className="ml-2 text-xs text-gray-500">{recipientEmail}</span>
                      : <span className="ml-2 text-xs text-gray-600">no email on file</span>}
                  </div>
                </label>

                <label className={`flex items-center gap-3 cursor-pointer ${!recipientPhone ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <input
                    type="checkbox"
                    checked={paySmsCheck}
                    disabled={!recipientPhone}
                    onChange={e => setPaySmsCheck(e.target.checked)}
                    className="w-4 h-4 accent-accent"
                  />
                  <div>
                    <span className="text-sm text-white">SMS</span>
                    {recipientPhone
                      ? <span className="ml-2 text-xs text-gray-500">{recipientPhone}</span>
                      : <span className="ml-2 text-xs text-gray-600">no phone on file</span>}
                  </div>
                </label>

                {payResults && (
                  <div className="space-y-1.5">
                    {payResults.map((r, i) => (
                      <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        r.status === 'sent'   ? 'bg-green-900/20 text-green-300 border border-green-800/40' :
                        r.status === 'failed' ? 'bg-red-900/20 text-red-300 border border-red-800/40' :
                        'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}>
                        <span className="capitalize font-medium">{r.channel}</span>
                        <span>·</span>
                        <span className="capitalize">{r.status}</span>
                        {r.error && <span className="text-xs opacity-70">({r.error})</span>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSendPaymentLink}
                    disabled={paySending || (!payEmail && !paySmsCheck)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-40"
                  >
                    {paySending ? 'Sending…' : 'Send'}
                  </button>
                  <button
                    onClick={() => { setShowPayPanel(false); setPayResults(null); setPayEmail(false); setPaySmsCheck(false); }}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-surface-sunken transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Actions — cash only: manual Mark as Paid */}
      {tc.payment_method === 'cash' && tc.status !== 'paid' && (
        <div className="bg-surface-sunken border border-line rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Actions</p>
          <p className="text-sm text-gray-400 mb-4">
            Once the patient has paid in cash, mark this case as paid manually.
          </p>
          <button
            onClick={handleMarkCashPaid}
            disabled={cashPaidSending}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-40"
          >
            {cashPaidSending ? 'Saving…' : 'Mark as Paid'}
          </button>
        </div>
      )}

      {/* Send Agreement — card, bank_transfer, and finance cases */}
      {(tc.payment_method === 'card' || tc.payment_method === 'bank_transfer' || tc.payment_method === 'finance') && (
        <div className="bg-surface-sunken border border-line rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">E-Signature</p>

          {!agrResult ? (
            <>
              <p className="text-sm text-gray-400 mb-4">
                {tc.payment_method === 'bank_transfer'
                  ? <>Send a treatment &amp; payment confirmation to{' '}<span className="text-white">{tc.patient_name || 'patient'}</span>{' '}for e-signature.</>
                  : tc.payment_method === 'finance'
                  ? <>Send a treatment &amp; finance confirmation to{' '}<span className="text-white">{tc.patient_name || 'patient'}</span>{' '}for e-signature.</>
                  : <>Send a pre-filled card payment agreement to{' '}
                      {tc.payer_type === 'third_party'
                        ? <><span className="text-white">{tc.cardholder_name || 'cardholder'}</span> &amp; <span className="text-white">{tc.patient_name || 'patient'}</span></>
                        : <span className="text-white">{tc.patient_name || 'patient'}</span>
                      }{' '}for e-signature via SignWell.</>
                }
              </p>
              {agrError && (
                <div className="mb-3 px-3 py-2 bg-red-900/20 border border-red-800/40 rounded-lg text-red-300 text-sm">
                  {agrError}
                </div>
              )}
              <button
                onClick={handleSendAgreement}
                disabled={agrSending}
                style={{ backgroundColor: agrSending ? '#3730a3' : '#4F46E5', color: '#ffffff' }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40"
              >
                <Send size={14} />
                {agrSending ? 'Sending…' : 'Send Agreement'}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                <span>✓</span>
                <span>Agreement sent — document ID: <code className="text-xs bg-surface-sunken px-1.5 py-0.5 rounded">{agrResult.documentId}</code></span>
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mt-2">Signing links (test mode)</p>
              {agrResult.links.map((l, i) => (
                <div key={i} className="flex items-start gap-2 bg-surface-sunken/50 rounded-lg px-3 py-2">
                  <span className="text-gray-400 text-xs capitalize w-20 shrink-0 pt-0.5">{l.recipient}</span>
                  <a
                    href={l.signing_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-xs break-all hover:underline"
                  >
                    {l.signing_url}
                  </a>
                </div>
              ))}
              <button
                onClick={() => { setAgrResult(null); setAgrError(''); }}
                className="text-xs text-gray-500 hover:text-gray-300 mt-1"
              >
                Send again
              </button>
            </div>
          )}
        </div>
      )}

      {/* View Signed Agreement — shown once document is completed */}
      {tc.signwell_document_id && ['signed', 'payment_sent', 'paid'].includes(tc.status) && (
        <div className="bg-surface-sunken border border-line rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Signed Document</p>
          {docError && (
            <div className="mb-3 px-3 py-2 bg-red-900/20 border border-red-800/40 rounded-lg text-red-300 text-sm">
              {docError}
            </div>
          )}
          <button
            onClick={handleViewSignedDoc}
            disabled={docFetching}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: '#ffffff' }}
          >
            <LinkIcon size={14} color="#ffffff" />
            {docFetching ? 'Fetching…' : 'View Signed Agreement'}
          </button>
        </div>
      )}

      {/* Activity timeline — lifecycle milestones + link events */}
      <div className="bg-surface-sunken border border-line rounded-xl px-5 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Activity</p>

        {/* ── Lifecycle milestones ─────────────────────────────────── */}
        {(() => {
          const milestones: { ts: string; label: string; dotColor: string; textColor: string }[] = [];
          if (tc.created_at)       milestones.push({ ts: tc.created_at,       label: 'Case created',       dotColor: '#475569', textColor: 'text-gray-400' });
          if (tc.signed_at)        milestones.push({ ts: tc.signed_at,        label: 'Signed',             dotColor: '#15803d', textColor: 'text-green-400' });
          if (tc.payment_sent_at)  milestones.push({ ts: tc.payment_sent_at,  label: 'Payment link sent',  dotColor: '#3730a3', textColor: 'text-indigo-400' });
          if (tc.paid_at)          milestones.push({ ts: tc.paid_at,          label: 'Paid',               dotColor: '#14532d', textColor: 'text-green-400' });
          if (tc.declined_at)      milestones.push({ ts: tc.declined_at,      label: 'Declined',           dotColor: '#991b1b', textColor: 'text-red-400' });
          if (tc.expired_at)       milestones.push({ ts: tc.expired_at,       label: 'Expired',            dotColor: '#78716c', textColor: 'text-stone-400' });
          milestones.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
          if (milestones.length === 0) return null;
          return (
            <ol className="relative border-l border-line space-y-3 ml-3 mb-5">
              {milestones.map((m, i) => (
                <li key={i} className="ml-4">
                  <span
                    className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full border-2 border-surface-sunken"
                    style={{ backgroundColor: m.dotColor }}
                  />
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${m.textColor}`}>{m.label}</span>
                    <span className="text-gray-600 text-xs">{formatTime(m.ts)}</span>
                  </div>
                </li>
              ))}
            </ol>
          );
        })()}

        {/* ── Link events ──────────────────────────────────────────── */}
        {links.length === 0 ? (
          <div className="flex flex-col items-center py-4 text-center">
            <LinkIcon size={24} className="text-gray-600 mb-2" />
            <p className="text-gray-500 text-sm">No link events yet.</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">Links</p>
            <ol className="relative border-l border-surface-sunken space-y-4 ml-3">
              {links.map(link => {
                const kindLabel    = LINK_KIND_LABELS[link.kind] ?? (link.kind || '').replace(/_/g, ' ');
                const channelLabel = link.channel ? link.channel.toUpperCase() : '';
                const statusCfg    = LINK_STATUS_CONFIG[link.status] ?? { bg: '#475569', label: link.status };
                return (
                  <li key={link.id} className="ml-4">
                    <span className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-accent border-2 border-surface-sunken" />
                    <div className="bg-surface-sunken/50 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-white text-sm font-medium capitalize">
                          {kindLabel}{channelLabel ? ` · ${channelLabel}` : ''}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: statusCfg.bg, color: '#ffffff' }}
                        >
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="text-gray-500 text-xs mt-1 space-y-0.5">
                        <p>Created {formatDate(link.created_at)}</p>
                        {link.sent_at   && <p>Sent {formatTime(link.sent_at)}</p>}
                        {link.opened_at && <p className="text-green-500">Opened {formatTime(link.opened_at)}</p>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>

      <NewCaseModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onCreated={() => {
          setShowEditModal(false);
          setReloadKey(k => k + 1);
        }}
        effectiveTenantId={tc.tenant_id}
        editCase={tc}
      />
    </div>
  );
}

import React, { useRef, useState } from 'react';
import api from '../lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatGBP(n: number | string | null | undefined): string {
  const val = Number(n ?? 0);
  return `€${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * Parse only the header row of a CSV string.
 * Handles basic double-quote wrapping but does NOT attempt full RFC-4180
 * parsing — the real parse happens on the backend via csv-parse.
 */
function parseCSVHeaders(text: string): string[] {
  const firstLine = text.split('\n')[0] ?? '';
  const headers: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { headers.push(current.trim()); current = ''; continue; }
    if (ch === '\r') continue;
    current += ch;
  }
  if (current.trim()) headers.push(current.trim());
  return headers.filter(h => h.length > 0);
}

function friendlyImportError(raw: string): string {
  if (!raw) return 'Import failed. Please try again.';
  if (raw.includes('CSV parse error'))           return 'Could not parse the CSV file. Check the format and try again.';
  if (raw.includes('no data rows'))              return 'The file contains no data rows after the header.';
  if (raw.includes('No valid rows'))             return 'No valid rows found — every row was missing amount or date.';
  if (raw.includes('columnMapping missing'))     return 'Column mapping error: ' + raw;
  if (raw.includes('csv is required'))           return 'No CSV content received. Try re-selecting the file.';
  if (raw.includes('uq_payment_external_ref') || raw.includes('duplicate key'))
    return 'Some of these payments were already imported (duplicate reference). Each payment reference can only be imported once.';
  // Avoid leaking raw SQL or stack traces — fall back to a safe generic message
  return 'Import failed. Please check the file and try again.';
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ImportSummary {
  importId:     string;
  rowCount:     number;
  skippedCount: number;
  autoMatched:  number;
  needsReview:  number;
  unmatched:    number;
}

interface ReviewItem {
  id:                 string;
  patient_name:       string | null;
  gross_amount:       string;
  payment_date:       string;
  match_confidence:   number;
  treatment_deal_id:  string | null;
  deal_id:            string | null;
  deal_patient_name:  string | null;
  deal_agreed_amount: string | null;
  deal_deal_date:     string | null;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const selectCls =
  'w-full bg-navy-900 border border-navy-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40';

// ─── Sub-component: confidence badge ─────────────────────────────────────────
function ConfidenceBadge({ score }: { score: number }) {
  const cls =
    score >= 80 ? 'bg-green-900/60 text-green-300 border-green-700/40' :
    score >= 60 ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700/40' :
                  'bg-orange-900/50 text-orange-300 border-orange-700/40';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {score}%
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PaymentImporter({ tenantId }: { tenantId?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1 — file + column mapping ────────────────────────────────────────
  const [csvText,        setCsvText]        = useState('');
  const [fileName,       setFileName]       = useState('');
  const [csvHeaders,     setCsvHeaders]     = useState<string[]>([]);
  const [colPatientName, setColPatientName] = useState('');
  const [colAmount,      setColAmount]      = useState('');
  const [colDate,        setColDate]        = useState('');
  const [colRef,         setColRef]         = useState('');

  // ── Import request ─────────────────────────────────────────────────────────
  const [importLoading,  setImportLoading]  = useState(false);
  const [importError,    setImportError]    = useState('');
  const [summary,        setSummary]        = useState<ImportSummary | null>(null);

  // ── Review queue ───────────────────────────────────────────────────────────
  const [reviewItems,    setReviewItems]    = useState<ReviewItem[]>([]);
  const [reviewLoading,  setReviewLoading]  = useState(false);
  const [reviewError,    setReviewError]    = useState('');
  const [processingId,   setProcessingId]   = useState<string | null>(null);
  const [itemErrors,     setItemErrors]     = useState<Record<string, string>>({});

  // ── Derived ────────────────────────────────────────────────────────────────
  const canImport = csvText.length > 0 && !!colPatientName && !!colAmount && !!colDate;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset downstream state on new file
    setCsvText('');
    setCsvHeaders([]);
    setColPatientName('');
    setColAmount('');
    setColDate('');
    setColRef('');
    setImportError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = ev => {
      const text = (ev.target?.result as string) ?? '';
      if (!text.trim()) {
        setImportError('The selected file is empty.');
        return;
      }
      const headers = parseCSVHeaders(text);
      if (headers.length === 0) {
        setImportError('Could not detect column headers. Check the file format.');
        return;
      }
      setCsvText(text);
      setCsvHeaders(headers);
    };
    reader.onerror = () => setImportError('Could not read the file. Try again.');
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!canImport || importLoading) return;
    setImportError('');
    setImportLoading(true);
    try {
      const columnMapping: Record<string, string> = {
        patient_name: colPatientName,
        gross_amount: colAmount,
        payment_date: colDate,
      };
      if (colRef) columnMapping.external_ref = colRef;

      const res = await api.post<ImportSummary>('/api/commissions/payment-imports', {
        csv: csvText,
        columnMapping,
        source: 'csv',
        ...(tenantId ? { tenantId } : {}),
      });
      setSummary(res.data);

      if (res.data.needsReview > 0) {
        await fetchReviewQueue(res.data.importId);
      }
    } catch (err: any) {
      setImportError(friendlyImportError(err?.response?.data?.error ?? ''));
    } finally {
      setImportLoading(false);
    }
  }

  async function fetchReviewQueue(importId: string) {
    setReviewLoading(true);
    setReviewError('');
    setItemErrors({});
    try {
      const res = await api.get<{ importId: string; count: number; items: ReviewItem[] }>(
        `/api/commissions/payment-imports/${importId}/review-queue`,
        { params: tenantId ? { tenantId } : undefined },
      );
      setReviewItems(res.data.items);
    } catch (err: any) {
      setReviewError(err?.response?.data?.error || 'Failed to load the review queue.');
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleConfirm(paymentId: string) {
    if (processingId) return;
    setProcessingId(paymentId);
    setItemErrors(prev => { const next = { ...prev }; delete next[paymentId]; return next; });
    try {
      await api.post(`/api/commissions/payments/${paymentId}/confirm-match`, tenantId ? { tenantId } : {});
      setReviewItems(prev => prev.filter(i => i.id !== paymentId));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        // Already processed — remove silently
        setReviewItems(prev => prev.filter(i => i.id !== paymentId));
      } else {
        setItemErrors(prev => ({
          ...prev,
          [paymentId]: err?.response?.data?.error || 'Confirm failed. Try again.',
        }));
      }
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(paymentId: string) {
    if (processingId) return;
    setProcessingId(paymentId);
    setItemErrors(prev => { const next = { ...prev }; delete next[paymentId]; return next; });
    try {
      await api.post(`/api/commissions/payments/${paymentId}/reject-match`, tenantId ? { tenantId } : {});
      setReviewItems(prev => prev.filter(i => i.id !== paymentId));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        setReviewItems(prev => prev.filter(i => i.id !== paymentId));
      } else {
        setItemErrors(prev => ({
          ...prev,
          [paymentId]: err?.response?.data?.error || 'Reject failed. Try again.',
        }));
      }
    } finally {
      setProcessingId(null);
    }
  }

  function handleReset() {
    setCsvText('');
    setFileName('');
    setCsvHeaders([]);
    setColPatientName('');
    setColAmount('');
    setColDate('');
    setColRef('');
    setImportError('');
    setSummary(null);
    setReviewItems([]);
    setReviewError('');
    setItemErrors({});
    setProcessingId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Upload form ─────────────────────────────────────────────────────── */}
      {summary === null && (
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-white font-semibold text-base">Import Payment CSV</h3>
            <p className="text-gray-400 text-sm mt-0.5">
              Upload a CSV from your PMS or bank statement, map the columns, and run the import.
            </p>
          </div>

          {/* File picker */}
          <div>
            <label className="block text-gray-400 text-xs font-medium mb-1.5">
              CSV File <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-navy-600 rounded-lg text-sm text-gray-300 hover:border-gold/40 hover:text-gold transition-colors shrink-0">
                📁 Choose file
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {fileName && (
                <span className="text-gray-400 text-sm truncate">
                  {fileName}{' '}
                  {csvText && <span className="text-green-400 text-xs">✓ {csvHeaders.length} columns detected</span>}
                </span>
              )}
            </div>
          </div>

          {/* Column mapping — only after a valid file is loaded */}
          {csvHeaders.length > 0 && (
            <div className="space-y-3">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">
                Column Mapping
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">
                    Patient Name column <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={colPatientName}
                    onChange={e => setColPatientName(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">— select —</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">
                    Amount column <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={colAmount}
                    onChange={e => setColAmount(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">— select —</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">
                    Date column <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={colDate}
                    onChange={e => setColDate(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">— select —</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">
                    Reference column{' '}
                    <span className="text-gray-600 text-[10px]">optional</span>
                  </label>
                  <select
                    value={colRef}
                    onChange={e => setColRef(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">— none —</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {importError && (
            <div className="flex items-start gap-2 bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
              <span className="text-red-400 shrink-0 text-sm">✕</span>
              <p className="text-red-400 text-sm">{importError}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={!canImport || importLoading}
              className="flex items-center gap-2 px-5 py-2 bg-gold text-white rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {importLoading && (
                <span className="w-3 h-3 border-2 border-navy-950/30 border-t-navy-950 rounded-full animate-spin" />
              )}
              {importLoading ? 'Importing…' : '▶ Run Import'}
            </button>
            {!canImport && csvHeaders.length > 0 && (
              <p className="text-gray-500 text-xs">
                Select all three required columns to continue.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Import summary ───────────────────────────────────────────────────── */}
      {summary && (
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-white font-semibold text-base flex items-center gap-2">
                <span className="text-green-400">✓</span>
                Import Complete
              </h3>
              <p className="text-gray-400 text-sm mt-0.5">
                {summary.rowCount} row{summary.rowCount !== 1 ? 's' : ''} processed
                {summary.skippedCount > 0 && (
                  <span className="text-yellow-500">
                    {' '}· {summary.skippedCount} skipped (missing amount or date)
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="shrink-0 text-xs text-gray-500 hover:text-gray-300 transition-colors border border-navy-600 rounded-lg px-3 py-1.5"
            >
              ↺ New Import
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Auto-matched */}
            <div className="flex items-center gap-3 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-2.5">
              <span className="text-green-400 text-lg">✓</span>
              <div>
                <p className="text-green-300 font-bold text-xl leading-none">{summary.autoMatched}</p>
                <p className="text-green-500 text-xs mt-0.5">Auto-matched</p>
              </div>
            </div>
            {/* Needs review */}
            <div className="flex items-center gap-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-4 py-2.5">
              <span className="text-yellow-400 text-lg">⚠</span>
              <div>
                <p className="text-yellow-300 font-bold text-xl leading-none">{summary.needsReview}</p>
                <p className="text-yellow-500 text-xs mt-0.5">Need review</p>
              </div>
            </div>
            {/* Unmatched */}
            <div className="flex items-center gap-3 bg-navy-900/60 border border-navy-700 rounded-lg px-4 py-2.5">
              <span className="text-gray-500 text-lg">○</span>
              <div>
                <p className="text-gray-300 font-bold text-xl leading-none">{summary.unmatched}</p>
                <p className="text-gray-500 text-xs mt-0.5">Unmatched</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── No review needed ─────────────────────────────────────────────────── */}
      {summary && summary.needsReview === 0 && (
        <div className="bg-green-900/20 border border-green-700/30 rounded-xl px-5 py-4 flex items-center gap-3">
          <span className="text-green-400">✓</span>
          <p className="text-green-300 text-sm">
            No payments need manual review — all rows were auto-matched or unmatched.
          </p>
        </div>
      )}

      {/* ── Review queue ─────────────────────────────────────────────────────── */}
      {summary && summary.needsReview > 0 && (
        <div className="space-y-3">

          {/* Review queue header */}
          <div className="flex items-center justify-between">
            <h4 className="text-white font-semibold text-sm">
              Review Queue
              {!reviewLoading && reviewItems.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-yellow-900/50 text-yellow-300 border border-yellow-700/40 text-[10px] font-bold rounded-full">
                  {reviewItems.length}
                </span>
              )}
            </h4>
            <p className="text-gray-500 text-xs">
              Confirm or reject each suggested match
            </p>
          </div>

          {/* Loading */}
          {reviewLoading && (
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-8 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <div className="w-4 h-4 border border-gold/40 border-t-gold rounded-full animate-spin" />
              Loading review queue…
            </div>
          )}

          {/* Error */}
          {reviewError && !reviewLoading && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl px-5 py-4 text-red-400 text-sm">
              {reviewError}
            </div>
          )}

          {/* All reviewed */}
          {!reviewLoading && !reviewError && reviewItems.length === 0 && (
            <div className="bg-green-900/20 border border-green-700/30 rounded-xl px-5 py-4 flex items-center gap-3">
              <span className="text-green-400">✓</span>
              <p className="text-green-300 text-sm">All payments reviewed.</p>
            </div>
          )}

          {/* Review items */}
          {!reviewLoading && !reviewError && reviewItems.map(item => (
            <div
              key={item.id}
              className="bg-navy-800 border border-navy-600 rounded-xl p-4"
            >
              <div className="flex items-start gap-3 sm:gap-5">

                {/* Payment info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Payment
                  </p>
                  <p className="text-white font-medium text-sm truncate">
                    {item.patient_name ?? <span className="italic text-gray-500">Unknown patient</span>}
                  </p>
                  <p className="text-gold font-semibold text-sm">{formatGBP(item.gross_amount)}</p>
                  <p className="text-gray-400 text-xs">{formatDate(item.payment_date)}</p>
                </div>

                {/* Confidence + arrow */}
                <div className="flex flex-col items-center gap-1 shrink-0 pt-5">
                  <ConfidenceBadge score={item.match_confidence} />
                  <span className="text-gray-600 text-[10px]">match</span>
                  <span className="text-gray-600 text-xs">→</span>
                </div>

                {/* Deal candidate */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Deal Candidate
                  </p>
                  {item.deal_patient_name ? (
                    <>
                      <p className="text-white font-medium text-sm truncate">{item.deal_patient_name}</p>
                      <p className="text-gray-300 text-sm">{formatGBP(item.deal_agreed_amount)}</p>
                      <p className="text-gray-400 text-xs">{formatDate(item.deal_deal_date)}</p>
                    </>
                  ) : (
                    <p className="text-gray-500 text-xs italic">No candidate deal</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2 shrink-0 pt-1">
                  <button
                    onClick={() => handleConfirm(item.id)}
                    disabled={processingId === item.id}
                    className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processingId === item.id ? '…' : '✓ Confirm'}
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    disabled={processingId === item.id}
                    className="px-3 py-1.5 border border-red-700/60 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Reject
                  </button>
                </div>

              </div>

              {/* Per-item error */}
              {itemErrors[item.id] && (
                <p className="text-red-400 text-xs mt-2.5 pt-2.5 border-t border-navy-700">
                  {itemErrors[item.id]}
                </p>
              )}
            </div>
          ))}

        </div>
      )}

    </div>
  );
}

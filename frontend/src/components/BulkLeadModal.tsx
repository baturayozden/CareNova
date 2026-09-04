import React, { useRef, useState } from 'react';
import api from '../lib/api';

// ─── parseCSVHeaders — lifted from PaymentImporter ────────────────────────────
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

// ─── Count data rows (header excluded) ───────────────────────────────────────
function countDataRows(text: string): number {
  return text.split('\n').filter((line, i) => i > 0 && line.trim().length > 0).length;
}

// ─── Fuzzy auto-detect column mapping ────────────────────────────────────────
function autoDetect(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {
    firstName: '', phone: '', lastName: '', email: '',
    treatmentInterest: '', notes: '', language: '',
  };

  const matchers: [keyof typeof result, RegExp][] = [
    ['firstName',         /name|first|ad\b|isim/i],
    ['phone',             /phone|tel|mobile|cep|gsm/i],
    ['lastName',          /surname|last|soyad/i],
    ['email',             /email|mail|e-posta|eposta/i],
    ['treatmentInterest', /treatment|tedavi/i],
    ['notes',             /note|not\b|comment|açıklama/i],
    ['language',          /lang|dil/i],
  ];

  for (const [field, pattern] of matchers) {
    const match = headers.find(h => pattern.test(h));
    if (match) result[field] = match;
  }

  return result;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface BulkResult {
  insertedCount: number;
  skippedCount:  number;
  skipped:       { row: number; reason: string }[];
}

interface Props {
  isOpen:      boolean;
  onClose:     () => void;
  onCompleted: () => void;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const SELECT_CLS =
  'w-full bg-navy-900 border border-navy-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40';
const LABEL_CLS = 'block text-gray-400 text-xs mb-1.5';

type Phase = 'upload' | 'mapping' | 'result';

export default function BulkLeadModal({ isOpen, onClose, onCompleted }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('upload');

  // Step 1 — file
  const [csvText,    setCsvText]    = useState('');
  const [fileName,   setFileName]   = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rowCount,   setRowCount]   = useState(0);
  const [fileError,  setFileError]  = useState('');

  // Step 2 — column mapping
  const [mapping, setMapping] = useState<Record<string, string>>({
    firstName: '', phone: '', lastName: '', email: '',
    treatmentInterest: '', notes: '', language: '',
  });

  // Step 3 — upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [result,      setResult]      = useState<BulkResult | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const canUpload = !!mapping.firstName && !!mapping.phone;

  // ─── Reset ────────────────────────────────────────────────────────────────
  function resetAll() {
    setPhase('upload');
    setCsvText(''); setFileName(''); setCsvHeaders([]); setRowCount(0); setFileError('');
    setMapping({ firstName: '', phone: '', lastName: '', email: '', treatmentInterest: '', notes: '', language: '' });
    setIsUploading(false); setUploadError(''); setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    resetAll();
    onClose();
  }

  // ─── File selection ───────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');
    setCsvText(''); setCsvHeaders([]); setRowCount(0);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = ev => {
      const text = (ev.target?.result as string) ?? '';
      if (!text.trim()) { setFileError('The selected file is empty.'); return; }
      const headers = parseCSVHeaders(text);
      if (headers.length === 0) {
        setFileError('Could not detect column headers. Check the file format.');
        return;
      }
      const rows = countDataRows(text);
      if (rows > 500) {
        setFileError(`This file has ${rows} data rows. Maximum is 500. Please split your file.`);
        return;
      }
      setCsvText(text);
      setCsvHeaders(headers);
      setRowCount(rows);
      setMapping(autoDetect(headers));
    };
    reader.onerror = () => setFileError('Could not read the file. Please try again.');
    reader.readAsText(file);
  }

  // ─── Upload ───────────────────────────────────────────────────────────────
  async function handleUpload() {
    if (!canUpload || isUploading) return;
    setIsUploading(true);
    setUploadError('');
    try {
      const columnMapping: Record<string, string> = {
        firstName: mapping.firstName,
        phone:     mapping.phone,
      };
      if (mapping.lastName)          columnMapping.lastName          = mapping.lastName;
      if (mapping.email)             columnMapping.email             = mapping.email;
      if (mapping.treatmentInterest) columnMapping.treatmentInterest = mapping.treatmentInterest;
      if (mapping.notes)             columnMapping.notes             = mapping.notes;
      if (mapping.language)          columnMapping.language          = mapping.language;

      const res = await api.post<BulkResult>('/api/leads/bulk', { csv: csvText, columnMapping });
      setResult(res.data);
      setPhase('result');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error || 'Upload failed. Please try again.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="px-6 py-5 border-b border-navy-600 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Bulk Lead Upload</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {phase === 'upload'  ? 'Select a CSV file to import leads'   :
               phase === 'mapping' ? 'Map your CSV columns to lead fields' :
                                     'Import complete'}
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── PHASE 1: File select ──────────────────────────────────────── */}
          {phase === 'upload' && (
            <>
              <div>
                <label className={LABEL_CLS}>
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
                      {fileName}
                      {csvHeaders.length > 0 && (
                        <span className="text-green-400 text-xs ml-1.5">
                          ✓ {csvHeaders.length} columns · {rowCount} row{rowCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {fileError && (
                <div className="flex items-start gap-2 bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <span className="text-red-400 text-sm shrink-0">✕</span>
                  <p className="text-red-400 text-sm">{fileError}</p>
                </div>
              )}

              {/* Format hint */}
              <div className="bg-navy-700/50 border border-navy-600 rounded-lg px-4 py-3 text-xs text-gray-500 space-y-1">
                <p className="text-gray-400 font-medium">Expected format</p>
                <p>First row must be a header row. Required columns: name, phone.</p>
                <p>Optional: last name, email, treatment, notes, language (en/tr/ar/de/fr/es).</p>
                <p>Maximum 500 rows per file.</p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-navy-500 text-gray-300 text-sm font-medium hover:bg-navy-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setPhase('mapping')}
                  disabled={csvHeaders.length === 0}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gold hover:bg-gold-light text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next: Map Columns →
                </button>
              </div>
            </>
          )}

          {/* ── PHASE 2: Column mapping ───────────────────────────────────── */}
          {phase === 'mapping' && (
            <>
              {/* GDPR notice */}
              <div className="bg-navy-700/50 border border-navy-600 rounded-lg px-4 py-3">
                <p className="text-gray-500 text-xs leading-relaxed">
                  🔒 Imported leads start with{' '}
                  <span className="text-gray-400 font-medium">AI follow-up OFF</span> and no consent.
                  Enable per-lead after import.
                </p>
              </div>

              {/* Required */}
              <div>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">
                  Required columns
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>
                      First name <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={mapping.firstName}
                      onChange={e => setMapping(m => ({ ...m, firstName: e.target.value }))}
                      className={SELECT_CLS}
                    >
                      <option value="">— select —</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>
                      Phone <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={mapping.phone}
                      onChange={e => setMapping(m => ({ ...m, phone: e.target.value }))}
                      className={SELECT_CLS}
                    >
                      <option value="">— select —</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Optional */}
              <div>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">
                  Optional columns
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: 'lastName',          label: 'Last name'  },
                    { key: 'email',             label: 'Email'      },
                    { key: 'treatmentInterest', label: 'Treatment'  },
                    { key: 'notes',             label: 'Notes'      },
                    { key: 'language',          label: 'Language'   },
                  ] as { key: string; label: string }[]).map(({ key, label }) => (
                    <div key={key}>
                      <label className={LABEL_CLS}>{label}</label>
                      <select
                        value={mapping[key]}
                        onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}
                        className={SELECT_CLS}
                      >
                        <option value="">— skip —</option>
                        {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {uploadError && (
                <div className="flex items-start gap-2 bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3">
                  <span className="text-red-400 text-sm shrink-0">✕</span>
                  <p className="text-red-400 text-sm">{uploadError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPhase('upload')}
                  className="px-4 py-2.5 rounded-xl border border-navy-500 text-gray-300 text-sm font-medium hover:bg-navy-700 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!canUpload || isUploading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gold hover:bg-gold-light text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUploading && (
                    <span className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                  )}
                  {isUploading
                    ? `Uploading ${rowCount} rows…`
                    : `↑ Upload ${rowCount} row${rowCount !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}

          {/* ── PHASE 3: Result ───────────────────────────────────────────── */}
          {phase === 'result' && result && (
            <>
              {/* Inserted */}
              <div className="bg-green-900/20 border border-green-700/30 rounded-xl px-5 py-4 flex items-center gap-3">
                <span className="text-green-400 text-lg">✓</span>
                <div>
                  <p className="text-green-300 font-semibold text-sm">
                    {result.insertedCount} lead{result.insertedCount !== 1 ? 's' : ''} imported
                  </p>
                  {result.skippedCount === 0 && (
                    <p className="text-green-600 text-xs mt-0.5">All rows processed successfully.</p>
                  )}
                </div>
              </div>

              {/* Skipped */}
              {result.skippedCount > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-2 border-b border-yellow-700/20">
                    <span className="text-yellow-400">⚠</span>
                    <p className="text-yellow-300 text-sm font-medium">
                      {result.skippedCount} row{result.skippedCount !== 1 ? 's' : ''} skipped
                    </p>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {result.skipped.map(s => (
                      <div
                        key={s.row}
                        className="px-4 py-2 border-b border-yellow-700/10 last:border-0 flex items-start justify-between gap-3"
                      >
                        <span className="text-yellow-600 text-xs font-medium shrink-0">Row {s.row}</span>
                        <span className="text-yellow-500 text-xs text-right">{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={resetAll}
                  className="px-4 py-2.5 rounded-xl border border-navy-500 text-gray-300 text-sm font-medium hover:bg-navy-700 transition-colors"
                >
                  ↺ Import another
                </button>
                <button
                  onClick={() => { onCompleted(); handleClose(); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gold hover:bg-gold-light text-white text-sm font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

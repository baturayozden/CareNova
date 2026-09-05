import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DemoRequest {
  id:          string;
  name:        string;
  email:       string;
  clinic_name: string;
  city:        string;
  phone:       string | null;
  status:      'pending' | 'contacted' | 'converted';
  created_at:  string;
  notes?:      string | null;
  updated_at?: string;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50' },
  contacted: { label: 'Contacted', color: 'bg-blue-900/50   text-blue-300   border-blue-700/50'   },
  converted: { label: 'Converted', color: 'bg-green-900/50  text-green-300  border-green-700/50'  },
} as const;

const STATUS_ORDER: Array<DemoRequest['status']> = ['pending', 'contacted', 'converted'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

// ── Row component ─────────────────────────────────────────────────────────────

function RequestRow({
  req,
  onStatusChange,
  isExpanded,
  onToggle,
  noteDraft,
  onNoteChange,
  savingNote,
  onSaveNote,
}: {
  req:            DemoRequest;
  onStatusChange: (id: string, status: DemoRequest['status']) => Promise<void>;
  isExpanded:     boolean;
  onToggle:       () => void;
  noteDraft:      string;
  onNoteChange:   (v: string) => void;
  savingNote:     boolean;
  onSaveNote:     () => void;
}) {
  const cfg = STATUS_CONFIG[req.status];

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onToggle}
        className={`border-b border-surface-sunken hover:bg-surface-sunken/30 transition-colors cursor-pointer ${isExpanded ? 'bg-surface-sunken/20' : ''}`}
      >
        <td className="px-4 py-4 text-white text-sm font-medium">{req.name}</td>
        <td className="px-4 py-4">
          <a
            href={`mailto:${req.email}`}
            onClick={e => e.stopPropagation()}
            className="text-accent text-sm hover:underline"
          >
            {req.email}
          </a>
          {req.phone && <p className="text-gray-500 text-xs mt-0.5">{req.phone}</p>}
        </td>
        <td className="px-4 py-4 text-gray-300 text-sm">{req.clinic_name}</td>
        <td className="px-4 py-4 text-gray-400 text-sm">{req.city}</td>
        <td className="px-4 py-4">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
            {cfg.label}
          </span>
        </td>
        <td className="px-4 py-4 text-gray-500 text-xs whitespace-nowrap">{fmtDate(req.created_at)}</td>
        <td className="px-4 py-4">
          <div className="flex gap-2">
            {STATUS_ORDER.filter(s => s !== req.status).map(s => (
              <button
                key={s}
                onClick={e => { e.stopPropagation(); onStatusChange(req.id, s); }}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${STATUS_CONFIG[s].color} hover:opacity-80`}
              >
                {`→ ${STATUS_CONFIG[s].label}`}
              </button>
            ))}
          </div>
        </td>
      </motion.tr>

      {isExpanded && (
        <tr className="border-b border-surface-sunken bg-surface/60">
          <td colSpan={7} className="px-6 py-4">
            <div onClick={e => e.stopPropagation()}>
              {/* Meta details */}
              <p className="text-gray-500 text-xs mb-3">
                {req.phone ? <>Phone: <span className="text-gray-400">{req.phone}</span> · </> : null}
                Submitted: <span className="text-gray-400">{fmtDate(req.created_at)}</span>
                {req.updated_at ? <> · Last updated: <span className="text-gray-400">{fmtDate(req.updated_at)}</span></> : null}
              </p>

              {/* Notes */}
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                Notes
              </label>
              <textarea
                rows={3}
                value={noteDraft}
                onChange={e => onNoteChange(e.target.value)}
                placeholder="Add a note about this lead..."
                className="w-full bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-accent/50 transition-colors"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={onSaveNote}
                  disabled={savingNote}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
                >
                  {savingNote ? 'Saving…' : 'Save note'}
                </button>
                {req.notes && req.notes === noteDraft && (
                  <span className="text-gray-600 text-xs">Saved</span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const FILTERS: Array<{ label: string; value: DemoRequest['status'] | 'all' }> = [
  { label: 'All',       value: 'all'       },
  { label: 'Pending',   value: 'pending'   },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Converted', value: 'converted' },
];

export default function DemoRequestsPage() {
  const [requests,    setRequests]    = useState<DemoRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState<DemoRequest['status'] | 'all'>('all');
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [noteDraft,   setNoteDraft]   = useState('');
  const [savingNote,  setSavingNote]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ requests: DemoRequest[] }>('/api/demo');
      setRequests(data.requests);
    } catch (err) {
      console.error('Failed to load demo requests', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = useCallback(async (id: string, status: DemoRequest['status']) => {
    try {
      const { data } = await api.patch<{ request: DemoRequest }>(`/api/demo/${id}/status`, { status });
      setRequests(rs => rs.map(r => r.id === id ? data.request : r));
    } catch (err) {
      console.error('Failed to update status', err);
    }
  }, []);

  const saveNote = useCallback(async (id: string) => {
    setSavingNote(true);
    try {
      const { data } = await api.patch<{ request: DemoRequest }>(`/api/demo/${id}/status`, { notes: noteDraft });
      setRequests(rs => rs.map(r => r.id === id ? data.request : r));
    } catch (err) {
      console.error('Failed to save note', err);
    } finally {
      setSavingNote(false);
    }
  }, [noteDraft]);

  const handleToggle = (req: DemoRequest) => {
    if (expandedId === req.id) {
      setExpandedId(null);
    } else {
      setExpandedId(req.id);
      setNoteDraft(req.notes || '');
    }
  };

  const visible = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  const counts = {
    all:       requests.length,
    pending:   requests.filter(r => r.status === 'pending').length,
    contacted: requests.filter(r => r.status === 'contacted').length,
    converted: requests.filter(r => r.status === 'converted').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Demo Requests</h1>
        <p className="text-gray-500 text-sm">Manage inbound demo requests from the landing page.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total',     value: counts.all,       color: 'text-white'          },
          { label: 'Pending',   value: counts.pending,   color: 'text-yellow-400'     },
          { label: 'Contacted', value: counts.contacted, color: 'text-blue-400'       },
          { label: 'Converted', value: counts.converted, color: 'text-green-400'      },
        ].map(s => (
          <div key={s.label} className="bg-surface-sunken border border-line rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-accent text-white'
                : 'bg-surface-sunken text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-60">
              {f.value === 'all' ? counts.all : counts[f.value as keyof typeof counts]}
            </span>
          </button>
        ))}
        <button onClick={load} className="ml-auto text-xs text-gray-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-sunken">
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface-sunken border border-line rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-line border-t-accent rounded-full animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-sm">{filter === 'all' ? 'No demo requests yet.' : `No ${filter} requests.`}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-sunken">
                  {['Name', 'Email / Phone', 'Clinic', 'City', 'Status', 'Submitted', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(req => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    onStatusChange={handleStatusChange}
                    isExpanded={expandedId === req.id}
                    onToggle={() => handleToggle(req)}
                    noteDraft={expandedId === req.id ? noteDraft : (req.notes || '')}
                    onNoteChange={setNoteDraft}
                    savingNote={savingNote}
                    onSaveNote={() => saveNote(req.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

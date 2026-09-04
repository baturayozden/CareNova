import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Clinic } from '../types';
import AddClinicModal from '../components/AddClinicModal';
import EditClinicModal from '../components/EditClinicModal';
import ConfirmModal from '../components/ConfirmModal';
import { Users, CheckCircle, PoundSterling, Building2, MapPin } from 'lucide-react';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(n: number): string {
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${n.toLocaleString()}`;
}

const PLAN_BADGE: Record<string, string> = {
  free:       'bg-gray-800   text-gray-400   border border-gray-600',
  starter:    'bg-gray-800   text-gray-400   border border-gray-600',
  growth:     'bg-blue-900   text-blue-300   border border-blue-700',
  pro:        'bg-purple-900 text-purple-300 border border-purple-700',
  enterprise: 'bg-gold/10    text-gold       border border-gold/30',
};

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-green-900  text-green-300  border border-green-700',
  pending:   'bg-yellow-900 text-yellow-300 border border-yellow-700',
  suspended: 'bg-red-900    text-red-300    border border-red-700',
  cancelled: 'bg-gray-800   text-gray-400   border border-gray-600',
};

export default function ClinicsPage() {
  const [clinics,   setClinics]   = useState<Clinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Modal state
  const [showAdd,      setShowAdd]      = useState(false);
  const [editClinic,   setEditClinic]   = useState<Clinic | null>(null);
  const [suspendTarget,setSuspendTarget]= useState<Clinic | null>(null);
  const [actionLoading,setActionLoading]= useState(false);

  const fetchClinics = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get<{ clinics: Clinic[] }>('/api/clinics');
      setClinics(res.data.clinics);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load clinics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchClinics(); }, [fetchClinics]);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleSuspend() {
    if (!suspendTarget) return;
    setActionLoading(true);
    try {
      const isSuspended = suspendTarget.status === 'suspended';
      const action = isSuspended ? 'activate' : 'suspend';
      const res = await api.patch<{ clinic: Clinic }>(`/api/clinics/${suspendTarget.id}/${action}`);
      setClinics(cs => cs.map(c => c.id === suspendTarget.id ? { ...c, ...res.data.clinic } : c));
      setSuspendTarget(null);
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const totalLeads    = clinics.reduce((s, c) => s + c.totalLeads,  0);
  const totalBooked   = clinics.reduce((s, c) => s + c.bookedLeads, 0);
  const totalPipeline = clinics.reduce((s, c) => s + c.mrrPipeline, 0);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
          <div>
            <h1 className="font-serif text-3xl text-white">Clinics</h1>
            <p className="text-gray-400 text-sm mt-1">{clinics.length} clinic{clinics.length !== 1 ? 's' : ''} on the platform</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={fetchClinics}
              className="text-xs text-gold hover:text-gold-light transition-colors px-3 py-1 border border-navy-600 rounded-lg">
              ↻ Refresh
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="text-xs bg-gold hover:bg-gold-light text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              + Add Clinic
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {!isLoading && clinics.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {([
              { label: 'Total Leads',    value: totalLeads,                    icon: Users          },
              { label: 'Booked',         value: totalBooked,                   icon: CheckCircle    },
              { label: 'Pipeline Value', value: formatCurrency(totalPipeline), icon: PoundSterling  },
            ] as { label: string; value: string | number; icon: IconComponent }[]).map(card => (
              <div key={card.label} className="bg-navy-800 border border-navy-600 rounded-xl p-5 flex items-center gap-4">
                {(() => { const Icon = card.icon; return <Icon size={24} className="text-gold" />; })()}
                <div>
                  <p className="text-2xl font-semibold text-gold">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
            ⚠ {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 text-sm">Loading clinics…</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {clinics.map(clinic => (
              <ClinicCard
                key={clinic.id}
                clinic={clinic}
                onEdit={() => setEditClinic(clinic)}
                onSuspend={() => setSuspendTarget(clinic)}
              />
            ))}
            {clinics.length === 0 && (
              <div className="py-12 text-center text-gray-500 text-sm bg-navy-800 border border-navy-600 rounded-xl">
                No clinics yet.{' '}
                <button onClick={() => setShowAdd(true)} className="text-gold hover:underline">
                  Add your first clinic →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {showAdd && (
        <AddClinicModal
          onClose={() => setShowAdd(false)}
          onCreated={clinic => setClinics(cs => [...cs, clinic])}
        />
      )}

      {editClinic && (
        <EditClinicModal
          clinic={editClinic}
          onClose={() => setEditClinic(null)}
          onUpdated={updated =>
            setClinics(cs => cs.map(c => c.id === updated.id ? { ...c, ...updated } : c))
          }
        />
      )}

      {suspendTarget && (
        <ConfirmModal
          title={suspendTarget.status === 'suspended' ? 'Reactivate clinic?' : 'Suspend clinic?'}
          message={
            suspendTarget.status === 'suspended'
              ? <>Re-enable all staff accounts and resume AI follow-ups for <strong className="text-white">{suspendTarget.name}</strong>.</>
              : <>Disable all staff logins and stop AI follow-ups for <strong className="text-white">{suspendTarget.name}</strong>. You can reactivate at any time.</>
          }
          confirmLabel={suspendTarget.status === 'suspended' ? 'Activate' : 'Suspend'}
          confirmDanger={suspendTarget.status !== 'suspended'}
          isLoading={actionLoading}
          onConfirm={handleSuspend}
          onCancel={() => setSuspendTarget(null)}
        />
      )}

    </div>
  );
}

// ── Clinic card component ─────────────────────────────────────────────────────

interface CardProps {
  clinic: Clinic;
  onEdit: () => void;
  onSuspend: () => void;
}

function ClinicCard({ clinic, onEdit, onSuspend }: CardProps) {
  const isSuspended = clinic.status === 'suspended';

  return (
    <div className={`bg-navy-800 border rounded-xl p-6 transition-colors ${
      isSuspended ? 'border-red-900/50 opacity-75' : 'border-navy-600 hover:border-navy-500'
    }`}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">

        {/* Icon + name */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-navy-700 border border-navy-500 flex items-center justify-center shrink-0">
            <Building2 size={22} className="text-gold" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                to={`/clinics/${clinic.id}`}
                className="text-white font-semibold text-lg hover:text-gold transition-colors"
              >
                {clinic.name}
              </Link>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                (STATUS_BADGE as Record<string, string>)[clinic.status] ?? STATUS_BADGE.active
              }`}>
                {clinic.status.charAt(0).toUpperCase() + clinic.status.slice(1)}
              </span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                (PLAN_BADGE as Record<string, string>)[clinic.planTier] ?? PLAN_BADGE.starter
              }`}>
                {clinic.planTier.charAt(0).toUpperCase() + clinic.planTier.slice(1)}
              </span>
            </div>
            <p className="text-gray-500 text-xs mt-1">Joined {formatDate(clinic.createdAt)}</p>
            {clinic.address && <p className="text-gray-500 text-xs mt-0.5"><MapPin size={12} className="inline mr-1 -mt-0.5 text-gray-500" />{clinic.address}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-3 sm:gap-6 items-center shrink-0 w-full lg:w-auto">
          <Stat label="Leads"        value={clinic.totalLeads} />
          <Stat label="Booked"       value={clinic.bookedLeads} />
          <Stat label="Booking Rate" value={`${clinic.bookingRate}%`} highlight />
          <Stat label="Pipeline"     value={formatCurrency(clinic.mrrPipeline)} highlight />
          <Stat label="Staff"        value={clinic.staffCount} />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Link
            to={`/clinics/${clinic.id}`}
            className="text-xs text-gray-400 hover:text-white bg-navy-700 hover:bg-navy-600 px-3 py-1.5 rounded-lg border border-navy-500 transition-colors"
          >
            View →
          </Link>
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="text-xs text-gray-400 hover:text-white bg-navy-700 hover:bg-navy-600 px-3 py-1.5 rounded-lg border border-navy-500 transition-colors"
          >
            ✏
          </button>
          <button
            onClick={e => { e.stopPropagation(); onSuspend(); }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              isSuspended
                ? 'text-green-400 bg-green-950 hover:bg-green-900 border-green-800'
                : 'text-yellow-400 bg-yellow-950 hover:bg-yellow-900 border-yellow-800'
            }`}
          >
            {isSuspended ? '▶' : '⏸'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="text-right">
      <p className={`text-lg font-semibold ${highlight ? 'text-gold' : 'text-white'}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

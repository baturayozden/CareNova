import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { AppointmentsTab } from './ClinicDetailPage';

const SEL = 'bg-surface-sunken border border-line rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-accent transition-colors';

export default function AppointmentsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  const [clinicOptions, setClinicOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');

  // Super admin: fetch clinic list on mount
  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get<{ clinics: { id: string; name: string }[] }>('/api/clinics')
      .then(r => {
        const list = r.data.clinics.map(c => ({ id: c.id, name: c.name }));
        setClinicOptions(list);
        if (list.length > 0) setSelectedClinicId(list[0].id);
      })
      .catch(() => {});
  }, [isSuperAdmin]);

  const effectiveClinicId = isSuperAdmin ? selectedClinicId : (user?.tenantId ?? '');

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
          <div>
            <h1 className="font-serif text-3xl text-white">Appointments</h1>
            <p className="text-gray-400 text-sm mt-1">Manage and review scheduled patient appointments</p>
          </div>

          {/* Clinic selector — super admin only */}
          {isSuperAdmin && clinicOptions.length > 0 && (
            <select
              className={SEL}
              value={selectedClinicId}
              onChange={e => setSelectedClinicId(e.target.value)}
            >
              {clinicOptions.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Appointments table */}
        {effectiveClinicId ? (
          <AppointmentsTab clinicId={effectiveClinicId} />
        ) : (
          <div className="text-center py-20 text-gray-500 text-sm">
            {isSuperAdmin ? 'Select a clinic to view appointments.' : 'No clinic assigned to your account.'}
          </div>
        )}

      </div>
    </div>
  );
}

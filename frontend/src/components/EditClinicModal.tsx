import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Clinic } from '../types';

interface Props {
  clinic: Clinic;
  onClose: () => void;
  onUpdated: (clinic: Clinic) => void;
}

const PLAN_OPTIONS = [
  { value: 'starter',    label: 'Starter'    },
  { value: 'growth',     label: 'Growth'     },
  { value: 'pro',        label: 'Pro'        },
  { value: 'enterprise', label: 'Enterprise' },
];

const TIMEZONE_OPTIONS = [
  'Europe/London', 'Europe/Istanbul', 'Europe/Berlin', 'Europe/Paris',
  'America/New_York', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Riyadh',
];

const INPUT = 'w-full bg-navy-700 border border-navy-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold transition-colors';
const LABEL = 'block text-xs font-medium text-gray-400 mb-1.5';

export default function EditClinicModal({ clinic, onClose, onUpdated }: Props) {
  const [form, setForm] = useState({
    name:     clinic.name,
    address:  clinic.address  || '',
    phone:    clinic.phone    || '',
    email:    clinic.email    || '',
    website:  clinic.website  || '',
    planTier: clinic.planTier,
    timezone: clinic.timezone || 'Europe/Istanbul',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Reset when clinic prop changes
  useEffect(() => {
    setForm({
      name: clinic.name, address: clinic.address || '', phone: clinic.phone || '',
      email: clinic.email || '', website: clinic.website || '',
      planTier: clinic.planTier, timezone: clinic.timezone || 'Europe/Istanbul',
    });
  }, [clinic]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Clinic name is required'); return; }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.put<{ clinic: Clinic }>(`/api/clinics/${clinic.id}`, form);
      onUpdated(res.data.clinic);
      onClose();
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to update clinic');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-navy-600 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Edit Clinic</h2>
            <p className="text-gray-500 text-xs mt-0.5">{clinic.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className={LABEL}>Clinic name <span className="text-red-400">*</span></label>
            <input className={INPUT} value={form.name} onChange={set('name')} />
          </div>

          <div>
            <label className={LABEL}>Address</label>
            <input className={INPUT} placeholder="Street address" value={form.address} onChange={set('address')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Phone</label>
              <input className={INPUT} placeholder="+44 20 7946 0000" value={form.phone} onChange={set('phone')} />
            </div>
            <div>
              <label className={LABEL}>Email</label>
              <input className={INPUT} type="email" placeholder="hello@clinic.com" value={form.email} onChange={set('email')} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Website</label>
            <input className={INPUT} placeholder="https://www.clinic.com" value={form.website} onChange={set('website')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Plan</label>
              <select className={INPUT} value={form.planTier} onChange={set('planTier')}>
                {PLAN_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Timezone</label>
              <select className={INPUT} value={form.timezone} onChange={set('timezone')}>
                {TIMEZONE_OPTIONS.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-xs px-4 py-3 rounded-lg">
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-navy-500 text-gray-300 text-sm font-medium hover:bg-navy-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gold hover:bg-gold-light text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {isLoading && <span className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

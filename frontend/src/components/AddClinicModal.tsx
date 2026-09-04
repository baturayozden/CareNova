import React, { useState } from 'react';
import api from '../lib/api';
import { Clinic } from '../types';

interface CreatedCredentials {
  clinic: Clinic;
  admin: { email: string; firstName: string; lastName: string; password: string };
}

interface Props {
  onClose: () => void;
  onCreated: (clinic: Clinic) => void;
}

const PLAN_OPTIONS = [
  { value: 'starter',    label: 'Starter',    desc: 'Up to 50 leads/mo'      },
  { value: 'growth',     label: 'Growth',     desc: 'Up to 300 leads/mo'     },
  { value: 'pro',        label: 'Pro',        desc: 'Unlimited leads'         },
];

const INPUT = 'w-full bg-navy-700 border border-navy-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold transition-colors';
const LABEL = 'block text-xs font-medium text-gray-400 mb-1.5';

export default function AddClinicModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    name: '', address: '', phone: '', email: '', website: '', planTier: 'growth',
  });
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [credentials,  setCredentials]  = useState<CreatedCredentials | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Clinic name is required'); return; }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<CreatedCredentials>('/api/clinics', form);
      setCredentials(res.data);
      onCreated(res.data.clinic);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error || 'Failed to create clinic';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={credentials ? onClose : undefined} />

      <div className="relative bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

        {credentials ? (
          /* ── Success screen ──────────────────────────────────────────── */
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-green-900 border border-green-700 flex items-center justify-center text-3xl mx-auto">
              ✅
            </div>
            <div>
              <h2 className="text-white font-semibold text-xl">Clinic created!</h2>
              <p className="text-gray-400 text-sm mt-1">
                <strong className="text-white">{credentials.clinic.name}</strong> is now live on the platform.
              </p>
            </div>

            <div className="bg-navy-700 border border-navy-500 rounded-xl p-5 text-left space-y-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Login credentials</p>
              <Credential label="Email"    value={credentials.admin.email} />
              <Credential label="Password" value={credentials.admin.password} monospace />
              <p className="text-xs text-yellow-400 mt-2">
                ⚠ Password must be changed on first login.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-gold hover:bg-gold-light text-white font-medium py-3 rounded-xl text-sm transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          /* ── Form ────────────────────────────────────────────────────── */
          <>
            <div className="px-6 py-5 border-b border-navy-600 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold text-lg">Add New Clinic</h2>
                <p className="text-gray-500 text-xs mt-0.5">Creates a clinic + clinic admin account</p>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

              {/* Clinic name */}
              <div>
                <label className={LABEL}>Clinic name <span className="text-red-400">*</span></label>
                <input className={INPUT} placeholder="e.g. Bright Smile Dental" value={form.name} onChange={set('name')} />
              </div>

              {/* Address */}
              <div>
                <label className={LABEL}>Address</label>
                <input className={INPUT} placeholder="e.g. 42 Harley Street, London W1G 8PR" value={form.address} onChange={set('address')} />
              </div>

              {/* Phone + Email */}
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

              {/* Website */}
              <div>
                <label className={LABEL}>Website</label>
                <input className={INPUT} placeholder="https://www.clinic.com" value={form.website} onChange={set('website')} />
              </div>

              {/* Plan */}
              <div>
                <label className={LABEL}>Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLAN_OPTIONS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, planTier: p.value }))}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        form.planTier === p.value
                          ? 'border-gold bg-gold/10 text-white'
                          : 'border-navy-500 bg-navy-700 text-gray-400 hover:border-navy-400'
                      }`}
                    >
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-950 border border-red-800 text-red-300 text-xs px-4 py-3 rounded-lg">
                  ⚠ {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-navy-500 text-gray-300 text-sm font-medium hover:bg-navy-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gold hover:bg-gold-light text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading && <span className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />}
                  Create Clinic
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Credential({ label, value, monospace }: { label: string; value: string; monospace?: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-400 text-xs w-16 shrink-0">{label}</span>
      <span className={`text-white text-sm flex-1 min-w-0 truncate ${monospace ? 'font-mono' : ''}`}>{value}</span>
      <button
        onClick={copy}
        className="text-xs text-gold hover:text-gold-light shrink-0 transition-colors"
      >
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  );
}

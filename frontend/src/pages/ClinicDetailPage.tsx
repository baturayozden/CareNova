import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ClinicDetail, StaffMember, Clinic, AiUsageData } from '../types';
import EditClinicModal from '../components/EditClinicModal';
import ConfirmModal from '../components/ConfirmModal';
import { formatDate } from '../utils/date';
import { MessageCircle, ClipboardList, Lock, LockOpen, MapPin, Clock, Phone, Mail, Globe, Building2, Bot, Settings as SettingsIcon, BookOpen, CalendarDays, Users, CheckCircle, TrendingUp, PoundSterling, Zap, Search, KeyRound } from 'lucide-react';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

// ── helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${n.toLocaleString()}`;
}

function formatResponseTime(secs: number | null): string {
  if (secs === null) return '—';
  if (secs < 60)  return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}


function formatRelativeDate(iso: string | null) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  return formatDate(iso);
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

const ROLE_BADGE: Record<string, string> = {
  director:               'bg-gold/10    text-gold       border border-gold/30',
  clinic_admin:           'bg-blue-900   text-blue-300   border border-blue-700',
  treatment_coordinator:  'bg-purple-900 text-purple-300 border border-purple-700',
  receptionist:           'bg-green-900  text-green-300  border border-green-700',
  sales:                  'bg-orange-900 text-orange-300 border border-orange-700',
  dentist:                'bg-cyan-900   text-cyan-300   border border-cyan-700',
  nurse:                  'bg-rose-900   text-rose-300   border border-rose-700',
};

const ROLE_LABELS: Record<string, string> = {
  director:               'Director',
  clinic_admin:           'Clinic Admin',
  treatment_coordinator:  'Treatment Coordinator',
  receptionist:           'Receptionist',
  sales:                  'Sales',
  dentist:                'Dentist',
  nurse:                  'Nurse',
};

// ── AI Usage Tab ─────────────────────────────────────────────────────────────

const SCENARIO_LABELS: Record<string, string> = {
  new_enquiry:       'New Enquiry',
  finance_objection: 'Finance Objection',
  cold_lead:         'Cold Lead',
  missed_call:       'Missed Call',
};
const SCENARIO_COLORS: Record<string, string> = {
  new_enquiry:       'bg-blue-500',
  finance_objection: 'bg-yellow-500',
  cold_lead:         'bg-purple-500',
  missed_call:       'bg-orange-500',
};
const LANG_NAMES: Record<string, string> = { en: '🇬🇧 English', tr: '🇹🇷 Turkish', ar: '🇸🇦 Arabic', es: '🇪🇸 Spanish', ru: '🇷🇺 Russian' };

function Sparkline({ data, color = '#d4a853' }: { data: number[]; color?: string }) {
  if (!data.length) return <span className="text-gray-600 text-xs">No data</span>;
  const w = 200, h = 48, pad = 4;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const xs = data.map((_, i) => pad + (i / Math.max(data.length - 1, 1)) * (w - 2 * pad));
  const ys = data.map(v => h - pad - ((v - min) / range) * (h - 2 * pad));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const area = `${d} L${xs[xs.length - 1].toFixed(1)},${(h - pad).toFixed(1)} L${xs[0].toFixed(1)},${(h - pad).toFixed(1)} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={area} fill={color} fillOpacity={0.1} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* last point dot */}
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="2.5" fill={color} />
    </svg>
  );
}

// ── WhatsApp Onboarding Wizard ────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4;

interface WizardState {
  phoneNumberId: string;
  accessToken:   string;
  testStatus:    'idle' | 'testing' | 'ok' | 'error';
  testMessage:   string;
  displayName:   string;
  saving:        boolean;
  saved:         boolean;
}

function WhatsAppWizardModal({
  clinicId,
  onClose,
  onConnected,
}: {
  clinicId:    string;
  onClose:     () => void;
  onConnected: (cfg: { displayName: string; phoneNumberId: string }) => void;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [state, setState] = useState<WizardState>({
    phoneNumberId: '',
    accessToken:   '',
    testStatus:    'idle',
    testMessage:   '',
    displayName:   '',
    saving:        false,
    saved:         false,
  });

  function set(patch: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...patch }));
  }

  async function handleTest() {
    if (!state.phoneNumberId.trim() || !state.accessToken.trim()) return;
    set({ testStatus: 'testing', testMessage: '' });
    try {
      const res = await api.post<{ success: boolean; displayName?: string; phone?: string; error?: string }>(
        `/api/clinics/${clinicId}/whatsapp/test`,
        { phoneNumberId: state.phoneNumberId.trim(), accessToken: state.accessToken.trim() },
      );
      if (res.data.success) {
        set({ testStatus: 'ok', testMessage: `✅ Connected — ${res.data.displayName || 'WhatsApp Business'}`, displayName: res.data.displayName || 'WhatsApp Business' });
      } else {
        set({ testStatus: 'error', testMessage: res.data.error || 'Connection failed' });
      }
    } catch (err: unknown) {
      set({ testStatus: 'error', testMessage: (err as any)?.response?.data?.error || 'Failed to test connection' });
    }
  }

  async function handleConnect() {
    set({ saving: true });
    try {
      await api.post(
        `/api/clinics/${clinicId}/whatsapp/connect`,
        { phoneNumberId: state.phoneNumberId.trim(), accessToken: state.accessToken.trim(), displayName: state.displayName },
      );
      set({ saved: true, saving: false });
      onConnected({ displayName: state.displayName, phoneNumberId: state.phoneNumberId.trim() });
    } catch (err: unknown) {
      set({ saving: false, testMessage: (err as any)?.response?.data?.error || 'Failed to save' });
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  const WEBHOOK_URL    = 'https://api.carenova.ai/webhook/whatsapp';
  const VERIFY_TOKEN   = 'carenova_webhook_2026';

  const steps = [
    { n: 1, label: 'Phone Number ID' },
    { n: 2, label: 'Access Token' },
    { n: 3, label: 'Webhook Setup' },
    { n: 4, label: 'Test & Connect' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-navy-900 border border-navy-600 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <div className="flex items-center gap-2">
            <MessageCircle size={24} className="text-[#25D366] shrink-0" />
            <div>
              <h2 className="text-white font-semibold text-base">Connect WhatsApp</h2>
              <p className="text-gray-500 text-xs">WhatsApp Business API setup</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 pt-5">
          {steps.map((s, idx) => (
            <React.Fragment key={s.n}>
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  step === s.n
                    ? 'bg-gold border-gold text-white'
                    : step > s.n
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-transparent border-navy-500 text-gray-500'
                }`}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className={`text-xs mt-1 whitespace-nowrap ${step === s.n ? 'text-gold' : 'text-gray-600'}`}>{s.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 mx-1 transition-all ${step > s.n ? 'bg-green-600' : 'bg-navy-600'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[220px]">

          {/* Step 1 — Phone Number ID */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-white font-medium text-sm mb-1">Phone Number ID</p>
                <p className="text-gray-500 text-xs mb-3">
                  Go to <strong className="text-gray-300">Meta for Developers</strong> → Your App → <strong className="text-gray-300">WhatsApp</strong> → API Setup. Copy the <em>Phone Number ID</em> (not the phone number itself).
                </p>
              </div>
              <div className="bg-navy-800 rounded-xl p-4 border border-navy-600 flex items-center gap-3 text-xs text-gray-400">
                <ClipboardList size={22} className="shrink-0 text-gray-400" />
                <span>Navigate to <strong className="text-white">developers.facebook.com</strong> → My Apps → [Your App] → WhatsApp → API Setup → Phone numbers</span>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1.5">Phone Number ID</label>
                <input
                  type="text"
                  placeholder="e.g. 123456789012345"
                  value={state.phoneNumberId}
                  onChange={e => set({ phoneNumberId: e.target.value })}
                  className="w-full bg-navy-800 border border-navy-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-gold placeholder-gray-600"
                />
              </div>
            </div>
          )}

          {/* Step 2 — Access Token */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-white font-medium text-sm mb-1">Access Token</p>
                <p className="text-gray-500 text-xs mb-3">
                  In the same API Setup page, copy your <strong className="text-gray-300">temporary or permanent access token</strong>. For production, use a <em>System User</em> permanent token.
                </p>
              </div>
              <div className="bg-navy-800 rounded-xl p-4 border border-yellow-900/50 flex items-start gap-3 text-xs text-yellow-400/80">
                <Lock size={16} className="shrink-0 mt-0.5 text-yellow-400/80" />
                <span>This token is stored securely and used only to send WhatsApp messages on your behalf.</span>
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1.5">Access Token</label>
                <input
                  type="password"
                  placeholder="EAAxxxxxxxxxxxxxxx..."
                  value={state.accessToken}
                  onChange={e => set({ accessToken: e.target.value })}
                  className="w-full bg-navy-800 border border-navy-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-gold placeholder-gray-600 font-mono"
                />
              </div>
            </div>
          )}

          {/* Step 3 — Webhook Setup */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-white font-medium text-sm mb-1">Configure Webhook</p>
                <p className="text-gray-500 text-xs mb-3">
                  In Meta for Developers → WhatsApp → Configuration, set up the webhook with these values:
                </p>
              </div>
              <div className="space-y-3">
                <div className="bg-navy-800 rounded-xl p-3 border border-navy-600">
                  <p className="text-gray-500 text-xs mb-1">Callback URL</p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-green-400 text-xs font-mono break-all">{WEBHOOK_URL}</code>
                    <button
                      onClick={() => copyToClipboard(WEBHOOK_URL)}
                      className="shrink-0 text-xs text-gray-500 hover:text-white border border-navy-500 rounded-lg px-2.5 py-1 transition-colors"
                    >📋 Copy</button>
                  </div>
                </div>
                <div className="bg-navy-800 rounded-xl p-3 border border-navy-600">
                  <p className="text-gray-500 text-xs mb-1">Verify Token</p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-green-400 text-xs font-mono">{VERIFY_TOKEN}</code>
                    <button
                      onClick={() => copyToClipboard(VERIFY_TOKEN)}
                      className="shrink-0 text-xs text-gray-500 hover:text-white border border-navy-500 rounded-lg px-2.5 py-1 transition-colors"
                    >📋 Copy</button>
                  </div>
                </div>
              </div>
              <div className="bg-navy-800 rounded-xl p-3 border border-navy-600 text-xs text-gray-400 space-y-1.5">
                <p className="text-gray-300 font-medium">Webhook fields to subscribe:</p>
                <p>• <code className="text-green-400">messages</code> — inbound patient messages</p>
                <p>• <code className="text-green-400">message_deliveries</code> — delivery receipts</p>
                <p>• <code className="text-green-400">message_reads</code> — read receipts</p>
              </div>
            </div>
          )}

          {/* Step 4 — Test & Connect */}
          {step === 4 && (
            <div className="space-y-4">
              {state.saved ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <CheckCircle size={48} className="text-green-400" />
                  <p className="text-white font-semibold">WhatsApp Connected!</p>
                  <p className="text-gray-400 text-sm text-center">{state.displayName} is now active. AI follow-ups will be sent via this number.</p>
                  <button onClick={onClose} className="mt-2 bg-gold text-white font-semibold text-sm px-6 py-2.5 rounded-xl hover:bg-gold/80 transition-colors">
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-white font-medium text-sm mb-1">Test Connection</p>
                    <p className="text-gray-500 text-xs mb-3">
                      Click Test to verify your credentials work with Meta's API before saving.
                    </p>
                  </div>
                  <div className="bg-navy-800 rounded-xl p-4 border border-navy-600 space-y-2 text-xs text-gray-400">
                    <div className="flex justify-between"><span>Phone Number ID</span><code className="text-gray-300 font-mono">{state.phoneNumberId.slice(0, 12)}…</code></div>
                    <div className="flex justify-between"><span>Access Token</span><code className="text-gray-300 font-mono">{'•'.repeat(12)}</code></div>
                  </div>
                  {state.testMessage && (
                    <div className={`rounded-xl px-4 py-3 text-sm font-medium ${state.testStatus === 'ok' ? 'bg-green-900/50 text-green-300 border border-green-800' : 'bg-red-900/50 text-red-300 border border-red-800'}`}>
                      {state.testMessage}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={handleTest}
                      disabled={state.testStatus === 'testing'}
                      className="flex-1 bg-navy-700 hover:bg-navy-600 text-white border border-navy-500 text-sm font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {state.testStatus === 'testing' && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      <Search size={16} /> Test Connection
                    </button>
                    <button
                      onClick={handleConnect}
                      disabled={state.testStatus !== 'ok' || state.saving}
                      className="flex-1 bg-[#25D366] hover:bg-[#20b558] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {state.saving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      💾 Save & Connect
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {!state.saved && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-navy-700">
            <button
              onClick={() => step > 1 ? setStep((step - 1) as WizardStep) : onClose()}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {step === 1 ? '✕ Cancel' : '← Back'}
            </button>
            {step < 4 && (
              <button
                onClick={() => setStep((step + 1) as WizardStep)}
                disabled={
                  (step === 1 && !state.phoneNumberId.trim()) ||
                  (step === 2 && !state.accessToken.trim())
                }
                className="bg-gold hover:bg-gold/80 text-white font-semibold text-sm px-6 py-2 rounded-xl transition-colors disabled:opacity-40"
              >
                Next →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function buildMonthOptions() {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    return { value, label };
  });
}

function AiUsageTab({ clinicId }: { clinicId: string }) {
  const [data,    setData]    = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const monthOptions = buildMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState<string>(monthOptions[0].value);

  useEffect(() => {
    setLoading(true);
    api.get<AiUsageData>(`/api/clinics/${clinicId}/ai-usage?month=${selectedMonth}`)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load AI usage data'))
      .finally(() => setLoading(false));
  }, [clinicId, selectedMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-red-400 text-sm text-center py-12">{error || 'No data'}</p>;
  }

  const { thisMonth, lastMonth, topScenarios, responseTimeTrend, languageBreakdown, recoveryRateTrend, lastUpdated } = data;
  const msgDelta   = thisMonth.messages - lastMonth.messages;
  const costDelta  = thisMonth.estimatedCost - lastMonth.estimatedCost;
  const totalLang  = languageBreakdown.reduce((s, l) => s + l.count, 0) || 1;
  const respValues = responseTimeTrend.map(r => r.avgSecs);
  const recovValues= recoveryRateTrend.map(r => r.rate);
  const maxScenario = topScenarios[0]?.count || 1;

  function fmtSecs(s: number) {
    if (s < 60)   return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  }
  function deltaClass(n: number, higherBetter = true) {
    if (n === 0) return 'text-gray-500';
    return (higherBetter ? n > 0 : n < 0) ? 'text-green-400' : 'text-red-400';
  }
  function deltaSign(n: number) { return n > 0 ? '+' : ''; }

  return (
    <div className="space-y-5 pt-1">

      {/* ── Month selector + last updated ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="bg-navy-800 border border-navy-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-gold transition-colors"
        >
          {monthOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {lastUpdated && (
          <p className="text-gray-600 text-xs">
            Updated {new Date(lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* ── Top stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* AI Messages */}
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">AI Messages — This Month</p>
          <p className="text-3xl font-semibold text-white">{thisMonth.messages.toLocaleString()}</p>
          <p className={`text-xs mt-1 ${deltaClass(msgDelta)}`}>
            {deltaSign(msgDelta)}{msgDelta} vs last month ({lastMonth.messages.toLocaleString()})
          </p>
        </div>

        {/* Estimated Cost */}
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Est. Anthropic Cost — This Month</p>
          <p className="text-3xl font-semibold text-gold">${thisMonth.estimatedCost.toFixed(2)}</p>
          <p className={`text-xs mt-1 ${deltaClass(costDelta, false)}`}>
            {deltaSign(costDelta)}${costDelta.toFixed(2)} vs last month · ${(thisMonth.messages ? (thisMonth.estimatedCost / thisMonth.messages).toFixed(4) : '0.0000')} per msg
          </p>
        </div>
      </div>

      {/* ── Two-column: scenarios + language ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Top Scenarios */}
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
          <p className="text-white font-medium text-sm mb-4">Top Scenarios <span className="text-gray-500 font-normal">(last 30 days)</span></p>
          {topScenarios.length === 0 ? (
            <p className="text-gray-600 text-xs">No scenario data yet.</p>
          ) : (
            <div className="space-y-3">
              {topScenarios.map(s => (
                <div key={s.scenario}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-300 text-xs">{SCENARIO_LABELS[s.scenario] ?? s.scenario}</span>
                    <span className="text-gray-400 text-xs font-medium">{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${SCENARIO_COLORS[s.scenario] ?? 'bg-gray-500'}`}
                      style={{ width: `${(s.count / maxScenario) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Language Breakdown */}
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
          <p className="text-white font-medium text-sm mb-4">Language Breakdown</p>
          {languageBreakdown.length === 0 ? (
            <p className="text-gray-600 text-xs">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {languageBreakdown.map(l => {
                const pct = Math.round(l.count / totalLang * 100);
                return (
                  <div key={l.language}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-300 text-xs">{LANG_NAMES[l.language] ?? l.language.toUpperCase()}</span>
                      <span className="text-gray-400 text-xs font-medium">{l.count} <span className="text-gray-600">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gold transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Two-column: response time trend + recovery rate ─────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Response Time Trend */}
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-white font-medium text-sm">Response Time Trend</p>
              <p className="text-gray-500 text-xs">Last 30 days · daily average</p>
            </div>
            {respValues.length > 0 && (
              <div className="text-right">
                <p className="text-gold text-lg font-semibold">{fmtSecs(respValues[respValues.length - 1] ?? 0)}</p>
                <p className="text-gray-600 text-[10px]">latest</p>
              </div>
            )}
          </div>
          {respValues.length > 1 ? (
            <Sparkline data={respValues} color="#d4a853" />
          ) : (
            <p className="text-gray-600 text-xs py-4">Not enough data yet.</p>
          )}
        </div>

        {/* Lead Recovery Rate Trend */}
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-white font-medium text-sm">Lead Recovery Rate</p>
              <p className="text-gray-500 text-xs">Last 12 weeks</p>
            </div>
            {recovValues.length > 0 && (
              <div className="text-right">
                <p className="text-gold text-lg font-semibold">{recovValues[recovValues.length - 1].toFixed(1)}%</p>
                <p className="text-gray-600 text-[10px]">this week</p>
              </div>
            )}
          </div>
          {recovValues.length > 1 ? (
            <Sparkline data={recovValues} color="#22c55e" />
          ) : (
            <p className="text-gray-600 text-xs py-4">Not enough data yet.</p>
          )}
          {recoveryRateTrend.length > 0 && (
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
              <span>{recoveryRateTrend.reduce((s, w) => s + w.total, 0)} total leads</span>
              <span>{recoveryRateTrend.reduce((s, w) => s + w.recovered, 0)} recovered</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Add Staff mini-form ───────────────────────────────────────────────────────

interface AddStaffFormProps {
  clinicId: string;
  onAdded: (staff: StaffMember, password?: string, addedToClinic?: boolean) => void;
  onCancel: () => void;
}

function AddStaffForm({ clinicId, onAdded, onCancel }: AddStaffFormProps) {
  const [form, setForm]       = useState({ email: '', firstName: '', lastName: '', role: 'receptionist' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const INPUT = 'w-full min-w-0 bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold/40 transition-colors';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.firstName) { setError('Email and first name are required'); return; }
    setIsLoading(true); setError(null);
    try {
      const res = await api.post<{ staff: StaffMember; password?: string; addedToClinic?: boolean }>(
        `/api/clinics/${clinicId}/staff`, form
      );
      onAdded(res.data.staff, res.data.password, res.data.addedToClinic);
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to add staff');
    } finally {
      setIsLoading(false);
    }
  }

  const labelCls = 'block text-xs font-medium text-gray-400 mb-1';

  return (
    <form onSubmit={handleSubmit} className="bg-navy-800 border border-navy-600 rounded-xl p-4 space-y-3 mt-3">
      <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">New Staff Member</p>
      <div className="grid grid-cols-2 gap-3 min-w-0">
        <div className="min-w-0">
          <label className={labelCls}>First Name <span className="text-red-400">*</span></label>
          <input className={INPUT} placeholder="Jane" value={form.firstName}
            onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
        </div>
        <div className="min-w-0">
          <label className={labelCls}>Last Name</label>
          <input className={INPUT} placeholder="Smith" value={form.lastName}
            onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Email <span className="text-red-400">*</span></label>
        <input className={INPUT} type="email" placeholder="jane@clinic.com" value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </div>
      <div>
        <label className={labelCls}>Role</label>
        <select className={INPUT} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
          <option value="receptionist">Receptionist</option>
          <option value="clinic_admin">Clinic Admin</option>
          <option value="treatment_coordinator">Treatment Coordinator</option>
          <option value="sales">Sales</option>
          <option value="dentist">Dentist</option>
          <option value="director">Director</option>
        </select>
      </div>
      {error && <p className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-navy-500 text-gray-400 text-xs hover:text-white hover:bg-navy-700 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={isLoading}
          className="flex-1 py-2 rounded-lg bg-gold text-white text-xs font-semibold hover:bg-gold/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
          {isLoading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Add Member
        </button>
      </div>
    </form>
  );
}

// ── AI Settings Tab ───────────────────────────────────────────────────────────

interface AiSettings {
  tone: 'professional' | 'friendly' | 'casual' | 'formal';
  languageMode: string;
  welcomeMessage: string;
  outOfHoursMessage: string;
  escalationEnabled: boolean;
  escalationKeywords: string[];
  alertPhone: string;
}

function AiSettingsTab({ clinicId }: { clinicId: string }) {
  const [settings, setSettings] = useState<AiSettings>({
    tone: 'professional', languageMode: 'auto',
    welcomeMessage: '', outOfHoursMessage: '',
    escalationEnabled: true,
    escalationKeywords: ['urgent','pain','emergency','bleeding','swelling','broken'],
    alertPhone: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [kwInput, setKwInput] = useState('');

  useEffect(() => {
    api.get<{ settings: AiSettings }>(`/api/clinics/${clinicId}/ai-settings`)
      .then(res => {
        const s = res.data.settings;
        setSettings({ ...s, alertPhone: (s as any).alertPhone || '' });
        setKwInput(Array.isArray(s.escalationKeywords) ? s.escalationKeywords.join(', ') : '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinicId]);

  async function save() {
    setSaving(true);
    try {
      const keywords = kwInput.split(',').map(k => k.trim()).filter(Boolean);
      await api.put(`/api/clinics/${clinicId}/ai-settings`, {
        tone:                 settings.tone,
        language_mode:        settings.languageMode,
        welcome_message:      settings.welcomeMessage || null,
        out_of_hours_message: settings.outOfHoursMessage || null,
        escalation_enabled:   settings.escalationEnabled,
        escalation_keywords:  keywords,
        alert_phone:          settings.alertPhone?.trim() || null,
      });
      setSettings(s => ({ ...s, escalationKeywords: keywords }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-navy-600 border-t-gold rounded-full animate-spin" />
    </div>
  );

  const toneOptions: Array<{ value: AiSettings['tone']; label: string; desc: string }> = [
    { value: 'professional', label: 'Professional', desc: 'Warm but formal, polished language' },
    { value: 'friendly',     label: 'Friendly',     desc: 'Approachable, conversational, encouraging' },
    { value: 'casual',       label: 'Casual',       desc: 'Relaxed, like texting a helpful friend' },
    { value: 'formal',       label: 'Formal',       desc: 'Strictly formal, respectful register' },
  ];

  return (
    <div className="max-w-2xl space-y-6 pt-2">
      {/* Tone */}
      <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">AI Tone</h3>
        <div className="grid grid-cols-2 gap-3">
          {toneOptions.map(t => (
            <button key={t.value} onClick={() => setSettings(s => ({ ...s, tone: t.value }))}
              className={`text-left p-3 rounded-lg border transition-colors ${
                settings.tone === t.value
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-navy-600 text-gray-400 hover:border-navy-500 hover:text-white'
              }`}>
              <p className="font-semibold text-sm">{t.label}</p>
              <p className="text-xs mt-0.5 opacity-70">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Welcome message */}
      <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-1">Welcome Message</h3>
        <p className="text-gray-500 text-xs mb-3">Shown to first-time patients. Leave blank for the AI default.</p>
        <textarea
          rows={3}
          value={settings.welcomeMessage}
          onChange={e => setSettings(s => ({ ...s, welcomeMessage: e.target.value }))}
          placeholder="Hi! Welcome to [Clinic Name]. How can we help you today? 😊"
          className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 outline-none focus:border-gold/50 resize-none"
        />
      </div>

      {/* Out-of-hours message */}
      <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-1">Out-of-Hours Message</h3>
        <p className="text-gray-500 text-xs mb-3">Sent automatically when a patient messages outside working hours.</p>
        <textarea
          rows={3}
          value={settings.outOfHoursMessage}
          onChange={e => setSettings(s => ({ ...s, outOfHoursMessage: e.target.value }))}
          placeholder="We're currently closed. Our hours are Mon–Fri 9am–6pm. Would you like to book an appointment?"
          className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 outline-none focus:border-gold/50 resize-none"
        />
      </div>

      {/* Escalation */}
      <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold text-sm">Escalation</h3>
            <p className="text-gray-500 text-xs mt-0.5">AI pauses and connects patient to human team when keywords are detected.</p>
          </div>
          <button onClick={() => setSettings(s => ({ ...s, escalationEnabled: !s.escalationEnabled }))}
            className={`w-11 h-6 rounded-full transition-colors relative ${settings.escalationEnabled ? 'bg-gold' : 'bg-navy-600'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.escalationEnabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wider block mb-1.5">
          Escalation Keywords <span className="text-gray-600 normal-case">(comma-separated)</span>
        </label>
        <input
          type="text"
          value={kwInput}
          onChange={e => setKwInput(e.target.value)}
          disabled={!settings.escalationEnabled}
          placeholder="urgent, pain, emergency, bleeding, swelling, broken"
          className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 outline-none focus:border-gold/50 disabled:opacity-40"
        />
        <div className="mt-4">
          <label className="text-xs text-gray-400 font-medium uppercase tracking-wider block mb-1.5">
            Alert Phone (WhatsApp) <span className="text-gray-600 normal-case">— receives escalation alerts</span>
          </label>
          <input
            type="text"
            value={settings.alertPhone}
            onChange={e => setSettings(s => ({ ...s, alertPhone: e.target.value }))}
            disabled={!settings.escalationEnabled}
            placeholder="+447700900123"
            className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 outline-none focus:border-gold/50 disabled:opacity-40"
          />
          <p className="text-gray-600 text-xs mt-1">International format with country code. Leave blank to disable WhatsApp alerts.</p>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-light transition-colors disabled:opacity-60 flex items-center gap-2">
          {saving && <span className="w-3.5 h-3.5 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
      </div>
    </div>
  );
}

// ── Knowledge Base Tab ────────────────────────────────────────────────────────

const KB_CATEGORIES = ['pricing','treatments','doctors','hours','location','policies','faq','consent','custom'] as const;
type KbCategory = typeof KB_CATEGORIES[number];

const KB_CAT_LABELS: Record<KbCategory, string> = {
  pricing: '💰 Pricing', treatments: '🦷 Treatments', doctors: '🦷 Dentist',
  hours: '🕐 Hours', location: '📍 Location', policies: '📋 Policies',
  faq: '❓ FAQ', consent: '📝 Consent', custom: '✨ Custom',
};

interface KbEntry { id: string; category: KbCategory; title: string; content: string; isActive: boolean; }

function KnowledgeBaseTab({ clinicId }: { clinicId: string }) {
  const [entries,  setEntries]  = useState<KbEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [openCat,  setOpenCat]  = useState<KbCategory | null>('faq');
  const [editId,   setEditId]   = useState<string | null>(null);
  const [showForm, setShowForm] = useState<KbCategory | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({ title: '', content: '', is_active: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ entries: KbEntry[] }>(`/api/clinics/${clinicId}/knowledge`);
      setEntries(res.data.entries);
    } catch {}
    finally { setLoading(false); }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  async function saveEntry(category: KbCategory) {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        const res = await api.put<{ entry: KbEntry }>(`/api/clinics/${clinicId}/knowledge/${editId}`, { ...form, category });
        setEntries(es => es.map(e => e.id === editId ? res.data.entry : e));
      } else {
        const res = await api.post<{ entry: KbEntry }>(`/api/clinics/${clinicId}/knowledge`, { ...form, category });
        setEntries(es => [...es, res.data.entry]);
      }
      setEditId(null); setShowForm(null); setForm({ title: '', content: '', is_active: true });
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to save entry.');
    } finally { setSaving(false); }
  }

  async function deleteEntry(id: string) {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await api.delete(`/api/clinics/${clinicId}/knowledge/${id}`);
      setEntries(es => es.filter(e => e.id !== id));
    } catch {}
  }

  function startEdit(entry: KbEntry) {
    setEditId(entry.id);
    setShowForm(entry.category);
    setForm({ title: entry.title, content: entry.content, is_active: entry.isActive });
    setOpenCat(entry.category);
  }

  function cancelForm() {
    setEditId(null); setShowForm(null); setForm({ title: '', content: '', is_active: true });
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-navy-600 border-t-gold rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-3xl space-y-3 pt-2">
      <p className="text-gray-500 text-xs mb-4">
        Add clinic-specific information. The AI uses this to answer patient questions accurately.
      </p>
      {KB_CATEGORIES.map(cat => {
        const catEntries = entries.filter(e => e.category === cat);
        const isOpen = openCat === cat;
        return (
          <div key={cat} className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
            <button onClick={() => setOpenCat(isOpen ? null : cat)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-navy-700/40 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-white">{KB_CAT_LABELS[cat]}</span>
                {catEntries.length > 0 && (
                  <span className="bg-navy-600 text-gray-400 text-xs px-2 py-0.5 rounded-full">{catEntries.length}</span>
                )}
              </div>
              <span className="text-gray-500 text-sm">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="px-5 pb-4 space-y-3 border-t border-navy-700/50">
                {catEntries.map(entry => (
                  <div key={entry.id} className="bg-navy-900/50 border border-navy-700 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{entry.title}</p>
                        <p className="text-gray-400 text-xs mt-1 whitespace-pre-wrap line-clamp-3">{entry.content}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => startEdit(entry)}
                          className="text-xs px-2.5 py-1 rounded-md bg-navy-700 text-gray-300 hover:text-white transition-colors">Edit</button>
                        <button onClick={() => deleteEntry(entry.id)}
                          className="text-xs px-2.5 py-1 rounded-md bg-red-900/30 text-red-400 hover:bg-red-900/60 transition-colors">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add / Edit form */}
                {showForm === cat ? (
                  <div className="bg-navy-900 border border-navy-600 rounded-lg p-4 space-y-3">
                    <p className="text-gold text-xs font-semibold uppercase tracking-wider">{editId ? 'Edit Entry' : 'New Entry'}</p>
                    <input type="text" placeholder="Title" value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 outline-none focus:border-gold/50"
                    />
                    <textarea rows={5} placeholder="Content — paste price lists, doctor bios, FAQs, policies..." value={form.content}
                      onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                      className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 outline-none focus:border-gold/50 resize-y"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEntry(cat)} disabled={saving}
                        className="px-4 py-1.5 rounded-lg bg-gold text-white text-xs font-semibold hover:bg-gold-light disabled:opacity-60 flex items-center gap-1.5">
                        {saving && <span className="w-3 h-3 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />}
                        {saving ? 'Saving…' : editId ? 'Update' : 'Add Entry'}
                      </button>
                      <button onClick={cancelForm} className="px-4 py-1.5 rounded-lg bg-navy-700 text-gray-400 text-xs hover:text-white transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setShowForm(cat); setEditId(null); setForm({ title: '', content: '', is_active: true }); }}
                    className="w-full py-2 border border-dashed border-navy-600 rounded-lg text-gray-500 text-xs hover:text-gold hover:border-gold/40 transition-colors">
                    + Add entry to {KB_CAT_LABELS[cat]}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Appointments Tab ──────────────────────────────────────────────────────────

type ApptStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

interface Appointment {
  id: string; tenantId: string; leadId: string | null;
  patientName: string; patientPhone: string; treatmentType: string | null;
  appointmentDate: string; appointmentTime: string; durationMinutes: number;
  status: ApptStatus; notes: string | null; createdAt: string;
  branchName: string | null; branchPostcode: string | null;
  clinicStatus: 'requested' | 'approved' | 'rejected';
  clinicApprovedAt: string | null;
  confirmationStatus: 'pending' | 'confirmed' | 'declined';
  reminder1daySentAt: string | null; reminderSamedaySentAt: string | null;
}

const APPT_STATUS_CONFIG: Record<ApptStatus, { label: string; badge: string; btn: string }> = {
  pending:   { label: 'Pending',   badge: 'bg-amber-500 text-white border-amber-600',  btn: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'  },
  confirmed: { label: 'Confirmed', badge: 'bg-green-600 text-white border-green-700',  btn: 'bg-green-600 hover:bg-green-700 text-white border-green-700'  },
  cancelled: { label: 'Cancelled', badge: 'bg-red-600 text-white border-red-700',      btn: 'bg-red-600 hover:bg-red-700 text-white border-red-700'        },
  completed: { label: 'Completed', badge: 'bg-blue-600 text-white border-blue-700',    btn: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'    },
  no_show:   { label: 'No Show',   badge: 'bg-slate-500 text-white border-slate-600',  btn: 'bg-slate-500 hover:bg-slate-600 text-white border-slate-500'  },
};

export function AppointmentsTab({ clinicId }: { clinicId: string }) {
  const [appts,      setAppts]      = useState<Appointment[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showNew,    setShowNew]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [staffList,  setStaffList]  = useState<{ id: string; name: string }[]>([]);
  const EMPTY_FORM = { patient_name: '', patient_phone: '', patient_email: '', treatment_type: '', appointment_date: '', appointment_time: '', notes: '', assigned_to: '' };
  const [newForm, setNewForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDate) params.set('date', filterDate);
      const res = await api.get<{ appointments: Appointment[] }>(`/api/clinics/${clinicId}/appointments?${params}`);
      setAppts(res.data.appointments);
    } catch {}
    finally { setLoading(false); }
  }, [clinicId, filterDate]);

  // Load dentists + nurses for assigned_to dropdown
  useEffect(() => {
    api.get<{ clinic: { staff: { id: string; firstName: string; lastName: string; role: string }[] } }>(`/api/clinics/${clinicId}`)
      .then(res => {
        const clinical = (res.data.clinic.staff || [])
          .filter(s => s.role === 'dentist' || s.role === 'nurse')
          .map(s => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }));
        setStaffList(clinical);
      }).catch(() => {});
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  async function createAppt() {
    if (!newForm.patient_name || !newForm.appointment_date || !newForm.appointment_time) return;
    setSaving(true);
    try {
      const res = await api.post<{ appointment: Appointment }>(`/api/clinics/${clinicId}/appointments`, {
        ...newForm,
        assigned_to:   newForm.assigned_to   || undefined,
        patient_email: newForm.patient_email || undefined,
      });
      setAppts(a => [res.data.appointment, ...a]);
      setShowNew(false);
      setNewForm(EMPTY_FORM);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to create appointment.');
    } finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: ApptStatus) {
    try {
      const res = await api.patch<{ appointment: Appointment }>(`/api/clinics/${clinicId}/appointments/${id}`, { status });
      setAppts(a => a.map(x => x.id === id ? res.data.appointment : x));
    } catch {}
  }

  async function approveAppt(id: string) {
    try {
      const res = await api.patch<{ appointment: Appointment }>(`/api/clinics/${clinicId}/appointments/${id}/approve`);
      setAppts(a => a.map(x => x.id === id ? res.data.appointment : x));
    } catch {}
  }

  async function rejectAppt(id: string) {
    try {
      const res = await api.patch<{ appointment: Appointment }>(`/api/clinics/${clinicId}/appointments/${id}/reject`);
      setAppts(a => a.map(x => x.id === id ? res.data.appointment : x));
    } catch {}
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="bg-navy-800 border border-navy-600 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-gold/50"
        />
        {filterDate && (
          <button onClick={() => setFilterDate('')} className="text-xs text-gray-500 hover:text-white transition-colors">✕ Clear</button>
        )}
        <button onClick={load} className="text-xs text-gray-500 hover:text-white px-3 py-1.5 rounded-lg hover:bg-navy-700 transition-colors">↻ Refresh</button>
        <button onClick={() => setShowNew(v => !v)}
          className="ml-auto px-4 py-1.5 rounded-lg bg-gold text-white text-xs font-semibold hover:bg-gold-light transition-colors">
          + New Appointment
        </button>
      </div>

      {/* New appointment form */}
      {showNew && (
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-5 space-y-4">
          <p className="text-gold text-xs font-semibold uppercase tracking-wider">New Appointment</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Patient Name *',  key: 'patient_name',      type: 'text',  placeholder: 'Sarah Mitchell' },
              { label: 'Phone',           key: 'patient_phone',     type: 'text',  placeholder: '+44 7700 000000' },
              { label: 'Email (optional)',key: 'patient_email',     type: 'email', placeholder: 'sarah@example.com' },
              { label: 'Treatment',       key: 'treatment_type',    type: 'text',  placeholder: 'Dental Implant' },
              { label: 'Date *',          key: 'appointment_date',  type: 'date',  placeholder: '' },
              { label: 'Time *',          key: 'appointment_time',  type: 'time',  placeholder: '' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
                <input type={f.type} placeholder={f.placeholder}
                  value={(newForm as any)[f.key]} onChange={e => setNewForm(x => ({ ...x, [f.key]: e.target.value }))}
                  className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 outline-none focus:border-gold/50"
                />
              </div>
            ))}
          </div>
          {/* Assigned staff */}
          {staffList.length > 0 && (
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Assigned Dentist / Nurse (optional)</label>
              <select value={newForm.assigned_to} onChange={e => setNewForm(x => ({ ...x, assigned_to: e.target.value }))}
                className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold/50">
                <option value="">— Unassigned —</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <textarea rows={2} placeholder="Notes (optional)" value={newForm.notes}
            onChange={e => setNewForm(x => ({ ...x, notes: e.target.value }))}
            className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 outline-none focus:border-gold/50 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={createAppt} disabled={saving}
              className="px-5 py-2 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-light disabled:opacity-60 flex items-center gap-2">
              {saving && <span className="w-3.5 h-3.5 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Saving…' : 'Create Appointment'}
            </button>
            <button onClick={() => setShowNew(false)} className="px-5 py-2 rounded-lg bg-navy-700 text-gray-400 text-sm hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Appointments list */}
      <div className="bg-navy-800 border border-navy-600 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <div className="w-8 h-8 border-4 border-navy-600 border-t-gold rounded-full animate-spin" />
          </div>
        ) : appts.length === 0 ? (
          <div className="text-center py-14 text-gray-500">
            <div className="mb-3"><CalendarDays size={36} className="mx-auto text-gray-400" /></div>
            <p className="text-sm">{filterDate ? 'No appointments on this date.' : 'No appointments yet.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-navy-700">
                  {['Patient','Phone','Treatment','Date & Time','Branch','Clinic','Patient','Status','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appts.map(appt => {
                  const cfg = APPT_STATUS_CONFIG[appt.status];
                  // formatDate splits the YYYY-MM-DD string directly — no timezone shift.
                  // appointment_time is a separate "HH:MM:SS" string — slice directly, no Date needed.
                  const dateStr = formatDate(appt.appointmentDate as string);
                  const timeStr = (appt.appointmentTime as string).slice(0, 5); // "14:00"
                  const otherStatuses = (Object.keys(APPT_STATUS_CONFIG) as ApptStatus[]).filter(s => s !== appt.status);
                  return (
                    <tr key={appt.id} className="border-b border-navy-700/50 hover:bg-navy-700/20 transition-colors">
                      <td className="px-4 py-3 text-white text-sm font-medium">{appt.patientName}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{appt.patientPhone}</td>
                      <td className="px-4 py-3 text-gray-300 text-sm">{appt.treatmentType || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm whitespace-nowrap">{dateStr} {timeStr}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {appt.branchName
                          ? <span className="inline-flex items-center gap-1">📍 {appt.branchName}{appt.branchPostcode ? <span className="text-gray-600 text-xs ml-1">{appt.branchPostcode}</span> : null}</span>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      {/* Clinic approval status */}
                      <td className="px-4 py-3">
                        {appt.clinicStatus === 'approved'
                          ? <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium text-white bg-green-600">Approved</span>
                          : appt.clinicStatus === 'rejected'
                          ? <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium text-white bg-red-600">Rejected</span>
                          : <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium text-white bg-amber-500">Awaiting approval</span>}
                      </td>
                      {/* Patient confirmation status */}
                      <td className="px-4 py-3">
                        {appt.confirmationStatus === 'confirmed'
                          ? <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium text-white bg-green-600">Confirmed</span>
                          : appt.confirmationStatus === 'declined'
                          ? <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium text-white bg-red-600">Declined</span>
                          : <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium text-white bg-slate-500">Awaiting</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {appt.clinicStatus === 'requested' && (
                            <>
                              <button onClick={() => approveAppt(appt.id)}
                                className="text-xs px-2.5 py-1 rounded-md border font-medium transition-colors hover:opacity-80 bg-green-600 text-white border-green-700">
                                Approve
                              </button>
                              <button onClick={() => rejectAppt(appt.id)}
                                className="text-xs px-2.5 py-1 rounded-md border font-medium transition-colors hover:bg-slate-600 bg-slate-500 text-white border-slate-500">
                                Reject
                              </button>
                            </>
                          )}
                          {otherStatuses.map(s => (
                            <button key={s} onClick={() => updateStatus(appt.id, s)}
                              className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors whitespace-nowrap ${APPT_STATUS_CONFIG[s].btn}`}>
                              → {APPT_STATUS_CONFIG[s].label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type ConfirmAction = 'suspend' | 'activate' | 'delete' | null;
type ActiveTab = 'overview' | 'ai_usage' | 'ai_settings' | 'knowledge';

export default function ClinicDetailPage() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const canEditStaff = isSuperAdmin || user?.role === 'director' || user?.role === 'clinic_admin';

  const [clinic,     setClinic]     = useState<ClinicDetail | null>(null);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState<ActiveTab>('overview');

  const [showEdit,      setShowEdit]      = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAddStaff,  setShowAddStaff]  = useState(false);
  const [removeStaffId, setRemoveStaffId] = useState<string | null>(null);

  // Edit staff modal
  const [editStaffId,   setEditStaffId]   = useState<string | null>(null);
  const [editStaffForm, setEditStaffForm] = useState({ firstName: '', lastName: '', email: '', phone: '', role: '' });
  const [editStaffSaving, setEditStaffSaving] = useState(false);
  const [editStaffError,  setEditStaffError]  = useState<string | null>(null);

  // WhatsApp wizard
  const [showWaWizard, setShowWaWizard] = useState(false);

  // AI Quota editing
  const [quotaEdit,    setQuotaEdit]    = useState(false);
  const [quotaForm,    setQuotaForm]    = useState({ monthlyLimit: 500, overagePolicy: 'notify' });
  const [quotaSaving,  setQuotaSaving]  = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchClinic = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const res = await api.get<{ clinic: ClinicDetail }>(`/api/clinics/${id}`);
      setClinic(res.data.clinic);
      setQuotaForm({
        monthlyLimit:  res.data.clinic.aiMonthlyLimit  ?? 500,
        overagePolicy: res.data.clinic.aiOveragePolicy ?? 'notify',
      });
      setError(null);
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to load clinic');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchClinic(); }, [fetchClinic]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function executeAction() {
    if (!clinic || !confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction === 'delete') {
        await api.delete(`/api/clinics/${clinic.id}`);
        navigate('/clinics');
        return;
      }
      const res = await api.patch<{ clinic: Clinic }>(`/api/clinics/${clinic.id}/${confirmAction}`);
      setClinic(c => c ? { ...c, ...res.data.clinic } : c);
      setConfirmAction(null);
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Action failed');
      setConfirmAction(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function executeRemoveStaff() {
    if (!clinic || !removeStaffId) return;
    setActionLoading(true);
    try {
      await api.delete(`/api/clinics/${clinic.id}/staff/${removeStaffId}`);
      setClinic(c => c ? { ...c, staff: c.staff.filter(s => s.id !== removeStaffId) } : c);
      setRemoveStaffId(null);
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to remove staff');
    } finally {
      setActionLoading(false);
    }
  }

  async function updateStaffRole(uid: string, role: string) {
    if (!clinic) return;
    try {
      const res = await api.put<{ staff: StaffMember }>(`/api/clinics/${clinic.id}/staff/${uid}`, { role });
      setClinic(c => c ? { ...c, staff: c.staff.map(s => s.id === uid ? res.data.staff : s) } : c);
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to update role');
    }
  }

  async function handleResetPassword(uid: string) {
    if (!clinic) return;
    try {
      await api.post(`/api/clinics/${clinic.id}/staff/${uid}/reset-password`);
      setSuccess('✅ Password reset email sent.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to reset password');
    }
  }

  async function handleToggleActive(uid: string) {
    if (!clinic) return;
    try {
      const res = await api.patch<{ staff: StaffMember }>(`/api/clinics/${clinic.id}/staff/${uid}/toggle-active`);
      setClinic(c => c ? { ...c, staff: c.staff.map(s => s.id === uid ? res.data.staff : s) } : c);
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to toggle status');
    }
  }

  function openEditStaff(member: StaffMember) {
    setEditStaffForm({
      firstName: member.firstName,
      lastName:  member.lastName,
      email:     member.email,
      phone:     member.phone || '',
      role:      member.role,
    });
    setEditStaffError(null);
    setEditStaffId(member.id);
  }

  async function saveEditStaff() {
    if (!clinic || !editStaffId) return;
    setEditStaffSaving(true);
    setEditStaffError(null);
    try {
      const res = await api.patch<{ staff: StaffMember }>(
        `/api/clinics/${clinic.id}/staff/${editStaffId}`,
        {
          firstName: editStaffForm.firstName,
          lastName:  editStaffForm.lastName,
          email:     editStaffForm.email,
          phone:     editStaffForm.phone || null,
          role:      editStaffForm.role,
        },
      );
      setClinic(c => c ? { ...c, staff: c.staff.map(s => s.id === editStaffId ? res.data.staff : s) } : c);
      setEditStaffId(null);
      setSuccess('✅ Staff member updated.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setEditStaffError((err as any)?.response?.data?.error || 'Failed to update staff.');
    } finally {
      setEditStaffSaving(false);
    }
  }

  async function handleSaveQuota() {
    if (!clinic) return;
    setQuotaSaving(true);
    try {
      const res = await api.patch<{ aiMonthlyLimit: number; aiOveragePolicy: string }>(
        `/api/clinics/${clinic.id}/quota`,
        { monthlyLimit: quotaForm.monthlyLimit, overagePolicy: quotaForm.overagePolicy }
      );
      setClinic(c => c ? {
        ...c,
        aiMonthlyLimit:  res.data.aiMonthlyLimit,
        aiOveragePolicy: res.data.aiOveragePolicy as ClinicDetail['aiOveragePolicy'],
      } : c);
      setQuotaEdit(false);
    } catch (err: unknown) {
      setError((err as any)?.response?.data?.error || 'Failed to save quota');
    } finally {
      setQuotaSaving(false);
    }
  }

  // ── Loading / error ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading clinic…</p>
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="p-4 md:p-8 text-center">
        <p className="text-red-400">{error || 'Clinic not found'}</p>
        <Link to="/clinics" className="text-gold text-sm mt-3 inline-block hover:underline">← Back to Clinics</Link>
      </div>
    );
  }

  const isSuspended = clinic.status === 'suspended';
  const onboardingSteps = [
    { label: 'Profile complete',     done: clinic.onboarding.profileComplete,   tip: 'Add address, phone, or email' },
    { label: 'WhatsApp connected',   done: clinic.onboarding.whatsappConnected, tip: 'Link a WhatsApp Business number' },
    { label: 'First lead received',  done: clinic.onboarding.firstLeadReceived, tip: 'Awaiting first enquiry' },
    { label: 'First booking made',   done: clinic.onboarding.firstBookingMade,  tip: 'Awaiting first booking' },
  ];
  const onboardingScore = onboardingSteps.filter(s => s.done).length;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link to="/clinics" className="text-gray-500 hover:text-white transition-colors">Clinics</Link>
          <span className="text-gray-600">›</span>
          <span className="text-gray-300">{clinic.name}</span>
        </div>

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-navy-700 border border-navy-500 flex items-center justify-center shrink-0">
              <Building2 size={28} className="text-gold" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-3xl text-white">{clinic.name}</h1>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[clinic.status] ?? STATUS_BADGE.active}`}>
                  {clinic.status.charAt(0).toUpperCase() + clinic.status.slice(1)}
                </span>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE[clinic.planTier] ?? PLAN_BADGE.starter}`}>
                  {clinic.planTier.charAt(0).toUpperCase() + clinic.planTier.slice(1)}
                </span>
              </div>
              <p className="text-gray-500 text-sm mt-1">Joined {formatDate(clinic.createdAt)}</p>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button onClick={fetchClinic}
              className="text-xs text-gold hover:text-gold-light px-3 py-1.5 border border-navy-600 rounded-lg transition-colors">
              ↻
            </button>
            <button onClick={() => setShowEdit(true)}
              className="text-xs bg-navy-700 hover:bg-navy-600 text-white px-4 py-1.5 border border-navy-500 rounded-lg transition-colors">
              ✏ Edit
            </button>
            {isSuspended ? (
              <button onClick={() => setConfirmAction('activate')}
                className="text-xs bg-green-900 hover:bg-green-800 text-green-300 px-4 py-1.5 border border-green-700 rounded-lg transition-colors">
                ▶ Activate
              </button>
            ) : (
              <button onClick={() => setConfirmAction('suspend')}
                className="text-xs bg-yellow-900 hover:bg-yellow-800 text-yellow-300 px-4 py-1.5 border border-yellow-700 rounded-lg transition-colors">
                ⏸ Suspend
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
            ⚠ {error}
          </div>
        )}
        {success && (
          <div className="bg-green-950 border border-green-800 text-green-300 text-sm px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Leads',   value: clinic.totalLeads,                         icon: <Users size={18} /> },
            { label: 'Booked',        value: clinic.bookedLeads,                         icon: <CheckCircle size={18} /> },
            { label: 'Booking Rate',  value: `${clinic.bookingRate}%`,                   icon: <TrendingUp size={18} />, gold: true },
            { label: 'Pipeline',      value: formatCurrency(clinic.mrrPipeline),         icon: <PoundSterling size={18} />, gold: true },
            { label: 'Avg Response',  value: formatResponseTime(clinic.avgResponseSecs), icon: <Zap size={18} /> },
          ].map(card => (
            <div key={card.label} className="bg-navy-800 border border-navy-600 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">{card.label}</span>
                <span className="text-lg">{card.icon}</span>
              </div>
              <p className={`text-2xl font-semibold ${card.gold ? 'text-gold' : 'text-white'}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-navy-600 pb-0 flex-wrap">
          {([
            { value: 'overview',     label: 'Overview',      icon: Building2    },
            { value: 'ai_usage',     label: 'AI Usage',      icon: Bot          },
            { value: 'ai_settings',  label: 'AI Settings',   icon: SettingsIcon },
            { value: 'knowledge',    label: 'Knowledge Base', icon: BookOpen     },
          ] as { value: ActiveTab; label: string; icon: IconComponent }[]).map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.value
                  ? 'border-gold text-gold'
                  : 'border-transparent text-gray-500 hover:text-white'
              }`}
            >
              {(() => { const Icon = tab.icon; return <Icon size={15} className="inline mr-1.5 -mt-0.5" />; })()}
              {tab.label}
            </button>
          ))}
        </div>

        {/* AI Usage tab */}
        {activeTab === 'ai_usage' && clinic && (
          <AiUsageTab clinicId={clinic.id} />
        )}

        {/* AI Settings tab */}
        {activeTab === 'ai_settings' && clinic && (
          <AiSettingsTab clinicId={clinic.id} />
        )}

        {/* Knowledge Base tab */}
        {activeTab === 'knowledge' && clinic && (
          <KnowledgeBaseTab clinicId={clinic.id} />
        )}

        {/* Two-column layout (Overview tab) */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${activeTab !== 'overview' ? 'hidden' : ''}`}>

          {/* Left column — profile + whatsapp + onboarding */}
          <div className="lg:col-span-1 space-y-5">

            {/* Clinic Profile */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-navy-600 flex items-center justify-between">
                <h2 className="text-white font-medium text-sm">Clinic Profile</h2>
                <button onClick={() => setShowEdit(true)}
                  className="text-xs text-gold hover:text-gold-light transition-colors">Edit</button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {([
                  { label: 'Address', value: clinic.address, icon: MapPin  },
                  { label: 'Phone',   value: clinic.phone,   icon: Phone   },
                  { label: 'Email',   value: clinic.email,   icon: Mail    },
                  { label: 'Website', value: clinic.website, icon: Globe   },
                  { label: 'Timezone',value: clinic.timezone,icon: Clock   },
                ] as { label: string; value: string | undefined; icon: IconComponent }[]).map(row => (
                  <div key={row.label} className="flex items-start gap-2.5">
                    {(() => { const Icon = row.icon; return <Icon size={14} className="text-gray-500 mt-0.5 shrink-0" />; })()}
                    <div className="min-w-0">
                      <p className="text-gray-500 text-[10px] uppercase tracking-wider">{row.label}</p>
                      <p className={`text-sm mt-0.5 truncate ${row.value ? 'text-gray-200' : 'text-gray-600 italic'}`}>
                        {row.value || 'Not set'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* WhatsApp Status */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-navy-600 flex items-center justify-between">
                <h2 className="text-white font-medium text-sm">WhatsApp Integration</h2>
                {!clinic.whatsapp.connected && (
                  <button
                    onClick={() => setShowWaWizard(true)}
                    className="text-xs bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
                  >
                    <MessageCircle size={14} /> Connect WhatsApp
                  </button>
                )}
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${clinic.whatsapp.connected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                  <span className={`text-sm font-medium ${clinic.whatsapp.connected ? 'text-green-400' : 'text-gray-400'}`}>
                    {clinic.whatsapp.connected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                {clinic.whatsapp.configs.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {clinic.whatsapp.configs.map(cfg => (
                      <div key={cfg.id} className="bg-navy-700 rounded-lg px-3 py-2 flex items-center justify-between">
                        <div>
                          <p className="text-white text-xs font-medium">{cfg.displayName}</p>
                          <p className="text-gray-500 text-xs mt-0.5">ID: {cfg.phoneNumberId}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.isActive ? 'bg-green-900/50 text-green-400 border-green-700/50' : 'bg-gray-800 text-gray-500 border-gray-600'}`}>
                          {cfg.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {!clinic.whatsapp.connected && (
                  <p className="text-gray-600 text-xs mt-2">
                    Connect a WhatsApp Business number to enable AI follow-ups.
                  </p>
                )}
                {clinic.whatsapp.connected && (
                  <button
                    onClick={() => setShowWaWizard(true)}
                    className="mt-3 text-xs text-gray-500 hover:text-white transition-colors"
                  >
                    + Add another number
                  </button>
                )}
              </div>
            </div>

            {/* WhatsApp Wizard Modal */}
            {showWaWizard && (
              <WhatsAppWizardModal
                clinicId={clinic.id}
                onClose={() => setShowWaWizard(false)}
                onConnected={cfg => {
                  setShowWaWizard(false);
                  // Optimistically update clinic state
                  setClinic(c => c ? {
                    ...c,
                    whatsapp: {
                      connected: true,
                      configs: [...c.whatsapp.configs, {
                        id:            `new-${Date.now()}`,
                        displayName:   cfg.displayName,
                        phoneNumberId: cfg.phoneNumberId,
                        isActive:      true,
                        createdAt:     new Date().toISOString(),
                      }],
                    },
                    onboarding: { ...c.onboarding, whatsappConnected: true },
                  } : c);
                  setSuccess('WhatsApp connected successfully!');
                  setTimeout(() => setSuccess(null), 4000);
                }}
              />
            )}

            {/* Onboarding Checklist */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-navy-600 flex items-center justify-between">
                <h2 className="text-white font-medium text-sm">Setup Progress</h2>
                <span className="text-xs text-gray-500">{onboardingScore}/{onboardingSteps.length}</span>
              </div>
              {/* Progress bar */}
              <div className="h-1 bg-navy-700">
                <div
                  className="h-full bg-gold transition-all duration-500"
                  style={{ width: `${(onboardingScore / onboardingSteps.length) * 100}%` }}
                />
              </div>
              <div className="px-5 py-4 space-y-3">
                {onboardingSteps.map(step => (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-xs transition-all ${
                      step.done
                        ? 'bg-green-900 border-green-600 text-green-400'
                        : 'border-navy-500 text-transparent'
                    }`}>
                      {step.done ? '✓' : ''}
                    </div>
                    <div>
                      <p className={`text-sm ${step.done ? 'text-gray-200' : 'text-gray-500'}`}>{step.label}</p>
                      {!step.done && <p className="text-xs text-gray-600">{step.tip}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Quota */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-navy-600 flex items-center justify-between">
                <h2 className="text-white font-medium text-sm">AI Quota</h2>
                {!quotaEdit ? (
                  isSuperAdmin && (
                    <button onClick={() => { setQuotaEdit(true); setQuotaForm({ monthlyLimit: clinic.aiMonthlyLimit, overagePolicy: clinic.aiOveragePolicy }); }}
                      className="text-xs text-gold hover:text-gold-light transition-colors">Edit</button>
                  )
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setQuotaEdit(false)} className="text-xs text-gray-400 hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleSaveQuota} disabled={quotaSaving}
                      className="text-xs text-gold hover:text-gold-light transition-colors disabled:opacity-50">
                      {quotaSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
              <div className="px-5 py-4 space-y-4">
                {!quotaEdit ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-gray-500 text-xs">Messages this month</span>
                        <span className="text-white text-xs font-medium">
                          {clinic.thisMonthAiMessages} / {clinic.aiMonthlyLimit.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            clinic.thisMonthAiMessages / clinic.aiMonthlyLimit > 0.9
                              ? 'bg-red-500'
                              : clinic.thisMonthAiMessages / clinic.aiMonthlyLimit > 0.7
                              ? 'bg-yellow-500'
                              : 'bg-gold'
                          }`}
                          style={{ width: `${Math.min(100, (clinic.thisMonthAiMessages / clinic.aiMonthlyLimit) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-xs">Overage policy</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        clinic.aiOveragePolicy === 'block'
                          ? 'bg-red-900 text-red-300 border-red-700'
                          : clinic.aiOveragePolicy === 'notify'
                          ? 'bg-yellow-900 text-yellow-300 border-yellow-700'
                          : 'bg-green-900 text-green-300 border-green-700'
                      }`}>
                        {clinic.aiOveragePolicy}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Monthly limit</label>
                      <input
                        type="number"
                        min={0}
                        value={quotaForm.monthlyLimit}
                        onChange={e => setQuotaForm(f => ({ ...f, monthlyLimit: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-navy-700 border border-navy-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs uppercase tracking-wider block mb-1">Overage policy</label>
                      <select
                        value={quotaForm.overagePolicy}
                        onChange={e => setQuotaForm(f => ({ ...f, overagePolicy: e.target.value }))}
                        className="w-full bg-navy-700 border border-navy-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold transition-colors"
                      >
                        <option value="block">Block — stop AI replies when limit hit</option>
                        <option value="notify">Notify — alert admin but continue</option>
                        <option value="allow">Allow — no restriction</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column — staff */}
          <div className="lg:col-span-2">
            <div className="bg-navy-800 border border-navy-600 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-navy-600 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-medium">Staff Members</h2>
                  <p className="text-gray-500 text-xs mt-0.5">{clinic.staff.length} member{clinic.staff.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => setShowAddStaff(s => !s)}
                  className="text-xs bg-gold hover:bg-gold-light text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  {showAddStaff ? '✕ Cancel' : '+ Add Staff'}
                </button>
              </div>

              {showAddStaff && (
                <div className="px-6 pb-4">
                  <AddStaffForm
                    clinicId={clinic.id}
                    onAdded={(staff, password, addedToClinic) => {
                      setClinic(c => c ? { ...c, staff: [...c.staff, staff] } : c);
                      setShowAddStaff(false);
                      if (addedToClinic) {
                        setSuccess('✅ Existing user added to this clinic.');
                        setTimeout(() => setSuccess(null), 5000);
                      } else if (password) {
                        setSuccess(`✅ Staff created. Temp password: ${password}`);
                        setTimeout(() => setSuccess(null), 15000);
                      }
                    }}
                    onCancel={() => setShowAddStaff(false)}
                  />
                </div>
              )}

              <div className="divide-y divide-navy-600">
                {clinic.staff.map(member => (
                  <div key={member.id} className="px-6 py-4 flex items-center gap-4 hover:bg-navy-700 transition-colors group">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-navy-600 border border-navy-500 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                      {member.firstName[0]}{member.lastName?.[0] || ''}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">
                          {member.firstName} {member.lastName}
                        </p>
                        {!member.isActive && (
                          <span className="text-xs text-gray-500 bg-navy-700 px-1.5 py-0.5 rounded-full border border-navy-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs truncate">{member.email}</p>
                      <p className="text-gray-600 text-xs mt-0.5">Last login: {formatRelativeDate(member.lastLoginAt)}</p>
                    </div>

                    {/* Role selector — only editable by director / clinic_admin / super_admin */}
                    {canEditStaff ? (
                      <select
                        value={member.role}
                        onChange={e => updateStaffRole(member.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border font-medium bg-transparent cursor-pointer focus:outline-none ${ROLE_BADGE[member.role] ?? ROLE_BADGE.receptionist}`}
                      >
                        <option value="receptionist">Receptionist</option>
                        <option value="clinic_admin">Clinic Admin</option>
                        <option value="treatment_coordinator">Treatment Coordinator</option>
                        <option value="sales">Sales</option>
                        <option value="dentist">Dentist</option>
                        <option value="director">Director</option>
                        <option value="nurse">Nurse</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded-full border font-medium ${ROLE_BADGE[member.role] ?? ROLE_BADGE.receptionist}`}>
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                    )}

                    {/* Action buttons — only for director / clinic_admin / super_admin */}
                    {canEditStaff && (
                      <div
                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); openEditStaff(member); }}
                          className="text-gray-500 hover:text-blue-400 transition-colors text-sm p-1 rounded"
                          title="Edit staff"
                        >
                          🖊️
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleResetPassword(member.id); }}
                          className="text-gray-500 hover:text-gold transition-colors text-sm p-1 rounded"
                          title="Reset password"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleToggleActive(member.id); }}
                          className={`text-sm p-1 rounded transition-colors ${member.isActive ? 'text-gray-500 hover:text-yellow-400' : 'text-gray-500 hover:text-green-400'}`}
                          title={member.isActive ? 'Block user' : 'Unblock user'}
                        >
                          {member.isActive ? <Lock size={14} /> : <LockOpen size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setRemoveStaffId(member.id); }}
                          className="text-gray-600 hover:text-red-400 transition-colors text-sm p-1 rounded"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {clinic.staff.length === 0 && (
                  <div className="px-6 py-8 text-center text-gray-500 text-sm">
                    No staff members yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone — overview tab only */}
        <div className={`bg-navy-800 border border-red-900/40 rounded-xl p-6 ${activeTab !== 'overview' ? 'hidden' : ''}`}>
          <h2 className="text-red-400 font-medium text-sm mb-4">Danger Zone</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Delete this clinic</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Permanently removes the clinic and all its data. This cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setConfirmAction('delete')}
              className="text-xs bg-red-950 hover:bg-red-900 text-red-300 px-4 py-2 border border-red-800 rounded-lg transition-colors shrink-0"
            >
              Delete Clinic
            </button>
          </div>
        </div>

      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {showEdit && (
        <EditClinicModal
          clinic={clinic}
          onClose={() => setShowEdit(false)}
          onUpdated={updated => setClinic(c => c ? { ...c, ...updated } : c)}
        />
      )}

      {confirmAction === 'suspend' && (
        <ConfirmModal
          title="Suspend clinic?"
          message={
            <>
              This will <strong className="text-white">disable login for all staff</strong> at{' '}
              <strong className="text-white">{clinic.name}</strong> and stop all AI follow-ups.
              You can reactivate at any time.
            </>
          }
          confirmLabel="Suspend"
          confirmDanger
          isLoading={actionLoading}
          onConfirm={executeAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {confirmAction === 'activate' && (
        <ConfirmModal
          title="Reactivate clinic?"
          message={
            <>
              This will re-enable all staff accounts and resume AI follow-ups for{' '}
              <strong className="text-white">{clinic.name}</strong>.
            </>
          }
          confirmLabel="Activate"
          isLoading={actionLoading}
          onConfirm={executeAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {confirmAction === 'delete' && (
        <ConfirmModal
          title="Delete clinic permanently?"
          message={
            <>
              This will permanently delete <strong className="text-white">{clinic.name}</strong>,
              all its leads, messages, and staff accounts.
              <span className="block mt-2 text-red-400 font-medium">This action cannot be undone.</span>
            </>
          }
          confirmLabel="Yes, delete forever"
          confirmDanger
          isLoading={actionLoading}
          onConfirm={executeAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ── Edit Staff Modal ──────────────────────────────────────────────── */}
      {editStaffId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-5 border-b border-navy-700 flex items-center justify-between">
              <h3 className="text-white font-semibold">Edit Staff Member</h3>
              <button onClick={() => setEditStaffId(null)} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {editStaffError && (
                <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-2.5 rounded-lg">{editStaffError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: 'firstName', label: 'First Name', type: 'text',  placeholder: 'Jane' },
                  { key: 'lastName',  label: 'Last Name',  type: 'text',  placeholder: 'Smith' },
                ] as const).map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-gray-400 font-medium block mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      value={editStaffForm[f.key]}
                      onChange={e => setEditStaffForm(x => ({ ...x, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 outline-none focus:border-gold/50"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">Email</label>
                <input
                  type="email"
                  value={editStaffForm.email}
                  onChange={e => setEditStaffForm(x => ({ ...x, email: e.target.value }))}
                  placeholder="jane@clinic.com"
                  className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 outline-none focus:border-gold/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">
                  Phone <span className="text-gray-600 font-normal">(optional, international format)</span>
                </label>
                <input
                  type="text"
                  value={editStaffForm.phone}
                  onChange={e => setEditStaffForm(x => ({ ...x, phone: e.target.value }))}
                  placeholder="+447700900123"
                  className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 outline-none focus:border-gold/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">Role</label>
                <select
                  value={editStaffForm.role}
                  onChange={e => setEditStaffForm(x => ({ ...x, role: e.target.value }))}
                  className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold/50"
                >
                  <option value="receptionist">Receptionist</option>
                  <option value="clinic_admin">Clinic Admin</option>
                  <option value="treatment_coordinator">Treatment Coordinator</option>
                  <option value="sales">Sales</option>
                  <option value="dentist">Dentist</option>
                  <option value="director">Director</option>
                  <option value="nurse">Nurse</option>
                </select>
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={saveEditStaff}
                disabled={editStaffSaving}
                className="flex-1 py-2.5 rounded-lg bg-gold text-white text-sm font-semibold hover:bg-gold-light disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {editStaffSaving && <span className="w-3.5 h-3.5 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />}
                {editStaffSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditStaffId(null)}
                className="px-5 py-2.5 rounded-lg bg-navy-700 text-gray-400 text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {removeStaffId && (
        <ConfirmModal
          title="Remove staff member?"
          message="This will revoke their access to the clinic. You can add them back later."
          confirmLabel="Remove"
          confirmDanger
          isLoading={actionLoading}
          onConfirm={executeRemoveStaff}
          onCancel={() => setRemoveStaffId(null)}
        />
      )}
    </div>
  );
}

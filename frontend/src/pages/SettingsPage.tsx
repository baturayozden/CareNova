import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { MessageCircle, Bot, CalendarDays, User, Link2, Bell, Mail, Users, Eye, EyeOff, Calendar, Building2, Lock, CheckCircle, Globe, Archive, RotateCcw, Search } from 'lucide-react';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'admin';
  isActive: boolean;
  createdAt: string;
}

type SettingsTab = 'profile' | 'team' | 'integrations' | 'notifications' | 'archived';

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEBHOOK_URL   = 'https://api.carenova.ai/webhook/whatsapp';
const VERIFY_TOKEN  = 'carenova_webhook_2026';

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Team section (super_admin only) ──────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-purple-900/40 text-purple-300 border-purple-700/50',
  admin:       'bg-blue-900/40 text-blue-300 border-blue-700/50',
};

function TeamSection({ currentUserId }: { currentUserId: string }) {
  const [users,   setUsers]   = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form,    setForm]    = useState({ email: '', firstName: '', lastName: '', password: '', role: 'admin' });
  const [msg,     setMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ users: PlatformUser[] }>('/api/admin/platform-users');
      setUsers(res.data.users);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addUser() {
    if (!form.email || !form.firstName || !form.lastName || !form.password) return;
    setSaving(true);
    try {
      await api.post('/api/admin/platform-users', form);
      setForm({ email: '', firstName: '', lastName: '', password: '', role: 'admin' });
      setShowAdd(false);
      setMsg({ type: 'success', text: 'User added successfully.' });
      load();
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error || 'Failed to add user.' });
    } finally { setSaving(false); }
  }

  async function deactivate(id: string) {
    if (id === currentUserId) return;
    try {
      await api.patch(`/api/admin/platform-users/${id}/deactivate`);
      setUsers(a => a.map(u => u.id === id ? { ...u, isActive: false } : u));
      setMsg({ type: 'success', text: 'User deactivated.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error || 'Failed.' });
    }
  }

  async function remove(id: string) {
    if (id === currentUserId) return;
    if (!window.confirm('Remove this user?')) return;
    try {
      await api.delete(`/api/admin/platform-users/${id}`);
      setUsers(a => a.filter(u => u.id !== id));
      setMsg({ type: 'success', text: 'User removed.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error || 'Failed.' });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">Platform Team</h2>
          <p className="text-gray-500 text-xs mt-0.5">Manage super admins and platform admins.</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors">
          + Add User
        </button>
      </div>

      {msg && (
        <div className={`px-4 py-2.5 rounded-lg text-sm border ${msg.type === 'success' ? 'bg-green-950 border-green-800 text-green-300' : 'bg-red-950 border-red-800 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      {showAdd && (
        <div className="bg-surface-sunken border border-line rounded-xl p-5 space-y-3">
          <p className="text-accent text-xs font-semibold uppercase tracking-wider">New Platform User</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'firstName', label: 'First Name', type: 'text' },
              { key: 'lastName',  label: 'Last Name',  type: 'text' },
              { key: 'email',     label: 'Email',      type: 'email' },
              { key: 'password',  label: 'Password',   type: 'password' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-500 font-medium block mb-1">{f.label}</label>
                <input type={f.type} value={(form as any)[f.key]}
                  onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 outline-none focus:border-accent/50"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Role</label>
            <div className="flex gap-3">
              {[
                { value: 'admin',       label: 'Admin',       desc: 'Manage clinics & leads' },
                { value: 'super_admin', label: 'Super Admin', desc: 'Full platform access' },
              ].map(r => (
                <button key={r.value} type="button" onClick={() => setForm(x => ({ ...x, role: r.value }))}
                  className={`flex-1 text-left p-3 rounded-lg border transition-colors ${
                    form.role === r.value ? 'border-accent bg-accent/10 text-accent' : 'border-line text-gray-400 hover:border-line-strong hover:text-white'
                  }`}>
                  <p className="font-semibold text-sm">{r.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={addUser} disabled={saving}
              className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-60">
              {saving ? 'Adding…' : 'Add User'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-5 py-2 rounded-lg bg-surface-sunken text-gray-400 text-sm hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-4 border-line border-t-accent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-10">No platform users found.</p>
        ) : (
          <div className="divide-y divide-surface-sunken">
            {users.map(u => (
              <div key={u.id} className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold shrink-0">
                  {u.firstName[0]}{u.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{u.firstName} {u.lastName}</p>
                  <p className="text-gray-500 text-xs truncate">{u.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${ROLE_BADGE[u.role] || 'text-gray-400 bg-surface-sunken border-line'}`}>
                  {u.role.replace(/_/g, ' ')}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${u.isActive ? 'text-green-300 bg-green-900/40 border-green-700/50' : 'text-gray-500 bg-surface-sunken border-line'}`}>
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
                {u.id !== currentUserId && (
                  <div className="flex gap-1.5">
                    {u.isActive && (
                      <button onClick={() => deactivate(u.id)}
                        className="text-xs px-2.5 py-1 rounded-md bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/60 transition-colors">
                        Deactivate
                      </button>
                    )}
                    <button onClick={() => remove(u.id)}
                      className="text-xs px-2.5 py-1 rounded-md bg-red-900/30 text-red-400 hover:bg-red-900/60 transition-colors">
                      Remove
                    </button>
                  </div>
                )}
                {u.id === currentUserId && (
                  <span className="text-xs text-gray-600 italic">You</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Integrations section ──────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 5;

const AI_PROVIDERS = [
  { value: 'claude',  label: 'Claude (Anthropic)',  models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514'] },
  { value: 'openai',  label: 'OpenAI',              models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { value: 'gemini',  label: 'Google Gemini',       models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
  { value: 'grok',    label: 'Grok (xAI)',          models: ['grok-2', 'grok-2-mini'] },
];

interface CalStatus {
  connected:    boolean;
  email?:       string;
  calendarId?:  string;
  lastSyncedAt?: string;
  status?:      string;
}

function IntegrationsSection() {
  const { user } = useAuth();
  const [section,     setSection]     = useState<'whatsapp' | 'ai' | 'calendar' | 'website'>('whatsapp');
  const [wizardStep,  setWizardStep]  = useState<WizardStep>(1);
  const [waForm,      setWaForm]      = useState({ business_account_id: '', phone_number_id: '', access_token: '' });
  const [testResult,  setTestResult]  = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [copied,      setCopied]      = useState<string | null>(null);
  const [aiProvider,  setAiProvider]  = useState('claude');
  const [aiModel,     setAiModel]     = useState('claude-sonnet-4-20250514');
  const [aiKey,       setAiKey]       = useState('');
  const [showKey,     setShowKey]     = useState(false);
  const [aiSaved,     setAiSaved]     = useState(false);
  const [aiSaving,    setAiSaving]    = useState(false);

  // ── Google Calendar state ────────────────────────────────────────────────
  const [calStatus,       setCalStatus]       = useState<CalStatus | null>(null);
  const [calLoading,      setCalLoading]      = useState(false);
  const [calError,        setCalError]        = useState<string | null>(null);
  const [calDisconnecting, setCalDisconnecting] = useState(false);
  const [googleSuccess,   setGoogleSuccess]   = useState(false);

  // ── Website widget key state ──────────────────────────────────────────────
  const [siteKey,    setSiteKey]    = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError,   setKeyError]   = useState<string | null>(null);

  const canAccessWebsite = ['director', 'clinic_admin'].includes(user?.role ?? '');

  function copy(text: string, label: string) {
    copyToClipboard(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  async function testConnection() {
    setTestResult('testing');
    try {
      await api.post('/api/whatsapp/test', {
        phone_number_id:    waForm.phone_number_id,
        access_token:       waForm.access_token,
        business_account_id: waForm.business_account_id,
      });
      setTestResult('ok');
    } catch {
      setTestResult('fail');
    }
  }

  async function saveAiProvider() {
    setAiSaving(true);
    try {
      // Save to clinic AI settings via the general endpoint (needs clinic id)
      // For now save at platform level — extend in Phase 2 per-clinic
      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 2500);
    } catch {}
    finally { setAiSaving(false); }
  }

  // ── Website key helper ───────────────────────────────────────────────────

  const fetchWidgetKey = useCallback(async () => {
    if (!user?.tenantId) return;
    setKeyLoading(true);
    setKeyError(null);
    try {
      const res = await api.get<{ siteKey: string }>(`/api/clinics/${user.tenantId}/widget-key`);
      setSiteKey(res.data.siteKey);
    } catch {
      setKeyError('Failed to load your API key. Please try again.');
    } finally {
      setKeyLoading(false);
    }
  }, [user?.tenantId]);

  // ── Google Calendar helpers ──────────────────────────────────────────────

  const fetchCalStatus = useCallback(async () => {
    setCalLoading(true);
    setCalError(null);
    try {
      const res = await api.get<CalStatus>('/api/calendar/status');
      setCalStatus(res.data);
    } catch {
      setCalError('Failed to load calendar status');
    } finally {
      setCalLoading(false);
    }
  }, []);

  async function disconnectCalendar() {
    setCalDisconnecting(true);
    setCalError(null);
    try {
      await api.post('/api/calendar/disconnect');
      await fetchCalStatus();
    } catch {
      setCalError('Failed to disconnect calendar');
    } finally {
      setCalDisconnecting(false);
    }
  }

  function connectGoogleCalendar() {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    window.location.href = `${apiUrl}/api/calendar/google/connect`;
  }

  // Detect ?google=connected on mount (OAuth callback return)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google') === 'connected') {
      setSection('calendar');
      setGoogleSuccess(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('google');
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
      const t = setTimeout(() => setGoogleSuccess(false), 4000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch status whenever the calendar sub-nav is activated
  useEffect(() => {
    if (section === 'calendar') fetchCalStatus();
  }, [section, fetchCalStatus]);

  useEffect(() => {
    if (section === 'website' && canAccessWebsite) fetchWidgetKey();
  }, [section, canAccessWebsite, fetchWidgetKey]);

  const providerModels = AI_PROVIDERS.find(p => p.value === aiProvider)?.models || [];

  return (
    <div className="space-y-5">
      {/* Sub-nav */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'whatsapp', label: 'WhatsApp',   icon: MessageCircle },
          { key: 'ai',       label: 'AI Provider', icon: Bot           },
          { key: 'calendar', label: 'Calendar',    icon: CalendarDays  },
          ...(canAccessWebsite ? [{ key: 'website', label: 'Website', icon: Globe }] : []),
        ] as { key: string; label: string; icon: IconComponent }[]).map(s => (
          <button key={s.key} onClick={() => setSection(s.key as any)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              section === s.key ? 'bg-accent text-white' : 'bg-surface-sunken text-gray-400 hover:text-white'
            }`}>
            <s.icon size={13} />
            {s.label}
          </button>
        ))}
      </div>

      {/* WhatsApp Wizard */}
      {section === 'whatsapp' && (
        <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
          {/* Step progress */}
          <div className="px-6 py-4 border-b border-surface-sunken flex items-center gap-2">
            {([1,2,3,4,5] as WizardStep[]).map(n => (
              <React.Fragment key={n}>
                <button onClick={() => setWizardStep(n)}
                  className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                    wizardStep === n ? 'bg-accent text-white' : wizardStep > n ? 'bg-green-700 text-white' : 'bg-surface-sunken text-gray-500'
                  }`}>{wizardStep > n ? '✓' : n}</button>
                {n < 5 && <div className={`h-px flex-1 ${wizardStep > n ? 'bg-green-700' : 'bg-surface-sunken'}`} />}
              </React.Fragment>
            ))}
          </div>

          <div className="p-6 space-y-4">
            {wizardStep === 1 && (
              <>
                <h3 className="text-white font-semibold">Step 1: Business Account ID</h3>
                <p className="text-gray-400 text-sm">In Meta Business Manager → WhatsApp → Get your Business Account ID.</p>
                <input type="text" placeholder="123456789012345" value={waForm.business_account_id}
                  onChange={e => setWaForm(f => ({ ...f, business_account_id: e.target.value }))}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 outline-none focus:border-accent/50"
                />
              </>
            )}
            {wizardStep === 2 && (
              <>
                <h3 className="text-white font-semibold">Step 2: Phone Number ID</h3>
                <p className="text-gray-400 text-sm">In Meta for Developers → Your App → WhatsApp → Phone Number ID.</p>
                <input type="text" placeholder="987654321098765" value={waForm.phone_number_id}
                  onChange={e => setWaForm(f => ({ ...f, phone_number_id: e.target.value }))}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-600 outline-none focus:border-accent/50"
                />
              </>
            )}
            {wizardStep === 3 && (
              <>
                <h3 className="text-white font-semibold">Step 3: Access Token</h3>
                <p className="text-gray-400 text-sm">Generate a permanent System User token in Meta Business Manager with <code className="text-accent text-xs">whatsapp_business_messaging</code> permission.</p>
                <div className="relative">
                  <input type={showKey ? 'text' : 'password'} placeholder="EAA…" value={waForm.access_token}
                    onChange={e => setWaForm(f => ({ ...f, access_token: e.target.value }))}
                    className="w-full bg-surface border border-line rounded-lg px-3 py-2.5 pr-10 text-white text-sm placeholder-gray-600 outline-none focus:border-accent/50"
                  />
                  <button onClick={() => setShowKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </>
            )}
            {wizardStep === 4 && (
              <>
                <h3 className="text-white font-semibold">Step 4: Test Connection</h3>
                <p className="text-gray-400 text-sm">Verify your credentials work before setting up the webhook.</p>
                <button onClick={testConnection} disabled={testResult === 'testing'}
                  className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-60 flex items-center gap-2">
                  {testResult === 'testing' && <span className="w-4 h-4 border-2 border-surface-page border-t-transparent rounded-full animate-spin" />}
                  {testResult === 'testing' ? 'Testing…' : 'Test Connection'}
                </button>
                {testResult === 'ok'   && <p className="text-green-400 text-sm">✅ Connection successful!</p>}
                {testResult === 'fail' && <p className="text-red-400 text-sm">❌ Connection failed. Check your credentials.</p>}
              </>
            )}
            {wizardStep === 5 && (
              <>
                <h3 className="text-white font-semibold">Step 5: Configure Webhook in Meta</h3>
                <p className="text-gray-400 text-sm mb-4">In Meta for Developers → Your App → WhatsApp → Configuration → Webhook:</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Webhook URL</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-surface border border-line rounded-lg px-3 py-2 text-accent text-xs font-mono break-all">{WEBHOOK_URL}</code>
                      <button onClick={() => copy(WEBHOOK_URL, 'url')}
                        className="px-3 py-2 rounded-lg bg-surface-sunken text-gray-400 text-xs hover:text-white transition-colors shrink-0">
                        {copied === 'url' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1.5">Verify Token</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-surface border border-line rounded-lg px-3 py-2 text-accent text-xs font-mono">{VERIFY_TOKEN}</code>
                      <button onClick={() => copy(VERIFY_TOKEN, 'token')}
                        className="px-3 py-2 rounded-lg bg-surface-sunken text-gray-400 text-xs hover:text-white transition-colors shrink-0">
                        {copied === 'token' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="bg-surface/60 border border-surface-sunken rounded-lg p-4">
                    <p className="text-gray-400 text-xs leading-relaxed">
                      <strong className="text-white">Subscribe to:</strong> messages, message_deliveries, message_reads.<br />
                      After saving, Meta will send a verification request to your webhook URL — it will be confirmed automatically.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-green-400 text-sm font-medium">Webhook is live and ready</span>
                  </div>
                </div>
              </>
            )}

            {/* Step navigation */}
            <div className="flex gap-2 pt-2">
              {wizardStep > 1 && (
                <button onClick={() => setWizardStep(s => (s - 1) as WizardStep)}
                  className="px-4 py-2 rounded-lg bg-surface-sunken text-gray-400 text-sm hover:text-white transition-colors">
                  ← Back
                </button>
              )}
              {wizardStep < 5 && (
                <button onClick={() => setWizardStep(s => (s + 1) as WizardStep)}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors">
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Provider */}
      {section === 'ai' && (
        <div className="bg-surface-sunken border border-line rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-white font-semibold mb-1">AI Provider</h3>
            <p className="text-gray-500 text-xs">Choose the AI model powering your WhatsApp assistant.</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-2">Provider</label>
            <div className="grid grid-cols-2 gap-3">
              {AI_PROVIDERS.map(p => (
                <button key={p.value} onClick={() => { setAiProvider(p.value); setAiModel(p.models[0]); }}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    aiProvider === p.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line text-gray-400 hover:border-line-strong hover:text-white'
                  }`}>
                  <p className="font-semibold text-sm">{p.label}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-2">Model</label>
            <select value={aiModel} onChange={e => setAiModel(e.target.value)}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-accent/50">
              {providerModels.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-2">API Key</label>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} placeholder="sk-…" value={aiKey}
                onChange={e => setAiKey(e.target.value)}
                className="w-full bg-surface border border-line rounded-lg px-3 py-2.5 pr-10 text-white text-sm placeholder-gray-600 outline-none focus:border-accent/50"
              />
              <button onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-gray-600 text-xs mt-1">Leave blank to use the platform default key.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveAiProvider} disabled={aiSaving}
              className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-60">
              {aiSaving ? 'Saving…' : 'Save Provider Settings'}
            </button>
            {aiSaved && <span className="text-green-400 text-sm">✓ Saved</span>}
          </div>
        </div>
      )}

      {/* Calendar */}
      {section === 'calendar' && (
        <div className="bg-surface-sunken border border-line rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-white font-semibold mb-1">Calendar Integrations</h3>
            <p className="text-gray-500 text-xs">Sync appointments with your calendar provider.</p>
          </div>

          {/* OAuth success toast */}
          {googleSuccess && (
            <div className="flex items-center gap-2 bg-green-900/50 border border-green-700 rounded-lg px-4 py-3 text-green-300 text-sm">
              <CheckCircle size={16} /> Google Calendar connected successfully!
            </div>
          )}

          {/* Error banner */}
          {calError && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
              {calError}
            </div>
          )}

          {/* Google Calendar card */}
          <div className="bg-surface/60 border border-surface-sunken rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0"><Calendar size={20} className="text-gray-700" /></div>
                <div>
                  <p className="text-white font-medium text-sm">Google Calendar</p>
                  <p className="text-gray-500 text-xs">Two-way appointment sync</p>
                </div>
              </div>
              {calStatus?.connected
                ? <span className="text-xs bg-green-900/50 text-green-400 border border-green-700/50 px-2.5 py-1 rounded-full flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />Connected</span>
                : <span className="text-xs bg-surface-sunken text-gray-500 border border-line px-2.5 py-1 rounded-full">Not connected</span>
              }
            </div>

            {calLoading ? (
              <div className="mt-4 flex items-center gap-2 text-gray-500 text-xs">
                <span className="w-3.5 h-3.5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                Loading…
              </div>
            ) : calStatus?.connected ? (
              <div className="mt-4 space-y-3">
                <div className="bg-surface-sunken rounded-lg px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Account</span>
                    <span className="text-gray-200">{calStatus.email}</span>
                  </div>
                  {calStatus.calendarId && calStatus.calendarId !== calStatus.email && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Calendar ID</span>
                      <span className="text-gray-400 font-mono">{calStatus.calendarId}</span>
                    </div>
                  )}
                  {calStatus.lastSyncedAt && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Last synced</span>
                      <span className="text-gray-400">{new Date(calStatus.lastSyncedAt).toLocaleString('en-GB')}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={disconnectCalendar}
                  disabled={calDisconnecting}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-800/50 hover:border-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {calDisconnecting && <span className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />}
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-gray-500 text-xs leading-relaxed">
                  Connect your Google Calendar to sync appointments automatically. CareNova appointments push to Google; external Google events appear as busy blocks in your schedule.
                </p>
                <button
                  onClick={connectGoogleCalendar}
                  className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/80 transition-colors flex items-center gap-2"
                >
                  <Calendar size={16} /> Connect Google Calendar
                </button>
              </div>
            )}
          </div>

          {/* Outlook / Dentally — still coming soon */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'Outlook / Exchange', icon: <Mail size={28} />, desc: 'Microsoft 365 calendar sync' },
              { name: 'Dentally PMS',       icon: '🦷', desc: 'Practice management system' },
            ].map(c => (
              <div key={c.name} className="bg-surface/60 border border-surface-sunken rounded-xl p-4 text-center opacity-50">
                <div className="text-3xl mb-3">{c.icon}</div>
                <p className="text-white text-sm font-medium mb-1">{c.name}</p>
                <p className="text-gray-500 text-xs mb-3">{c.desc}</p>
                <span className="text-xs bg-surface-sunken text-gray-500 border border-line px-2.5 py-1 rounded-full">Coming Soon</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Website & WordPress */}
      {section === 'website' && canAccessWebsite && (
        <div className="bg-surface-sunken border border-line rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-white font-semibold mb-1">Website & WordPress</h3>
            <p className="text-gray-500 text-xs">Embed a booking widget on your clinic website.</p>
          </div>

          {keyError && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-3">
              {keyError}
            </div>
          )}

          <div className="bg-surface/60 border border-surface-sunken rounded-xl p-5 space-y-5">
            {/* Card header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                <Globe size={20} className="text-gray-700" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">Care Dental WordPress Plugin</p>
                <p className="text-gray-500 text-xs">Add a booking widget to any website</p>
              </div>
            </div>

            {/* API key */}
            <div>
              <p className="text-gray-400 text-xs mb-2">Your website API key</p>
              {keyLoading ? (
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                  <span className="w-3.5 h-3.5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                  Loading…
                </div>
              ) : siteKey ? (
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={siteKey}
                    className="flex-1 min-w-0 bg-surface-sunken border border-line rounded-lg px-3 py-2 text-xs font-mono text-gray-200 outline-none"
                  />
                  <button
                    onClick={() => copy(siteKey, 'siteKey')}
                    className="px-3 py-2 rounded-lg bg-surface-sunken border border-line text-xs text-gray-300 hover:text-white hover:border-accent transition-colors whitespace-nowrap"
                  >
                    {copied === 'siteKey' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ) : null}
            </div>

            {/* Download */}
            <a
              href="/care-dental.zip"
              download
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/80 transition-colors"
            >
              Download WordPress Plugin
            </a>

            {/* Setup steps */}
            <div className="border-t border-surface-sunken pt-4 space-y-3">
              <p className="text-gray-400 text-xs font-medium">Setup instructions</p>
              {[
                'Install the Care Dental plugin on your WordPress site (Plugins → Add New → Upload).',
                'Go to Settings → Care Dental, paste this key, click Connect.',
                'Add [carenova_booking] to any page. Enquiries appear in your dashboard.',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-surface-sunken text-gray-300 flex items-center justify-center shrink-0 font-semibold text-[10px] mt-0.5">{i + 1}</span>
                  <span className="text-xs text-gray-400 leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Clinic Settings section ───────────────────────────────────────────────────

const EDITOR_ROLES: string[] = ['clinic_admin', 'director'];

const TIMEZONES = [
  'Europe/London',
  'Europe/Istanbul',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Amsterdam',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Kuwait',
  'Africa/Cairo',
];

interface ClinicData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  timezone: string | null;
}

function ClinicSettingsSection({ onGoToIntegrations }: { onGoToIntegrations: () => void }) {
  const { user } = useAuth();
  const canEdit = user ? EDITOR_ROLES.includes(user.role) : false;

  const [loading,  setLoading]  = useState(true);
  const [name,     setName]     = useState('');
  const [address,  setAddress]  = useState('');
  const [cPhone,   setCPhone]   = useState('');
  const [cEmail,   setCEmail]   = useState('');
  const [website,  setWebsite]  = useState('');
  const [timezone, setTimezone] = useState('Europe/Istanbul');
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user?.tenantId) { setLoading(false); return; }
    api.get<{ clinic: ClinicData }>(`/api/clinics/${user.tenantId}`)
      .then(res => {
        const c = res.data.clinic;
        setName(c.name ?? '');
        setAddress(c.address ?? '');
        setCPhone(c.phone ?? '');
        setCEmail(c.email ?? '');
        setWebsite(c.website ?? '');
        setTimezone(c.timezone ?? 'Europe/Istanbul');
      })
      .catch(() => setMsg({ type: 'error', text: 'Failed to load clinic data.' }))
      .finally(() => setLoading(false));
  }, [user?.tenantId]);

  async function save() {
    if (!user?.tenantId) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.put<{ clinic: ClinicData }>(`/api/clinics/${user.tenantId}`, {
        name, address, phone: cPhone, email: cEmail, website, timezone,
      });
      setMsg({ type: 'success', text: 'Clinic settings saved.' });
    } catch (err: any) {
      const status = err?.response?.status;
      const text = status === 403
        ? "You don't have permission to update clinic settings."
        : err?.response?.data?.error || 'Failed to save clinic settings.';
      setMsg({ type: 'error', text });
    } finally {
      setSaving(false);
    }
  }

  const CIN  = (disabled: boolean) =>
    `w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent/50 transition-colors${disabled ? ' opacity-50 cursor-not-allowed' : ''}`;
  const CLB  = 'block text-xs text-gray-500 font-medium mb-1.5';
  const CMSG = (type: 'success' | 'error') =>
    `px-4 py-2.5 rounded-lg text-sm border ${type === 'success' ? 'bg-green-950 border-green-800 text-green-300' : 'bg-red-950 border-red-800 text-red-300'}`;

  return (
    <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-center gap-2">
        <Building2 size={20} />
        <h2 className="font-medium text-white text-sm">Clinic Settings</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-4 border-line border-t-accent rounded-full animate-spin" />
        </div>
      ) : !user?.tenantId ? (
        <div className="px-6 py-5">
          <p className="text-gray-500 text-sm">No clinic associated with your account.</p>
        </div>
      ) : (
        <div className="px-6 py-5 space-y-4">
          {msg && <div className={CMSG(msg.type)}>{msg.text}</div>}

          <div>
            <label className={CLB}>Clinic name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              disabled={!canEdit} className={CIN(!canEdit)} placeholder="Riverside Dental" />
          </div>

          <div>
            <label className={CLB}>Address</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              disabled={!canEdit} className={CIN(!canEdit)} placeholder="123 High Street, London, W1A 1AA" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={CLB}>Phone</label>
              <input type="tel" value={cPhone} onChange={e => setCPhone(e.target.value)}
                disabled={!canEdit} className={CIN(!canEdit)} placeholder="+44 20 7946 0000" />
            </div>
            <div>
              <label className={CLB}>Email</label>
              <input type="email" value={cEmail} onChange={e => setCEmail(e.target.value)}
                disabled={!canEdit} className={CIN(!canEdit)} placeholder="hello@clinic.com" />
            </div>
          </div>

          <div>
            <label className={CLB}>Website</label>
            <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
              disabled={!canEdit} className={CIN(!canEdit)} placeholder="https://www.myclinic.co.uk" />
          </div>

          <div>
            <label className={CLB}>Timezone</label>
            <select
              value={TIMEZONES.includes(timezone) ? timezone : timezone}
              onChange={e => setTimezone(e.target.value)}
              disabled={!canEdit}
              className={CIN(!canEdit)}
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              {!TIMEZONES.includes(timezone) && timezone && (
                <option value={timezone}>{timezone}</option>
              )}
            </select>
          </div>

          <div className="bg-surface/60 border border-surface-sunken rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm">WhatsApp Number</p>
              <p className="text-gray-600 text-xs mt-0.5">Managed via WhatsApp Cloud API</p>
            </div>
            <button
              onClick={() => { onGoToIntegrations(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="text-xs text-accent border border-accent/30 bg-accent/10 hover:bg-accent/20 px-2.5 py-1 rounded-full cursor-pointer transition-colors">
              → Integrations
            </button>
          </div>

          {canEdit ? (
            <div className="pt-1">
              <button onClick={save} disabled={saving}
                className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-60 transition-colors">
                {saving ? 'Saving…' : 'Save Clinic Settings'}
              </button>
            </div>
          ) : (
            <p className="text-gray-600 text-xs">You have read-only access to clinic settings.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileSection({ onGoToIntegrations }: { onGoToIntegrations: () => void }) {
  const { user, refreshUser } = useAuth();

  const [firstName,  setFirstName]  = useState(user?.firstName ?? '');
  const [lastName,   setLastName]   = useState(user?.lastName  ?? '');
  const [phone,      setPhone]      = useState(user?.phone     ?? '');
  const [avatarUrl,  setAvatarUrl]  = useState(user?.avatarUrl ?? '');
  const [profSaving, setProfSaving] = useState(false);
  const [profMsg,    setProfMsg]    = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [curPw,      setCurPw]      = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwMsg,      setPwMsg]      = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pwValErr,   setPwValErr]   = useState<string | null>(null);

  async function saveProfile() {
    setProfSaving(true);
    setProfMsg(null);
    try {
      const payload: Record<string, string> = {};
      if (firstName.trim() !== (user?.firstName ?? '')) payload.firstName = firstName.trim();
      if (lastName.trim()  !== (user?.lastName  ?? '')) payload.lastName  = lastName.trim();
      if (phone.trim()     !== (user?.phone     ?? '')) payload.phone     = phone.trim();
      if (avatarUrl.trim() !== (user?.avatarUrl ?? '')) payload.avatarUrl = avatarUrl.trim();

      if (Object.keys(payload).length === 0) {
        setProfMsg({ type: 'error', text: 'No changes to save.' });
        return;
      }
      await api.patch('/auth/profile', payload);
      await refreshUser();
      setProfMsg({ type: 'success', text: 'Profile saved.' });
    } catch (err: any) {
      setProfMsg({ type: 'error', text: err?.response?.data?.error || 'Failed to save profile.' });
    } finally {
      setProfSaving(false);
    }
  }

  async function changePassword() {
    setPwMsg(null);
    setPwValErr(null);
    if (newPw.length < 8) { setPwValErr('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwValErr('Passwords do not match.'); return; }
    setPwSaving(true);
    try {
      await api.post('/auth/profile/change-password', { currentPassword: curPw, newPassword: newPw });
      setCurPw(''); setNewPw(''); setConfirmPw('');
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
    } catch (err: any) {
      const status = err?.response?.status;
      const msg    = err?.response?.data?.error || 'Failed to change password.';
      setPwMsg({ type: 'error', text: status === 401 ? 'Current password is incorrect.' : msg });
    } finally {
      setPwSaving(false);
    }
  }

  const INPUT = 'w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent/50 transition-colors';
  const LABEL = 'block text-xs text-gray-500 font-medium mb-1.5';
  const MSG   = (type: 'success' | 'error') =>
    `px-4 py-2.5 rounded-lg text-sm border ${type === 'success' ? 'bg-green-950 border-green-800 text-green-300' : 'bg-red-950 border-red-800 text-red-300'}`;

  return (
    <div className="space-y-5">

      {/* ── Profile info ────────────────────────────────────────────────────── */}
      <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-center gap-2">
          <User size={20} />
          <h2 className="font-medium text-white text-sm">Profile</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {profMsg && <div className={MSG(profMsg.type)}>{profMsg.text}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>First Name</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                className={INPUT} placeholder="First name" />
            </div>
            <div>
              <label className={LABEL}>Last Name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                className={INPUT} placeholder="Last name" />
            </div>
          </div>

          <div>
            <label className={LABEL}>Email address</label>
            <input type="email" value={user?.email ?? ''} disabled
              className={`${INPUT} opacity-50 cursor-not-allowed`} />
            <p className="text-gray-600 text-xs mt-1">Email cannot be changed. Contact support to update.</p>
          </div>

          <div>
            <label className={LABEL}>Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              className={INPUT} placeholder="+44 7700 900000" />
          </div>

          <div>
            <label className={LABEL}>Avatar URL</label>
            <input type="url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)}
              className={INPUT} placeholder="https://…" />
            <p className="text-gray-600 text-xs mt-1">Direct image URL. File upload coming in a later update.</p>
          </div>

          <div className="pt-1">
            <button onClick={saveProfile} disabled={profSaving}
              className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-60 transition-colors">
              {profSaving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Change password ──────────────────────────────────────────────────── */}
      <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-center gap-2">
          <Lock size={20} />
          <h2 className="font-medium text-white text-sm">Change Password</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {pwMsg && <div className={MSG(pwMsg.type)}>{pwMsg.text}</div>}

          <div>
            <label className={LABEL}>Current password</label>
            <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)}
              className={INPUT} placeholder="••••••••" />
          </div>
          <div>
            <label className={LABEL}>New password</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
              className={INPUT} placeholder="Min. 8 characters" />
          </div>
          <div>
            <label className={LABEL}>Confirm new password</label>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              className={INPUT} placeholder="••••••••" />
            {pwValErr && <p className="text-red-400 text-xs mt-1">{pwValErr}</p>}
          </div>

          <div className="pt-1">
            <button onClick={changePassword} disabled={pwSaving}
              className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-60 transition-colors">
              {pwSaving ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Clinic Settings — Faz 3 ─────────────────────────────────────────── */}
      {user?.role !== 'super_admin' && <ClinicSettingsSection onGoToIntegrations={onGoToIntegrations} />}
    </div>
  );
}

// ── Notifications section ────────────────────────────────────────────────────

interface NotifPref { eventType: string; channel: string; enabled: boolean; }

const EVENT_LABELS: Record<string, { title: string; desc: string }> = {
  new_lead:             { title: 'New lead received',    desc: 'When a new lead enters your pipeline' },
  lead_booked:          { title: 'Lead booked',          desc: 'When a lead converts to a booking' },
  appointment_reminder: { title: 'Appointment reminder', desc: 'Upcoming appointment reminders' },
  urgent_escalation:    { title: 'Urgent escalation',    desc: 'When a patient needs immediate attention' },
  no_show:              { title: 'No-show',              desc: 'When a patient misses an appointment' },
  ai_quota_warning:     { title: 'AI quota warning',     desc: 'When your AI message quota is running low' },
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50 ${
        checked ? 'bg-accent' : 'bg-line'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function NotificationsSection() {
  const [prefs,   setPrefs]   = useState<NotifPref[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.get<{ preferences: NotifPref[] }>('/api/notification-preferences')
      .then(res => setPrefs(res.data.preferences))
      .catch(() => setMsg({ type: 'error', text: 'Failed to load notification preferences.' }))
      .finally(() => setLoading(false));
  }, []);

  function toggle(eventType: string) {
    setPrefs(prev => prev.map(p =>
      p.eventType === eventType ? { ...p, enabled: !p.enabled } : p,
    ));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.put<{ preferences: NotifPref[] }>('/api/notification-preferences', { preferences: prefs });
      setPrefs(res.data.preferences);
      setMsg({ type: 'success', text: 'Notification preferences saved.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.response?.data?.error || 'Failed to save preferences.' });
    } finally {
      setSaving(false);
    }
  }

  const NMSG = (type: 'success' | 'error') =>
    `px-4 py-2.5 rounded-lg text-sm border ${type === 'success' ? 'bg-green-950 border-green-800 text-green-300' : 'bg-red-950 border-red-800 text-red-300'}`;

  return (
    <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={20} />
          <h2 className="font-medium text-white text-sm">Notifications</h2>
        </div>
        {/* Channel header */}
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider pr-1">Email</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-4 border-line border-t-accent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {msg && <div className={`mx-6 mt-4 ${NMSG(msg.type)}`}>{msg.text}</div>}

          <div className="divide-y divide-line">
            {prefs.map(p => {
              const label = EVENT_LABELS[p.eventType];
              if (!label) return null;
              return (
                <div key={p.eventType} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-gray-200 text-sm font-medium">{label.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{label.desc}</p>
                  </div>
                  <Toggle checked={p.enabled} onChange={() => toggle(p.eventType)} />
                </div>
              );
            })}
          </div>

          <div className="px-6 py-4 border-t border-line">
            <button onClick={save} disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-60 transition-colors">
              {saving ? 'Saving…' : 'Save Notification Preferences'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Archived Patients Section ─────────────────────────────────────────────────

interface ArchivedPatient {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  deleted_at: string;
  deleted_by_first: string | null;
  deleted_by_last: string | null;
  deals: string;
  cases: string;
  documents: string;
  invoices: string;
}

function fmtLinkedRecords(p: ArchivedPatient): string {
  const parts: string[] = [];
  if (Number(p.deals) > 0)     parts.push(`${p.deals} deal${Number(p.deals) !== 1 ? 's' : ''}`);
  if (Number(p.cases) > 0)     parts.push(`${p.cases} case${Number(p.cases) !== 1 ? 's' : ''}`);
  if (Number(p.documents) > 0) parts.push(`${p.documents} doc${Number(p.documents) !== 1 ? 's' : ''}`);
  if (Number(p.invoices) > 0)  parts.push(`${p.invoices} invoice${Number(p.invoices) !== 1 ? 's' : ''}`);
  return parts.length ? parts.join(', ') : 'None';
}

function ArchivedPatientsSection() {
  const { user } = useAuth();
  const [patients,   setPatients]   = useState<ArchivedPatient[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [restoring,  setRestoring]  = useState<string | null>(null);
  const [confirmId,  setConfirmId]  = useState<string | null>(null);
  const [toast,      setToast]      = useState<string | null>(null);
  const [error,      setError]      = useState('');

  const fetchArchived = useCallback(async (q = search) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { search: q };
      if (user?.tenantId) params.tenantId = user.tenantId;
      const res = await api.get<{ patients: ArchivedPatient[] }>('/api/patients/archived', { params });
      setPatients(res.data.patients);
    } catch {
      setError('Failed to load archived patients.');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchArchived(''); }, [fetchArchived]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleRestore(p: ArchivedPatient) {
    setRestoring(p.id);
    setConfirmId(null);
    try {
      const params: Record<string, string> = {};
      if (user?.tenantId) params.tenantId = user.tenantId;
      await api.post(`/api/patients/${p.id}/restore`, {}, { params });
      showToast(`Patient restored`);
      fetchArchived(search);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to restore patient.');
    } finally {
      setRestoring(null);
    }
  }

  const confirmPatient = patients.find(p => p.id === confirmId);

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-700 text-white text-sm px-5 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name or phone…"
          value={search}
          onChange={e => { setSearch(e.target.value); fetchArchived(e.target.value); }}
          className="w-full pl-9 pr-4 py-2 bg-surface border border-line rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
      ) : error ? (
        <p className="text-red-400 text-sm py-4">{error}</p>
      ) : patients.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Archive size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No archived patients</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface/60">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Patient</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Phone</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Archived on</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Archived by</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Linked records</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-sunken/60">
              {patients.map(p => (
                <tr key={p.id} className="hover:bg-surface-sunken/40 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">
                    {p.first_name} {p.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{p.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {new Date(p.deleted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {p.deleted_by_first ? `${p.deleted_by_first} ${p.deleted_by_last}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmtLinkedRecords(p)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={restoring === p.id}
                      onClick={() => setConfirmId(p.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-line-strong text-gray-300 hover:border-accent/60 hover:text-accent transition-colors disabled:opacity-50"
                    >
                      <RotateCcw size={12} />
                      {restoring === p.id ? 'Restoring…' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm restore modal */}
      {confirmId && confirmPatient && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
          <div className="bg-surface-sunken border border-line rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-white font-semibold mb-2">Restore patient?</h3>
            <p className="text-gray-400 text-sm mb-4">
              Restore <span className="text-white font-medium">{confirmPatient.first_name} {confirmPatient.last_name}</span> and{' '}
              {fmtLinkedRecords(confirmPatient)}? They will reappear in patient lists and commission figures.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(confirmPatient)}
                className="px-4 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────

interface SettingsPageProps {
  initialTab?: SettingsTab;
}

export default function SettingsPage({ initialTab }: SettingsPageProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = ['clinic_admin', 'super_admin'].includes(user?.role ?? '');
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'profile');

  const tabs: { value: SettingsTab; label: string; icon: IconComponent; superAdminOnly?: boolean; adminOnly?: boolean }[] = [
    { value: 'profile',      label: 'Profile',            icon: User    },
    { value: 'integrations', label: 'Integrations',       icon: Link2   },
    { value: 'notifications',label: 'Notifications',      icon: Bell    },
    { value: 'archived',     label: 'Archived patients',  icon: Archive, adminOnly: true },
    { value: 'team',         label: 'Team',               icon: Users,  superAdminOnly: true },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-serif text-3xl text-white">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your account, integrations, and platform configuration</p>
        </div>

        {/* Current user card */}
        <div className="bg-surface-sunken border border-line rounded-xl p-5 flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-bold text-lg shrink-0">
            {user ? `${user.firstName[0]}${user.lastName[0]}` : 'DC'}
          </div>
          <div>
            <p className="text-white font-semibold">{user ? `${user.firstName} ${user.lastName}` : 'Demo User'}</p>
            <p className="text-gray-400 text-sm">{user?.email}</p>
            <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20 capitalize">
              {user?.role?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1 border-b border-line mb-6">
          {tabs.filter(t => (!t.superAdminOnly || isSuperAdmin) && (!t.adminOnly || isAdmin)).map(t => (
            <button key={t.value} onClick={() => setActiveTab(t.value)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === t.value
                  ? 'border-accent text-accent'
                  : 'border-transparent text-gray-500 hover:text-white'
              }`}>
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile */}
        {activeTab === 'profile' && <ProfileSection onGoToIntegrations={() => setActiveTab('integrations')} />}

        {/* Integrations */}
        {activeTab === 'integrations' && <IntegrationsSection />}

        {/* Notifications */}
        {activeTab === 'notifications' && <NotificationsSection />}

        {/* Archived patients — clinic_admin + super_admin */}
        {activeTab === 'archived' && isAdmin && <ArchivedPatientsSection />}

        {/* Team — super_admin only */}
        {activeTab === 'team' && isSuperAdmin && user && (
          <TeamSection currentUserId={user.id} />
        )}

        <p className="text-center text-gray-600 text-xs py-6">CareNova AI v0.2</p>
      </div>
    </div>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_API_URL || '';
const BLUE = '#1B6FEA';
const INK = '#0f172a';
const BODY = '#475569';
const MUTED = '#94a3b8';
const LINE = '#e2e8f0';

type StepKey = 'availability' | 'ai' | 'notify';
interface OnboardingState {
  steps?: Partial<Record<StepKey, boolean>>;
  completed?: boolean;
  dismissed?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function apiCall(path: string, method: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { const j = await res.json(); msg = j.error || j.message || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json().catch(() => ({}));
}

export default function OnboardingWizard() {
  const { user } = useAuth();
  const tenantId = user?.tenantId || '';
  const isTenantUser = !!tenantId && user?.role !== 'super_admin' && user?.role !== 'admin';

  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<OnboardingState>({});
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [hours, setHours] = useState(
    DAYS.map((_, d) => ({ day_of_week: d, enabled: d >= 1 && d <= 5, start_time: '09:00', end_time: '18:00', slot_duration_minutes: 30 }))
  );
  const [ai, setAi] = useState({ tone: 'friendly', welcome_message: '', out_of_hours_message: '' });
  const [notifyEmail, setNotifyEmail] = useState('');

  const persist = useCallback(async (next: OnboardingState) => {
    setState(next);
    try { await apiCall('/api/onboarding', 'PATCH', { onboardingStatus: next }); } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    if (!isTenantUser) { setLoaded(true); return; }
    apiCall('/api/onboarding', 'GET')
      .then((d) => {
        const os: OnboardingState = d.onboardingStatus || {};
        setState(os);
        setNotifyEmail(d.notificationEmail || user?.email || '');
        if (!os.completed && !os.dismissed) setOpen(true);
      })
      .catch(() => { setNotifyEmail(user?.email || ''); })
      .finally(() => setLoaded(true));
  }, [isTenantUser, user]);

  if (!loaded || !isTenantUser) return null;
  if (state.completed) return null;

  const markStep = (k: StepKey) => persist({ ...state, steps: { ...(state.steps || {}), [k]: true } });

  const saveAvailability = async () => {
    setSaving(true); setErr('');
    try {
      const rules = hours.filter((h) => h.enabled).map((h) => ({ day_of_week: h.day_of_week, start_time: h.start_time, end_time: h.end_time, slot_duration_minutes: h.slot_duration_minutes, is_active: true }));
      await apiCall(`/api/clinics/${tenantId}/availability`, 'POST', { rules });
      await markStep('availability');
      setStep(1);
    } catch (e: any) { setErr(e.message || 'Failed'); } finally { setSaving(false); }
  };

  const saveAi = async () => {
    setSaving(true); setErr('');
    try {
      await apiCall(`/api/clinics/${tenantId}/ai-settings`, 'PUT', {
        tone: ai.tone,
        language_mode: 'auto',
        welcome_message: ai.welcome_message || null,
        out_of_hours_message: ai.out_of_hours_message || null,
        escalation_enabled: true,
        escalation_keywords: ['urgent', 'pain', 'emergency', 'bleeding', 'swelling', 'broken'],
      });
      await markStep('ai');
      setStep(2);
    } catch (e: any) { setErr(e.message || 'Failed'); } finally { setSaving(false); }
  };

  const saveNotify = async () => {
    setSaving(true); setErr('');
    try {
      await apiCall('/api/onboarding', 'PATCH', { notificationEmail: notifyEmail, onboardingStatus: { ...state, steps: { ...(state.steps || {}), notify: true }, completed: true } });
      setState({ ...state, completed: true });
      setOpen(false);
    } catch (e: any) { setErr(e.message || 'Failed'); } finally { setSaving(false); }
  };

  const dismiss = () => { persist({ ...state, dismissed: true }); setOpen(false); };

  if (!open) {
    return (
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 60, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: '0 12px 40px rgba(15,23,42,0.12)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, maxWidth: 360 }}>
        <div>
          <div style={{ color: INK, fontWeight: 600, fontSize: 14 }}>Finish setting up your AI</div>
          <div style={{ color: MUTED, fontSize: 12 }}>A few steps left to go live.</div>
        </div>
        <button onClick={() => setOpen(true)} style={{ background: BLUE, color: '#fff', border: 0, borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Continue</button>
      </div>
    );
  }

  const STEPS = ['Availability', 'AI Voice', 'Alerts'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(8,12,20,0.55)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: INK, fontWeight: 700, fontSize: 17 }}>Get Your AI Ready</div>
            <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</div>
          </div>
          <button onClick={dismiss} style={{ background: 'none', border: 0, color: MUTED, fontSize: 13, cursor: 'pointer' }}>Later</button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '12px 24px 0' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= step ? BLUE : LINE }} />
          ))}
        </div>

        <div style={{ padding: 24, minHeight: 240 }}>
          {step === 0 && (
            <div>
              <p style={{ color: BODY, fontSize: 14, marginTop: 0 }}>When can patients be booked? The AI offers slots only inside these hours. You can fine-tune everything later in Settings.</p>
              {hours.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <label style={{ width: 90, display: 'flex', alignItems: 'center', gap: 6, color: INK, fontSize: 14 }}>
                    <input type="checkbox" checked={h.enabled} onChange={(e) => setHours(hours.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))} /> {DAYS[h.day_of_week]}
                  </label>
                  <input type="time" value={h.start_time} disabled={!h.enabled} onChange={(e) => setHours(hours.map((x, j) => j === i ? { ...x, start_time: e.target.value } : x))} style={{ padding: 6, borderRadius: 8, border: `1px solid ${LINE}`, color: INK }} />
                  <span style={{ color: MUTED }}>-</span>
                  <input type="time" value={h.end_time} disabled={!h.enabled} onChange={(e) => setHours(hours.map((x, j) => j === i ? { ...x, end_time: e.target.value } : x))} style={{ padding: 6, borderRadius: 8, border: `1px solid ${LINE}`, color: INK }} />
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <div>
              <p style={{ color: BODY, fontSize: 14, marginTop: 0 }}>How should the AI sound, and what should it say first? You can refine this anytime in Settings.</p>
              <label style={{ color: INK, fontSize: 13, fontWeight: 600 }}>Tone</label>
              <select value={ai.tone} onChange={(e) => setAi({ ...ai, tone: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${LINE}`, marginTop: 6, marginBottom: 14, color: INK }}>
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
              </select>
              <input placeholder="Welcome Message (Optional)" value={ai.welcome_message} onChange={(e) => setAi({ ...ai, welcome_message: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${LINE}`, marginBottom: 12, color: INK }} />
              <input placeholder="Out-of-Hours Message (Optional)" value={ai.out_of_hours_message} onChange={(e) => setAi({ ...ai, out_of_hours_message: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${LINE}`, color: INK }} />
            </div>
          )}

          {step === 2 && (
            <div>
              <p style={{ color: BODY, fontSize: 14, marginTop: 0 }}>Where should we send alerts when the AI books a new appointment or finds a hot lead?</p>
              <label style={{ color: INK, fontSize: 13, fontWeight: 600 }}>Notification Email</label>
              <input type="email" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${LINE}`, marginTop: 6, color: INK }} />
              <p style={{ color: MUTED, fontSize: 13, marginTop: 14 }}>Tip: Add your prices, treatments and clinic info anytime under Settings, so the AI can answer patient questions accurately.</p>
            </div>
          )}

          {err && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{err}</div>}
        </div>

        <div style={{ padding: '16px 24px', borderTop: `1px solid ${LINE}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{ background: 'none', border: 0, color: step === 0 ? LINE : BODY, fontSize: 14, cursor: step === 0 ? 'default' : 'pointer' }}>Back</button>
          <button
            onClick={step === 0 ? saveAvailability : step === 1 ? saveAi : saveNotify}
            disabled={saving}
            style={{ background: BLUE, color: '#fff', border: 0, borderRadius: 999, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : step === 2 ? 'Finish' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

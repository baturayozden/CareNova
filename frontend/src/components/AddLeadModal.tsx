import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { ApiLead, Lead } from '../types';

interface Props {
  isOpen:      boolean;
  onClose:     () => void;
  onCreated:   (lead: ApiLead) => void;
  editLead?:   (Lead & { id: string }) | null;
  onUpdated?:  (lead: Lead & { id: string }) => void;
}

const LANGUAGE_OPTIONS = [
  { value: 'en', label: '🇬🇧 English' },
  { value: 'tr', label: '🇹🇷 Turkish' },
  { value: 'ar', label: '🇸🇦 Arabic' },
  { value: 'de', label: '🇩🇪 German' },
  { value: 'fr', label: '🇫🇷 French' },
  { value: 'es', label: '🇪🇸 Spanish' },
];

const INPUT    = 'w-full bg-navy-700 border border-navy-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold transition-colors';
const SELECT   = 'w-full bg-navy-700 border border-navy-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold transition-colors';
const LABEL    = 'block text-xs font-medium text-gray-400 mb-1.5';
const TEXTAREA = 'w-full bg-navy-700 border border-navy-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold transition-colors resize-none';

const EMPTY_FORM = {
  firstName:         '',
  lastName:          '',
  phone:             '',
  email:             '',
  language:          'en',
  treatmentInterest: '',
  notes:             '',
  aiFollowUpEnabled: false,
  gdprConsentGiven:  false,
};

export default function AddLeadModal({ isOpen, onClose, onCreated, editLead, onUpdated }: Props) {
  const isEditMode = !!editLead;

  const [form,      setForm]      = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Populate form when switching to edit mode or when editLead changes
  useEffect(() => {
    if (isOpen && editLead) {
      setForm({
        firstName:         editLead.name.split(' ')[0] || '',
        lastName:          editLead.name.split(' ').slice(1).join(' ') || '',
        phone:             editLead.phone,
        email:             editLead.email || '',
        language:          editLead.language || 'en',
        treatmentInterest: editLead.treatment || '',
        notes:             editLead.notes || '',
        aiFollowUpEnabled: editLead.aiFollowUpEnabled,
        gdprConsentGiven:  editLead.gdprConsentGiven,
      });
      setError(null);
    } else if (isOpen && !editLead) {
      setForm(EMPTY_FORM);
      setError(null);
    }
  }, [isOpen, editLead]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const setCheck = (k: 'aiFollowUpEnabled' | 'gdprConsentGiven') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (k === 'aiFollowUpEnabled' && !e.target.checked) {
        setForm(f => ({ ...f, aiFollowUpEnabled: false, gdprConsentGiven: false }));
      } else {
        setForm(f => ({ ...f, [k]: e.target.checked }));
      }
    };

  function validate(): string | null {
    if (!form.firstName.trim()) return 'First name is required.';
    if (!form.phone.trim()) return 'Phone number is required.';
    if (form.aiFollowUpEnabled && !form.gdprConsentGiven)
      return 'GDPR consent is required to enable AI follow-up.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setIsLoading(true);
    setError(null);

    try {
      if (isEditMode && editLead) {
        // ── Edit mode: PATCH /:id ────────────────────────────────────────────
        const res = await api.patch<{ lead: ApiLead }>(`/api/leads/${editLead.id}`, {
          firstName:         form.firstName.trim(),
          lastName:          form.lastName.trim() || undefined,
          phone:             form.phone.trim() || undefined,
          email:             form.email.trim() || undefined,
          language:          form.language,
          treatmentInterest: form.treatmentInterest.trim() || undefined,
          notes:             form.notes.trim() || undefined,
          aiFollowUpEnabled: form.aiFollowUpEnabled,
          gdprConsentGiven:  form.gdprConsentGiven,
        });
        // Convert ApiLead back to Lead & { id } for the panel refresh
        const raw = res.data.lead;
        const updated: Lead & { id: string } = {
          id:                raw.id,
          name:              `${raw.firstName} ${raw.lastName}`.trim() || raw.phone,
          phone:             raw.phone,
          email:             raw.email ?? null,
          clinic:            raw.tenantName || 'CareNova',
          source:            raw.source || 'manual',
          status:            raw.status,
          language:          raw.language || 'en',
          lastContact:       raw.lastAiMessageAt || raw.updatedAt || raw.createdAt,
          aiMessages:        raw.aiFollowUpCount,
          aiFollowUpEnabled: raw.aiFollowUpEnabled ?? false,
          gdprConsentGiven:  raw.gdprConsentGiven ?? false,
          treatment:         raw.treatmentInterest || null,
          notes:             raw.notes ?? null,
          treatmentValue:    raw.treatmentValue || null,
          leadScore:         raw.leadScore ?? null,
          scoreLabel:        raw.scoreLabel ?? null,
          scoreTags:         raw.scoreTags ?? [],
          scoreReasoning:    raw.scoreReasoning ?? null,
          assignedTo:        raw.assignedTo ?? null,
          createdAt:         raw.createdAt,
        };
        onUpdated?.(updated);
        handleClose();
      } else {
        // ── Add mode: POST / ─────────────────────────────────────────────────
        const res = await api.post<{ lead: ApiLead }>('/api/leads', {
          firstName:         form.firstName.trim(),
          lastName:          form.lastName.trim() || undefined,
          phone:             form.phone.trim(),
          email:             form.email.trim() || undefined,
          language:          form.language,
          treatmentInterest: form.treatmentInterest.trim() || undefined,
          notes:             form.notes.trim() || undefined,
          aiFollowUpEnabled: form.aiFollowUpEnabled,
          gdprConsentGiven:  form.gdprConsentGiven,
        });
        onCreated(res.data.lead);
        handleClose();
      }
    } catch (err: unknown) {
      const status = (err as any)?.response?.status;
      const msg    = (err as any)?.response?.data?.error;
      if (status === 409) {
        setError('A lead with this phone number already exists for this clinic.');
      } else if (status === 404) {
        setError('Lead not found.');
      } else if ((status === 400 || status === 422) && msg) {
        setError(msg);
      } else {
        setError(isEditMode ? 'Failed to update lead. Please try again.' : 'Failed to create lead. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleClose() {
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-navy-800 border border-navy-600 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="px-6 py-5 border-b border-navy-600 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">
              {isEditMode ? 'Edit Lead' : 'Add New Lead'}
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {isEditMode ? 'Update lead information' : 'Manually create a patient lead'}
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* First name + Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>First name <span className="text-red-400">*</span></label>
              <input
                className={INPUT}
                placeholder="e.g. Sarah"
                value={form.firstName}
                onChange={set('firstName')}
              />
            </div>
            <div>
              <label className={LABEL}>Last name</label>
              <input
                className={INPUT}
                placeholder="e.g. Johnson"
                value={form.lastName}
                onChange={set('lastName')}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className={LABEL}>Phone <span className="text-red-400">*</span></label>
            <input
              className={INPUT}
              placeholder="+44 7700 900000"
              value={form.phone}
              onChange={set('phone')}
            />
          </div>

          {/* Email */}
          <div>
            <label className={LABEL}>Email</label>
            <input
              className={INPUT}
              type="email"
              placeholder="sarah@example.com"
              value={form.email}
              onChange={set('email')}
            />
          </div>

          {/* Language */}
          <div>
            <label className={LABEL}>Language</label>
            <select className={SELECT} value={form.language} onChange={set('language')}>
              {LANGUAGE_OPTIONS.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Treatment interest */}
          <div>
            <label className={LABEL}>Treatment interest</label>
            <input
              className={INPUT}
              placeholder="e.g. Invisalign, implants, whitening…"
              value={form.treatmentInterest}
              onChange={set('treatmentInterest')}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={LABEL}>Notes</label>
            <textarea
              className={TEXTAREA}
              rows={3}
              placeholder="Any context about this lead…"
              value={form.notes}
              onChange={set('notes')}
            />
          </div>

          {/* AI follow-up toggle */}
          <div className="bg-navy-700 border border-navy-500 rounded-xl p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.aiFollowUpEnabled}
                onChange={setCheck('aiFollowUpEnabled')}
                className="mt-0.5 accent-gold w-4 h-4 shrink-0"
              />
              <div>
                <p className="text-sm text-white font-medium">Enable AI follow-up</p>
                <p className="text-xs text-gray-500 mt-0.5">AI will send WhatsApp messages to this lead automatically</p>
              </div>
            </label>

            {/* GDPR — shown only when AI is enabled */}
            {form.aiFollowUpEnabled && (
              <label className="flex items-start gap-3 cursor-pointer pl-7">
                <input
                  type="checkbox"
                  checked={form.gdprConsentGiven}
                  onChange={setCheck('gdprConsentGiven')}
                  className="mt-0.5 accent-gold w-4 h-4 shrink-0"
                />
                <div>
                  <p className="text-sm text-white font-medium">
                    GDPR consent given <span className="text-red-400">*</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Patient has verbally consented to receiving AI messages</p>
                </div>
              </label>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-xs px-4 py-3 rounded-lg">
              ⚠ {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-navy-500 text-gray-300 text-sm font-medium hover:bg-navy-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gold hover:bg-gold-light text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading && (
                <span className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
              )}
              {isLoading
                ? (isEditMode ? 'Saving…' : 'Adding…')
                : (isEditMode ? 'Save Changes' : 'Add Lead')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

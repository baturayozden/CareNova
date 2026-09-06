import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import { adminPlatformUsers, adminClinicUsers, CLINIC_ROLE_LABELS } from '../../data/adminDemoData';
import { useImpersonation } from '../ImpersonationContext';

export default function UsersPage() {
  const { t } = useTranslation('admin');
  const [tab, setTab] = useState<'platform' | 'clinic'>('platform');
  const { session, start } = useImpersonation();
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  return (
    <div className="space-y-4">
      <AppMeta title={`${t('users.title')} | CareNova Platform`} />
      <div>
        <h1 className="text-xl font-semibold text-ink">{t('users.title')}</h1>
        <p className="text-ink-muted text-sm mt-0.5">{t('users.subtitle')}</p>
      </div>

      <div className="flex gap-1 border-b border-line">
        {(['platform', 'clinic'] as const).map(tabKey => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === tabKey ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            {tabKey === 'platform' ? t('users.tabPlatform') : t('users.tabClinic')}
          </button>
        ))}
      </div>

      {tab === 'platform' ? (
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('users.columnsPlatform.name')}</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('users.columnsPlatform.email')}</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('users.columnsPlatform.role')}</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('users.columnsPlatform.lastLogin')}</th>
              </tr>
            </thead>
            <tbody>
              {adminPlatformUsers.map(u => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{u.name}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{u.email}</td>
                  <td className="px-4 py-2.5 text-ink-muted capitalize">{u.role.replace('_', ' ')}</td>
                  <td className="px-4 py-2.5 text-ink-subtle text-xs">{new Date(u.lastLoginAt).toLocaleString('tr-TR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('users.columnsClinic.name')}</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('users.columnsClinic.clinic')}</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('users.columnsClinic.role')}</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle">{t('users.columnsClinic.lastLogin')}</th>
                <th scope="col" className="px-4 py-2.5 font-medium text-ink-subtle"></th>
              </tr>
            </thead>
            <tbody>
              {adminClinicUsers.map((u, i) => (
                <tr key={u.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-ink">{u.name}</p>
                    <p className="text-ink-subtle text-xs">{u.email}</p>
                  </td>
                  <td className="px-4 py-2.5"><Link to={`/admin/clinics/${u.clinicId}`} className="text-ink-muted hover:text-accent transition-colors">{u.clinicName}</Link></td>
                  <td className="px-4 py-2.5 text-ink-muted">{CLINIC_ROLE_LABELS[u.role]}</td>
                  <td className="px-4 py-2.5 text-ink-subtle text-xs">{new Date(u.lastLoginAt).toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-2.5">
                    {session?.clinicId === u.clinicId ? (
                      <span className="text-xs text-warning font-medium">{t('users.viewing')}</span>
                    ) : reasonFor === u.clinicId ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder={t('users.reasonPlaceholder')}
                          className="w-40 rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink focus:outline-none focus:border-accent"
                        />
                        <button
                          disabled={!reason.trim()}
                          onClick={() => { start(u.clinicId, reason); setReasonFor(null); setReason(''); }}
                          className="rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
                        >
                          {t('users.start')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReasonFor(u.clinicId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-surface-sunken transition-colors"
                      >
                        <Eye size={12} strokeWidth={1.75} aria-hidden="true" /> {t('users.view')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

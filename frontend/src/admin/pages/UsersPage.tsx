import React, { useState } from 'react';
import DemoName from '../../components/DemoName';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import AppMeta from '../../components/AppMeta';
import { useImpersonation } from '../ImpersonationContext';
import { usePlatformQuery } from '../lib/usePlatformQuery';
import { useAdminFormat } from '../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../components/QueryState';
import type { AdminClinicUser, DemoSplit, PlatformUser } from '../types';

const th = 'px-4 py-2.5 font-medium text-ink-subtle';

function PlatformUsersTab() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const query = usePlatformQuery<{ users: PlatformUser[] }>('/api/admin/platform-users');
  if (query.loading) return <LoadingState />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={query.reload} />;
  if (query.data.users.length === 0) return <EmptyState title={t('users.emptyPlatform')} />;
  return (
    <div className="rounded-xl border border-line bg-surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th scope="col" className={th}>{t('users.columnsPlatform.name')}</th>
            <th scope="col" className={th}>{t('users.columnsPlatform.email')}</th>
            <th scope="col" className={th}>{t('users.columnsPlatform.role')}</th>
            <th scope="col" className={th}>{t('users.columnsPlatform.lastLogin')}</th>
          </tr>
        </thead>
        <tbody>
          {/* Platform users are real accounts — never demo-marked. */}
          {query.data.users.map(u => (
            <tr key={u.id} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5 font-medium text-ink">{`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '—'}</td>
              <td className="px-4 py-2.5 text-ink-muted">{u.email}</td>
              <td className="px-4 py-2.5 text-ink-muted">{fmt.role(u.role)}</td>
              <td className="px-4 py-2.5 text-ink-subtle text-xs">{fmt.dateTime(u.lastLoginAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClinicUsersTab() {
  const fmt = useAdminFormat();
  const { t } = fmt;
  const query = usePlatformQuery<{ counts: DemoSplit; users: AdminClinicUser[] }>('/api/admin/platform/users');
  const { session, start } = useImpersonation();
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (query.loading) return <LoadingState />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={query.reload} />;
  const { users, counts } = query.data;
  if (users.length === 0) return <EmptyState title={t('users.emptyClinic')} body={t('clinics.emptyBody')} />;

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-muted">{t('users.clinicCount', { count: counts.total })} · {t('overview.split', { demo: counts.demo, real: counts.real })}</p>
      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className={th}>{t('users.columnsClinic.name')}</th>
              <th scope="col" className={th}>{t('users.columnsClinic.clinic')}</th>
              <th scope="col" className={th}>{t('users.columnsClinic.role')}</th>
              <th scope="col" className={th}>{t('users.columnsClinic.lastLogin')}</th>
              <th scope="col" className={th}><span className="sr-only">{t('users.view')}</span></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? 'bg-surface-page/40' : ''}`}>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-ink"><DemoName when={u.isDemo}>{u.name}</DemoName></p>
                  <p className="text-ink-subtle text-xs">{u.email}</p>
                </td>
                <td className="px-4 py-2.5"><Link to={`/admin/clinics/${u.clinicId}`} className="text-ink-muted hover:text-accent transition-colors"><DemoName when={u.isDemo}>{u.clinicName}</DemoName></Link></td>
                <td className="px-4 py-2.5 text-ink-muted">{fmt.role(u.role)}</td>
                <td className="px-4 py-2.5 text-ink-subtle text-xs">{fmt.dateTime(u.lastLoginAt)}</td>
                <td className="px-4 py-2.5">
                  {session?.clinicId === u.clinicId ? (
                    <span className="text-xs text-warning font-medium">{t('users.viewing')}</span>
                  ) : reasonFor === u.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t('users.reasonPlaceholder')}
                        aria-label={t('users.reasonPlaceholder')}
                        className="w-40 rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink focus:outline-none focus:border-accent"
                      />
                      <button
                        disabled={!reason.trim()}
                        onClick={() => { start(u.clinicId, u.clinicName, reason); setReasonFor(null); setReason(''); }}
                        className="rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
                      >
                        {t('users.start')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReasonFor(u.id)}
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
    </div>
  );
}

export default function UsersPage() {
  const { t } = useAdminFormat();
  const [tab, setTab] = useState<'platform' | 'clinic'>('platform');

  return (
    <div className="space-y-4">
      <AppMeta title={`${t('users.title')} | CareNova Platform`} />
      <div>
        <h1 className="text-xl font-semibold text-ink">{t('users.title')}</h1>
        <p className="text-ink-muted text-sm mt-0.5">{t('users.subtitle')}</p>
      </div>

      <div className="flex gap-1 border-b border-line" role="tablist">
        {(['platform', 'clinic'] as const).map(tabKey => (
          <button
            key={tabKey}
            role="tab"
            aria-selected={tab === tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === tabKey ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            {tabKey === 'platform' ? t('users.tabPlatform') : t('users.tabClinic')}
          </button>
        ))}
      </div>

      {tab === 'platform' ? <PlatformUsersTab /> : <ClinicUsersTab />}
    </div>
  );
}

import React, { useState } from 'react';
import StatsCards from './StatsCards';
import LeadsTable from './LeadsTable';
import ActivityFeed from './ActivityFeed';
import { useDashboard } from '../hooks/useDashboard';
import { Lead } from '../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import MyCommissionCard from './MyCommissionCard';
import OnboardingWizard from './OnboardingWizard';
import { Flame, Thermometer, Snowflake, Ghost, Target } from 'lucide-react';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

const SCORE_STYLES: Record<string, { badge: string; icon: IconComponent }> = {
  'Hot':        { badge: 'bg-red-900/50 text-red-300 border-red-700/60',         icon: Flame       },
  'Warm':       { badge: 'bg-yellow-900/50 text-yellow-300 border-yellow-700/60', icon: Thermometer },
  'Cool':       { badge: 'bg-blue-900/50 text-blue-300 border-blue-700/60',       icon: Snowflake   },
  'Ghost Risk': { badge: 'bg-gray-800 text-gray-500 border-gray-600',             icon: Ghost       },
};

function HotLeadsCard({ leads }: { leads: Lead[] }) {
  const navigate  = useNavigate();
  const hotLeads  = leads
    .filter(l => l.leadScore !== null && l.leadScore >= 75)
    .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0))
    .slice(0, 5);

  return (
    <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-sunken flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-red-300" />
          <h3 className="text-white font-semibold text-sm">Hot Leads</h3>
          {hotLeads.length > 0 && (
            <span className="bg-red-900/50 text-red-300 border border-red-700/60 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {hotLeads.length}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/leads')}
          className="text-xs text-accent hover:text-accent-hover transition-colors"
        >
          View all →
        </button>
      </div>

      {hotLeads.length === 0 ? (
        <div className="px-5 py-8 text-center text-gray-500 text-sm">
          No hot leads yet.<br />
          <span className="text-xs text-gray-600">Score 75+ required</span>
        </div>
      ) : (
        <div className="divide-y divide-surface-sunken">
          {hotLeads.map(lead => {
            const style = lead.scoreLabel ? (SCORE_STYLES[lead.scoreLabel] ?? SCORE_STYLES['Cool']) : SCORE_STYLES['Cool'];
            return (
              <div
                key={lead.id}
                onClick={() => navigate(`/leads?lead=${lead.id}`)}
                className="px-5 py-3 flex items-center gap-3 hover:bg-surface-sunken cursor-pointer transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-surface-sunken flex items-center justify-center text-accent text-xs font-bold shrink-0">
                  {lead.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{lead.name}</p>
                  {lead.scoreReasoning && (
                    <p className="text-gray-500 text-xs truncate">{lead.scoreReasoning}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${style.badge}`}>
                    {(() => { const Icon = style.icon; return <Icon size={12} />; })()} {lead.leadScore}
                  </span>
                  {lead.treatment && (
                    <p className="text-gray-500 text-[10px] mt-0.5 truncate max-w-[80px]">{lead.treatment}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type ScoreAllState = 'idle' | 'running' | 'done' | 'error';

export default function Dashboard() {
  const { leads, stats, activity, isLoading, error, lastUpdated, refresh } = useDashboard();
  const { user } = useAuth();
  const navigate        = useNavigate();
  const isPlatformAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const isTC            = user?.role === 'treatment_coordinator';

  const [scoreState,  setScoreState]  = useState<ScoreAllState>('idle');
  const [, setScoreTotal]  = useState<number | null>(null);
  const [scoreMsg,    setScoreMsg]    = useState('');

  async function handleScoreAll() {
    if (scoreState === 'running') return;
    setScoreState('running');
    setScoreMsg('');
    try {
      const res = await api.post<{ started: boolean; total: number }>('/api/leads/score-all');
      const total = res.data.total;
      setScoreTotal(total);
      setScoreMsg(`Scoring ${total} lead${total !== 1 ? 's' : ''} in the background…`);
      setScoreState('done');
      // Refresh leads after a delay to show updated scores
      setTimeout(() => { refresh(); setScoreState('idle'); setScoreMsg(''); }, 8000);
    } catch (err: any) {
      setScoreState('error');
      setScoreMsg(err?.response?.data?.error || 'Failed to start scoring.');
      setTimeout(() => { setScoreState('idle'); setScoreMsg(''); }, 4000);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl text-white">Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">
              Welcome back — here's what's happening today
            </p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            {lastUpdated && (
              <span className="text-xs text-gray-600">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}

            {/* Score All Leads — platform admin only */}
            {isPlatformAdmin && (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={handleScoreAll}
                  disabled={scoreState === 'running'}
                  className={`flex items-center gap-2 text-xs px-3 py-1 border rounded-lg transition-colors ${
                    scoreState === 'running'
                      ? 'border-accent/40 text-accent/40 cursor-not-allowed'
                      : scoreState === 'done'
                      ? 'border-green-700 text-green-400 hover:text-green-300'
                      : scoreState === 'error'
                      ? 'border-red-700 text-red-400'
                      : 'border-line text-accent hover:text-accent-hover hover:border-accent/40'
                  }`}
                >
                  {scoreState === 'running' && (
                    <span className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />
                  )}
                  {scoreState === 'done'    ? '✓ Scoring started' :
                   scoreState === 'error'   ? '✕ Failed' :
                   scoreState === 'running' ? 'Scoring…' :
                   <><Target size={12} /> Score All Leads</>}
                </button>
                {scoreMsg && (
                  <span className={`text-[10px] ${scoreState === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
                    {scoreMsg}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={refresh}
              className="text-xs text-accent hover:text-accent-hover transition-colors px-3 py-1 border border-line rounded-lg"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
            ⚠ {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-500 text-sm">Loading dashboard…</p>
            </div>
          </div>
        ) : (
          <>
            <StatsCards stats={stats} hideClinicMetrics={isTC} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <LeadsTable leads={leads} onRowClick={(id) => navigate(`/leads?lead=${id}`)} />
              </div>
              <div className="lg:col-span-1 space-y-6">
                {user?.role === 'treatment_coordinator' && <MyCommissionCard />}
                <HotLeadsCard leads={leads} />
                <ActivityFeed events={activity} />
              </div>
            </div>
          </>
        )}
      </div>
      <OnboardingWizard />
    </div>
  );
}

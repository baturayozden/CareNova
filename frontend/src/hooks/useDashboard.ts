import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import {
  Lead,
  ActivityEvent,
  DashboardStats,
  ApiLead,
  ApiActivity,
  PaginatedLeadsResponse,
} from '../types';

const POLL_INTERVAL_MS = 30_000;

interface DashboardData {
  leads: Lead[];
  stats: DashboardStats;
  activity: ActivityEvent[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

function mapApiLead(l: ApiLead): Lead {
  return {
    id:                l.id,
    name:              `${l.firstName} ${l.lastName}`.trim() || l.phone,
    phone:             l.phone,
    email:             l.email ?? null,
    clinic:            l.tenantName || 'CareNova',
    source:            l.source || 'manual',
    status:            l.status,
    language:          (l.language || 'en') as Lead['language'],
    lastContact:       l.lastAiMessageAt || l.updatedAt || l.createdAt,
    aiMessages:        l.aiFollowUpCount,
    aiFollowUpEnabled: l.aiFollowUpEnabled ?? false,
    gdprConsentGiven:  l.gdprConsentGiven ?? false,
    treatment:         l.treatmentInterest || null,
    notes:             l.notes ?? null,
    treatmentValue:    l.treatmentValue || null,
    leadScore:         l.leadScore ?? null,
    scoreLabel:        l.scoreLabel ?? null,
    scoreTags:         l.scoreTags ?? [],
    scoreReasoning:    l.scoreReasoning ?? null,
    assignedTo:        l.assignedTo ?? null,
    createdAt:         l.createdAt,
  };
}

function mapApiActivity(a: ApiActivity): ActivityEvent {
  return {
    id:        a.id,
    leadName:  a.leadName,
    type:      a.type,
    content:   a.content,
    timestamp: a.timestamp,
    clinic:    a.clinic,
  };
}

const DEFAULT_STATS: DashboardStats = {
  total: 0, booked: 0, aiMessages: 0, recoveryRate: 0,
};

export function useDashboard(): DashboardData {
  const [leads,       setLeads]       = useState<Lead[]>([]);
  const [stats,       setStats]       = useState<DashboardStats>(DEFAULT_STATS);
  const [activity,    setActivity]    = useState<ActivityEvent[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [leadsRes, statsRes, activityRes] = await Promise.all([
        api.get<PaginatedLeadsResponse>('/api/leads?page=1&limit=100'),
        api.get<DashboardStats>('/api/leads/stats'),
        api.get<{ events: ApiActivity[] }>('/api/whatsapp/activity'),
      ]);

      setLeads(leadsRes.data.leads.map(mapApiLead));
      setStats(statsRes.data);
      setActivity(activityRes.data.events.map(mapApiActivity));
      setError(null);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return { leads, stats, activity, isLoading, error, lastUpdated, refresh: fetchAll };
}

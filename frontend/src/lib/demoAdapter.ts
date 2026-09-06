import type { AxiosAdapter, AxiosResponse } from 'axios';
import {
  DEMO_USER, DEMO_SUPER_ADMIN, DEMO_TENANT_ID, DEMO_TENANT_NAME,
  demoLeads, demoMessages, demoConversations, demoActivityEvents, demoStats,
} from '../data/demoData';
import { hostMode } from '../config/hosts';

// Which demo user "is logged in" on this host. On the admin host this is
// the platform super-admin — UNLESS the login form was given an email
// containing "clinic", which deliberately returns the clinic demo user
// instead so the admin-host role-rejection screen is reachable without a
// real backend (see DEMO_SUPER_ADMIN's comment in data/demoData.ts).
function currentDemoUser(loginEmail?: string) {
  if (hostMode === 'admin') {
    return loginEmail?.toLowerCase().includes('clinic') ? DEMO_USER : DEMO_SUPER_ADMIN;
  }
  return DEMO_USER;
}

// REACT_APP_DEMO_MODE adapter — intercepts every request Axios would otherwise
// send over the network and returns realistic seed data instead, with a
// simulated 200-400ms delay (brief: "gecikme simülasyonu ile, 200-400ms").
// Only the flows a demo visitor actually walks through are covered (login,
// dashboard, leads list/detail, activity feed); anything unmatched falls back
// to an empty-but-well-shaped response so pages render instead of crashing.

function delay(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 200));
}

function ok<T>(data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: 'OK', headers: {}, config: {} as never };
}

function paramsFrom(url: string): URLSearchParams {
  const q = url.split('?')[1] || '';
  return new URLSearchParams(q);
}

function pathOnly(url: string): string {
  return url.split('?')[0];
}

const demoAdapter: AxiosAdapter = async (config) => {
  await delay();

  const method = (config.method || 'get').toLowerCase();
  const url = pathOnly(config.url || '');
  const params = paramsFrom(config.url || '');
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});

  // ── Auth ───────────────────────────────────────────────────────────────
  if (url === '/auth/login' && method === 'post') {
    const user = currentDemoUser(body.email);
    // /auth/me has no email to go on (page-reload session rehydration, not
    // a fresh login) — remember which demo user this was so a reload on
    // the admin host doesn't silently flip a "clinic" test login back to
    // the default super-admin.
    try { window.localStorage.setItem('carenova_demo_user_id', user.id); } catch { /* ignore */ }
    return ok({
      user,
      accessToken: 'demo-access-token',
      refreshToken: 'demo-refresh-token',
    }) as AxiosResponse;
  }
  if (url === '/auth/me' && method === 'get') {
    let storedId: string | null = null;
    try { storedId = window.localStorage.getItem('carenova_demo_user_id'); } catch { /* ignore */ }
    const user = storedId === DEMO_USER.id ? DEMO_USER
      : storedId === DEMO_SUPER_ADMIN.id ? DEMO_SUPER_ADMIN
      : currentDemoUser();
    return ok({ user }) as AxiosResponse;
  }
  if (url === '/auth/my-tenants' && method === 'get') {
    return ok({ tenants: [{ tenantId: DEMO_TENANT_ID, tenantName: DEMO_TENANT_NAME, role: DEMO_USER.role }] }) as AxiosResponse;
  }
  if (url === '/auth/refresh' && method === 'post') {
    return ok({ accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' }) as AxiosResponse;
  }
  if (url === '/auth/logout' && method === 'post') {
    return ok({ success: true }) as AxiosResponse;
  }

  // ── Leads ──────────────────────────────────────────────────────────────
  const leadDetailMatch = url.match(/^\/api\/leads\/([^/]+)$/);
  const leadMessagesMatch = url.match(/^\/api\/leads\/([^/]+)\/messages$/);
  const leadCasesMatch = url.match(/^\/api\/leads\/([^/]+)\/cases$/);

  if (url === '/api/leads' && method === 'get') {
    const limit = parseInt(params.get('limit') || '20', 10);
    const page = parseInt(params.get('page') || '1', 10);
    return ok({
      leads: demoLeads.slice((page - 1) * limit, page * limit),
      total: demoLeads.length, page, limit, totalPages: Math.max(1, Math.ceil(demoLeads.length / limit)),
    }) as AxiosResponse;
  }
  if (url === '/api/leads/stats' && method === 'get') {
    return ok(demoStats) as AxiosResponse;
  }
  if (url === '/api/leads/score-all' && method === 'post') {
    return ok({ started: true, total: demoLeads.length }) as AxiosResponse;
  }
  if (leadMessagesMatch && method === 'get') {
    return ok({ messages: demoMessages[leadMessagesMatch[1]] || [] }) as AxiosResponse;
  }
  if (leadCasesMatch && method === 'get') {
    return ok({ cases: [] }) as AxiosResponse;
  }
  if (leadDetailMatch && method === 'get') {
    const lead = demoLeads.find(l => l.id === leadDetailMatch[1]);
    if (lead) return ok({ lead }) as AxiosResponse;
    return { data: { error: 'Not found' }, status: 404, statusText: 'Not Found', headers: {}, config: {} as never } as AxiosResponse;
  }

  // ── Activity / AI ──────────────────────────────────────────────────────
  if (url === '/api/activity' && method === 'get') {
    return ok({ conversations: demoConversations, total: demoConversations.length, pages: 1 }) as AxiosResponse;
  }
  if (url === '/api/activity/summary' && method === 'get') {
    return ok({
      todayMessages: demoActivityEvents.length, replyRate: 74, conversionRate: 31,
      pendingActions: demoConversations.filter(c => c.actionRequired).length, todayLeadsContacted: demoLeads.length,
    }) as AxiosResponse;
  }
  if (url === '/api/activity/weekly-report' && method === 'get') {
    const week = { leadsRecovered: 3, pipelineValue: 8500, bookingsMade: 2, avgResponseSecs: 4, topScenario: 'new_enquiry' };
    return ok({ current: week, previous: { ...week, leadsRecovered: 2, bookingsMade: 1 } }) as AxiosResponse;
  }
  if (url === '/api/whatsapp/activity' && method === 'get') {
    return ok({ events: demoActivityEvents }) as AxiosResponse;
  }
  if (url === '/api/insights/global' && method === 'get') {
    return ok({
      topObjections: [], scenarioPerformance: [], sentimentTrend: [],
      clinicActivity: [{ clinicId: DEMO_TENANT_ID, clinicName: DEMO_TENANT_NAME, leads: demoLeads.length, aiMessages: demoStats.aiMessages, bookings: demoStats.booked || 0, conversionRate: demoStats.recoveryRate || 0 }],
      languageDistribution: [], funnel: [],
    }) as AxiosResponse;
  }

  // ── Patients ───────────────────────────────────────────────────────────
  if (url === '/api/patients' && method === 'get') {
    const limit = parseInt(params.get('limit') || '20', 10);
    const patients = demoLeads.map(l => ({
      id: l.id, firstName: l.firstName, lastName: l.lastName, phone: l.phone, email: l.email,
      status: l.status, language: l.language, treatmentInterest: l.treatmentInterest,
      assignedTo: l.assignedTo, staffName: l.assignedTo, dealCount: 1,
      totalAgreed: l.treatmentValue || 0,
      contractSigned: l.status === 'booked' || l.status === 'attended',
      paymentArranged: l.status === 'booked' || l.status === 'attended',
      treatmentDateSet: l.status === 'attended',
      createdAt: l.createdAt,
    }));
    return ok({ patients, total: patients.length, page: 1, totalPages: Math.max(1, Math.ceil(patients.length / limit)) }) as AxiosResponse;
  }

  // ── Clinics / notifications — safe defaults ──────────────────────────────
  if (/^\/api\/clinics\/[^/]+\/sales-users$/.test(url) && method === 'get') {
    return ok({ salesUsers: demoLeads.filter(l => l.assignedTo).map((l, i) => ({ id: `staff-${i}`, firstName: (l.assignedTo || '').split(' ')[0], lastName: (l.assignedTo || '').split(' ').slice(1).join(' '), email: '' })) }) as AxiosResponse;
  }
  if (url === '/api/clinics' && method === 'get') {
    return ok({ clinics: [{ id: DEMO_TENANT_ID, name: DEMO_TENANT_NAME }] }) as AxiosResponse;
  }
  if (url === '/api/notifications' && method === 'get') {
    return ok({ notifications: [], unreadCount: 0 }) as AxiosResponse;
  }

  // ── Fallback — never hit the network, never crash a page ────────────────
  if (method === 'get') {
    return ok({}) as AxiosResponse;
  }
  return ok({ success: true, ...body }) as AxiosResponse;
};

export default demoAdapter;

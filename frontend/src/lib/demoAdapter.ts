import type { AxiosAdapter, AxiosResponse } from 'axios';
import {
  DEMO_USER, DEMO_SUPER_ADMIN, DEMO_TENANT_ID, DEMO_TENANT_NAME,
  demoLeads, demoMessages, demoConversations, demoActivityEvents, demoStats,
} from '../data/demoData';
import {
  demoCommissionDeals, demoCommissionRecords, demoCommissionPeriod, demoSalesStaff,
} from '../data/commissionDemoData';
import { cases as demoCases } from '../data/caseData';
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
  // APP-ADMIN-EKSIKLER-KOMUTU.md Görev 6.3 — this used to derive from the
  // older, 4-record `demoLeads` (pre-Case-File-model), while /cases shows
  // 18 records from `cases` — two different sources for what's supposed to
  // be the same patient population. Now derived from the SAME `cases` data
  // /cases uses; a patient row's id IS its case id, so PatientsListPage
  // deep-links straight into /cases/:id (CaseFileDetailPage) — the one
  // real, up-to-date case detail view — instead of the legacy
  // /patients/:leadId profile page, which has no notion of the Case File
  // model's 15-stage status/quotes/travel/aftercare at all.
  if (url === '/api/patients' && method === 'get') {
    const limit      = parseInt(params.get('limit') || '20', 10);
    const page       = parseInt(params.get('page')  || '1', 10);
    const q          = (params.get('q') || '').trim().toLowerCase();
    const assignedTo = params.get('assignedTo') || '';
    const sort       = params.get('sort') || 'created_desc';
    const dateFrom   = params.get('dateFrom') || '';
    const dateTo     = params.get('dateTo')   || '';

    let list = demoCases.map(c => {
      const staff = demoSalesStaff.find(s => `${s.firstName} ${s.lastName}`.trim() === c.assignedConsultant);
      const latestQuote = c.quotes[c.quotes.length - 1];
      const createdAt = c.timeline[0]?.at ?? c.lastActivityAt;
      return {
        id: c.id,
        caseNumber: c.caseNumber,
        patientName: c.patientName,
        patientCountryFlag: c.patientCountryFlag,
        branch: c.branch,
        status: c.status,
        assignedTo: staff?.id ?? null,
        staffName: staff ? `${staff.firstName} ${staff.lastName}`.trim() : null,
        totalAgreed: latestQuote?.amountEur ?? 0,
        createdAt,
      };
    });

    if (q) {
      list = list.filter(p => p.patientName.toLowerCase().includes(q) || p.caseNumber.toLowerCase().includes(q));
    }
    if (assignedTo) list = list.filter(p => p.assignedTo === assignedTo);
    if (dateFrom) list = list.filter(p => p.createdAt >= dateFrom);
    if (dateTo) list = list.filter(p => p.createdAt <= `${dateTo}T23:59:59.999Z`);

    const sorters: Record<string, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      created_desc: (a, b) => b.createdAt.localeCompare(a.createdAt),
      created_asc:  (a, b) => a.createdAt.localeCompare(b.createdAt),
      name_asc:     (a, b) => a.patientName.localeCompare(b.patientName),
      assigned_asc: (a, b) => (a.staffName || '￿').localeCompare(b.staffName || '￿'),
    };
    list = [...list].sort(sorters[sort] || sorters.created_desc);

    const total = list.length;
    const paged = list.slice((page - 1) * limit, page * limit);
    return ok({ patients: paged, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) }) as AxiosResponse;
  }

  // ── Clinics / notifications — safe defaults ──────────────────────────────
  if (/^\/api\/clinics\/[^/]+\/sales-users$/.test(url) && method === 'get') {
    // Real consultants (same 4 people /cases' DANIŞMAN column shows), not an
    // ad-hoc derivation from the older demoLeads set — this list feeds both
    // Commission's Deals tab and /patients' "Assigned to" filter.
    return ok({ salesUsers: demoSalesStaff }) as AxiosResponse;
  }
  if (url === '/api/clinics' && method === 'get') {
    return ok({ clinics: [{ id: DEMO_TENANT_ID, name: DEMO_TENANT_NAME }] }) as AxiosResponse;
  }
  if (url === '/api/notifications' && method === 'get') {
    return ok({ notifications: [], unreadCount: 0 }) as AxiosResponse;
  }

  // ── Notification preferences ──────────────────────────────────────────
  // Same bug class as /api/commissions/* (Görev 1): never mocked at all,
  // so SettingsPage.tsx's NotificationsSection did `setPrefs(res.data.
  // preferences)` against `undefined` from the generic `ok({})` fallback,
  // then crashed on `prefs.map(...)` the moment the Notifications tab was
  // opened. Found while translating that page for Görev 3.
  const DEMO_NOTIF_PREFS = [
    { eventType: 'new_lead',             channel: 'email', enabled: true  },
    { eventType: 'lead_booked',          channel: 'email', enabled: true  },
    { eventType: 'appointment_reminder', channel: 'email', enabled: true  },
    { eventType: 'urgent_escalation',    channel: 'email', enabled: true  },
    { eventType: 'no_show',              channel: 'email', enabled: false },
    { eventType: 'ai_quota_warning',     channel: 'email', enabled: true  },
  ];
  if (url === '/api/notification-preferences' && method === 'get') {
    return ok({ preferences: DEMO_NOTIF_PREFS }) as AxiosResponse;
  }
  if (url === '/api/notification-preferences' && method === 'put') {
    return ok({ preferences: body.preferences ?? DEMO_NOTIF_PREFS }) as AxiosResponse;
  }

  // ── Commission ─────────────────────────────────────────────────────────
  // APP-ADMIN-EKSIKLER-KOMUTU.md Görev 1 — CommissionPage.tsx crashed the
  // entire app shell because these endpoints were never mocked at all
  // (fell through to the generic `ok({})` fallback below), and the page
  // does an unguarded `res.data.periods[0]` the moment it loads. Real
  // handlers here fix that at the root: a genuinely absent `periods` array
  // is a demo-mode-only failure mode, not something the real backend does.
  const commissionReportMatch = url.match(/^\/api\/commissions\/periods\/([^/]+)\/report$/);
  if (url === '/api/commissions/periods' && method === 'get') {
    return ok({ periods: [demoCommissionPeriod] }) as AxiosResponse;
  }
  if (commissionReportMatch && method === 'get') {
    if (commissionReportMatch[1] !== demoCommissionPeriod.id) {
      return { data: { error: 'Not found' }, status: 404, statusText: 'Not Found', headers: {}, config: {} as never } as AxiosResponse;
    }
    return ok({ period: demoCommissionPeriod, records: demoCommissionRecords }) as AxiosResponse;
  }
  if (url === '/api/commissions/deals' && method === 'get') {
    return ok({ deals: demoCommissionDeals }) as AxiosResponse;
  }
  if (url === '/api/commissions/schemes' && method === 'get') {
    return ok({ schemes: [] }) as AxiosResponse;
  }

  // ── Fallback — never hit the network, never crash a page ────────────────
  if (method === 'get') {
    return ok({}) as AxiosResponse;
  }
  return ok({ success: true, ...body }) as AxiosResponse;
};

export default demoAdapter;

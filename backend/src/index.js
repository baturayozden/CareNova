require('dotenv').config({ override: true });
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { pool } = require('./db/index');

const app = express();

// Static origins for app/admin/landing — checked first (no DB hit).
const staticOrigins = [
  process.env.APP_URL,
  process.env.ADMIN_URL,
  process.env.LANDING_URL,
  'https://carenova.ai',
  'https://www.carenova.ai',
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean);

// Global CORS — covers all routes including /api/widget/*.
// Origin callback: static list first, then DB widget_allowed_origins fallback.
// credentials: true stays — required for SSO cookie chain (app/admin/landing).
// Widget routes add their own cors middleware (credentials: false) to override
// that header on non-preflight responses; preflights are handled here and are harmless.
app.use(cors({
  origin: async (origin, callback) => {
    if (!origin) return callback(null, true); // server-to-server / curl / same-origin
    if (staticOrigins.includes(origin)) return callback(null, true);
    try {
      const { rows } = await pool.query(
        `SELECT 1 FROM tenants
          WHERE $1 = ANY(widget_allowed_origins) AND deleted_at IS NULL LIMIT 1`,
        [origin],
      );
      callback(null, rows.length > 0);
    } catch {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(cookieParser());

// GECE-3-BRIEFI.md Bölüm F: impersonation sessions may never write, only
// read — enforced globally (harmless no-op for every request that doesn't
// carry the header, including all the public webhooks below).
const { blockWritesDuringImpersonation } = require('./middleware/auth');
app.use(blockWritesDuringImpersonation);

// Public routes
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'carenova-backend' }));
app.use('/auth', require('./routes/auth'));

// Webhook (public — Meta sends unauthenticated requests)
app.use('/webhook/whatsapp', require('./routes/whatsapp'));

// Demo requests — POST is public; GET/PATCH require auth (handled inside the router)
app.use('/api/demo', require('./routes/demo'));

// Blog — public read-only (no auth)
app.use('/api/blog', require('./routes/blog'));

// Bank details token view — public, no auth (patient-facing HTML page)
app.use('/r', require('./routes/bankView'));

// Appointment confirmation / decline — public, patient-facing HTML (token-gated)
app.use('/api/appointments', require('./routes/confirm'));

// Cron endpoints — public URL but CRON_SECRET-guarded internally
app.use('/api/cron', require('./routes/cron'));

// Square payment webhook — public (Square calls this), raw body available via req.rawBody
app.use('/webhooks/square', require('./routes/squareWebhook'));

// Stripe payment webhook — public (Stripe calls this), raw body available via req.rawBody
app.use('/webhooks/stripe', require('./routes/stripeWebhook'));

// SignWell e-signature webhook — public (SignWell calls this)
app.use('/webhooks/signwell', require('./routes/signwellWebhook'));

// Atoa payment webhook — public (Atoa calls this), raw body available via req.rawBody
app.use('/webhooks/atoa', require('./routes/atoaWebhook'));

// Website form ingest — public (server-to-server, X-Ingest-Key auth, rate limited)
app.use('/api/ingest', require('./routes/ingest'));

// Embeddable widget — public (browser, site_key + origin allowlist auth, rate limited)
app.use('/api/widget', require('./routes/widget'));

// Protected routes
const { authenticate } = require('./middleware/auth');
app.use('/api/leads',    authenticate, require('./routes/leads'));
app.use('/api/clinics',  authenticate, require('./routes/clinics'));
app.use('/api/whatsapp', authenticate, require('./routes/whatsappApi'));
app.use('/api/activity', authenticate, require('./routes/activity'));
app.use('/api/insights', authenticate, require('./routes/insights'));

// Super-admin management
app.use('/api/admin', require('./routes/admin'));

// Commission & bonus system (authenticate applied inside the router)
app.use('/api/commissions', authenticate, require('./routes/commissions'));

// Notifications
app.use('/api/notifications', require('./routes/notifications'));

// Notification preferences (per-user opt-out settings)
app.use('/api/notification-preferences', authenticate, require('./routes/notificationPreferences'));

// Google Calendar integration
// Note: /api/calendar/google/callback is public (OAuth redirect from Google).
// All other endpoints in the router enforce authenticate internally.
app.use('/api/calendar', require('./routes/calendar'));

// Treatment cases / payments (CareDental-inherited consent+payment flow —
// NOT the health-tourism Case File model below, despite the similar name)
app.use('/api/cases', authenticate, require('./routes/cases'));

// Health-tourism Case File model (GECE-2-BRIEFI.md Bölüm E). Deliberately
// /api/case-files, not /api/cases — see routes/caseFiles.js's header.
app.use('/api/case-files', authenticate, require('./routes/caseFiles'));

// Branch templates (pre-assessment questions, AI pricing authority, IVF
// donor-gamete rule, etc. — CARENOVA-STRATEJI.md Bölüm 7/M2)
app.use('/api/branch-templates', authenticate, require('./routes/branchTemplates'));

// Super Admin Console read endpoints (platform-only; requireRole inside the
// router already includes authenticate — mirrors routes/admin.js's own mount)
app.use('/api/admin/platform', require('./routes/adminPlatform'));

// Billing entities (legal entity list per tenant)
app.use('/api/billing-entities', authenticate, require('./routes/billingEntities'));

// Patients — leads with deal/case aggregates
app.use('/api/patients', authenticate, require('./routes/patients'));
app.use('/api/patients/:leadId/documents', authenticate, require('./routes/patientDocuments'));
app.use('/api/patients/:leadId/checklist-manual', authenticate, require('./routes/patientChecklist'));

// Invoices
app.use('/api/invoices', authenticate, require('./routes/invoices'));

// Onboarding wizard state
app.use('/api/onboarding', authenticate, require('./routes/onboarding'));

// Clinic sub-resources: knowledge base, AI settings, appointments, availability
// Auth is handled inside each router (mergeParams: true on parent :id)
const knowledgeRouter     = require('./routes/knowledge');
const appointmentsRouter  = require('./routes/appointments');
app.use('/api/clinics/:id', knowledgeRouter);
app.use('/api/clinics/:id', appointmentsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`CareNova backend running on port ${PORT}`));

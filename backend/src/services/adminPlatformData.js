'use strict';

// Data layer for the Super Admin Console's platform endpoints
// (routes/adminPlatform.js).
//
// Every clinic row is returned in the SAME shape the admin screens already
// render (frontend/src/admin/types.ts → AdminClinic), so wiring a screen to the
// API means swapping its data source, not rewriting it.
//
// Nothing here is a stored summary number. Usage, activity, stuck-ness, MRR and
// cost are derived at read time from the rows that actually exist — so a
// clinic with no traffic shows 0, never a placeholder — and every derivation
// that rests on a constant (package price, token price, the stuck threshold)
// returns that constant in the response, so the screen can show the working.

/** CareNova packages, monthly price when billed annually (CARENOVA-STRATEJI.md L748). */
const PLAN_PRICE_EUR = { solo: 149, klinik: 449, grup: 1190 };

/**
 * Token pricing for the model the AI pipeline calls (services/ai.js:
 * claude-sonnet-4-5). Cost is reported in USD — the currency tokens are
 * actually billed in — rather than converted through an exchange rate that
 * would be one more number we made up.
 */
const AI_PRICING = { model: 'claude-sonnet-4-5', inputUsdPerMTok: 3, outputUsdPerMTok: 15 };

/**
 * Days on one onboarding step (before "live") after which a clinic counts as
 * stuck. 7, not a rounder 14: the admin dataset the panel was designed around
 * flags a clinic 9 days into a step as stuck and one 1 day in as not — 7 is the
 * threshold that reproduces those judgements.
 */
const STUCK_AFTER_DAYS = 7;

/** Case statuses that are no longer active work. */
const CLOSED_CASE_STATUSES = ['completed', 'lost', 'medically_ineligible'];

/**
 * `?includeDemo=false` hides demo tenants — what the panel looks like for a
 * real platform on day one (empty-state screens). Default true.
 */
function parseIncludeDemo(query) {
  return !(query && (query.includeDemo === 'false' || query.includeDemo === '0'));
}

function aiCostUsd(promptTokens, completionTokens) {
  return (
    (Number(promptTokens) / 1e6) * AI_PRICING.inputUsdPerMTok
    + (Number(completionTokens) / 1e6) * AI_PRICING.outputUsdPerMTok
  );
}

const CLINIC_SQL = `
  WITH m AS (
    SELECT tenant_id,
      count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int                     AS msgs_24h,
      count(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND status = 'failed')::int AS errors_24h,
      count(*) FILTER (WHERE ai_generated AND created_at >= date_trunc('month', now()))::int      AS ai_used_month,
      COALESCE(sum(ai_prompt_tokens)     FILTER (WHERE ai_generated AND created_at >= date_trunc('month', now())), 0)::bigint AS prompt_tokens_month,
      COALESCE(sum(ai_completion_tokens) FILTER (WHERE ai_generated AND created_at >= date_trunc('month', now())), 0)::bigint AS completion_tokens_month,
      max(COALESCE(status_updated_at, created_at)) FILTER (WHERE status IS DISTINCT FROM 'failed') AS last_ok_at,
      max(created_at) AS last_msg_at
    FROM messages GROUP BY tenant_id
  ),
  u AS (
    SELECT tenant_id, count(*)::int AS user_count
    FROM users WHERE deleted_at IS NULL AND tenant_id IS NOT NULL GROUP BY tenant_id
  ),
  c AS (
    SELECT tenant_id,
      count(*) FILTER (WHERE status <> ALL($1::text[]))::int AS active_cases,
      max(updated_at) AS last_case_at
    FROM cases WHERE deleted_at IS NULL GROUP BY tenant_id
  ),
  s AS (
    SELECT DISTINCT ON (tenant_id) tenant_id, status, current_period_start, current_period_end, trial_ends_at
    FROM subscriptions ORDER BY tenant_id, created_at DESC
  ),
  w AS (
    SELECT DISTINCT ON (tenant_id) tenant_id, display_phone_number, display_name, phone_number_id, is_active
    FROM whatsapp_configs ORDER BY tenant_id, is_active DESC, created_at DESC
  )
  SELECT
    t.id, t.name, t.legal_name, t.city, t.active_branch_keys, t.plan_tier, t.status AS tenant_status,
    t.is_demo, t.email, t.phone, t.timezone, t.currency, t.ai_monthly_limit, t.ai_overage_policy,
    t.onboarding_step, t.onboarding_step_started_at, t.created_at,
    COALESCE(u.user_count, 0)   AS user_count,
    COALESCE(c.active_cases, 0) AS active_cases,
    GREATEST(m.last_msg_at, c.last_case_at, t.created_at) AS last_activity_at,
    COALESCE(m.msgs_24h, 0) AS msgs_24h, COALESCE(m.errors_24h, 0) AS errors_24h,
    COALESCE(m.ai_used_month, 0) AS ai_used_month,
    COALESCE(m.prompt_tokens_month, 0) AS prompt_tokens_month,
    COALESCE(m.completion_tokens_month, 0) AS completion_tokens_month,
    m.last_ok_at,
    s.status AS sub_status, s.current_period_start, s.current_period_end, s.trial_ends_at,
    w.display_phone_number, w.phone_number_id, w.is_active AS wa_active,
    tc.tenant_id AS tc_tenant_id, tc.license_number, tc.license_expires_at,
    tc.complication_insurance_status, tc.complication_insurance_expires_at,
    tc.foreign_language_staff_ratio, tc.verbis_status, tc.verbis_registered_at,
    tc.cross_border_contract_status, tc.cross_border_notified_at,
    tc.ek1_consents_total, tc.ek1_consents_revoked
  FROM tenants t
  LEFT JOIN m  ON m.tenant_id  = t.id
  LEFT JOIN u  ON u.tenant_id  = t.id
  LEFT JOIN c  ON c.tenant_id  = t.id
  LEFT JOIN s  ON s.tenant_id  = t.id
  LEFT JOIN w  ON w.tenant_id  = t.id
  LEFT JOIN tenant_compliance tc ON tc.tenant_id = t.id
  WHERE t.deleted_at IS NULL
    AND ($2::boolean OR t.is_demo = false)
    AND ($3::uuid IS NULL OR t.id = $3::uuid)
  ORDER BY t.is_demo, t.name
`;

/** UI status: the panel's four states from tenants.status + the subscription. */
function uiStatus(r) {
  if (r.tenant_status === 'suspended' || r.tenant_status === 'cancelled') return 'suspended';
  if (r.tenant_status === 'pending') return 'onboarding';
  if (r.sub_status === 'trialing') return 'trial';
  return 'active';
}

function iso(v) { return v ? new Date(v).toISOString() : null; }
function dateOnly(v) { return v ? new Date(v).toISOString().slice(0, 10) : null; }

function mapClinic(r) {
  const plan = r.plan_tier;
  const status = uiStatus(r);
  const paying = r.sub_status === 'active' || r.sub_status === 'past_due';

  const periodDays = r.current_period_start && r.current_period_end
    ? (new Date(r.current_period_end) - new Date(r.current_period_start)) / 86400000
    : null;

  const stepStarted = r.onboarding_step_started_at ? new Date(r.onboarding_step_started_at) : null;
  const daysOnStep = stepStarted ? (Date.now() - stepStarted.getTime()) / 86400000 : null;

  return {
    id: r.id,
    isDemo: r.is_demo === true,
    name: r.name,
    legalName: r.legal_name,
    city: r.city,
    branches: r.active_branch_keys || [],
    plan,
    status,
    userCount: r.user_count,
    activeCases: r.active_cases,
    lastActivityAt: iso(r.last_activity_at),
    createdAt: iso(r.created_at),
    mrrEur: paying ? (PLAN_PRICE_EUR[plan] ?? 0) : 0,
    contactEmail: r.email,
    contactPhone: r.phone,
    timezone: r.timezone,
    currency: r.currency,
    licenseNumber: r.license_number ?? null,
    licenseExpiry: dateOnly(r.license_expires_at),
    onboarding: {
      step: r.onboarding_step,
      stepStartedAt: iso(r.onboarding_step_started_at),
      stuck: r.onboarding_step < 7 && daysOnStep !== null && daysOnStep > STUCK_AFTER_DAYS,
    },
    whatsapp: r.phone_number_id ? {
      displayNumber: r.display_phone_number,
      phoneNumberId: r.phone_number_id,
      connected: r.wa_active === true,
      lastWebhookSuccessAt: iso(r.last_ok_at),
      messagesLast24h: r.msgs_24h,
      errorsLast24h: r.errors_24h,
    } : null,
    aiUsage: {
      monthlyQuota: r.ai_monthly_limit,
      usedThisMonth: r.ai_used_month,
      overagePolicy: r.ai_overage_policy,
      promptTokensThisMonth: Number(r.prompt_tokens_month),
      completionTokensThisMonth: Number(r.completion_tokens_month),
      costUsdThisMonth: Math.round(aiCostUsd(r.prompt_tokens_month, r.completion_tokens_month) * 100) / 100,
    },
    // Tri-state, never a boolean: 'unknown' means "not assessed", which must not
    // read as either compliant or non-compliant. No row at all -> all unknown.
    compliance: {
      assessed: r.tc_tenant_id != null,
      complicationInsurance: r.complication_insurance_status ?? 'unknown',
      complicationInsuranceExpiry: dateOnly(r.complication_insurance_expires_at),
      foreignLanguageStaffRatio: r.foreign_language_staff_ratio == null ? null : Number(r.foreign_language_staff_ratio),
      verbis: r.verbis_status ?? 'unknown',
      crossBorderContract: r.cross_border_contract_status ?? 'unknown',
      crossBorderNotifiedAt: dateOnly(r.cross_border_notified_at),
      ek1ConsentsTotal: r.ek1_consents_total,
      ek1ConsentsRevoked: r.ek1_consents_revoked,
    },
    billing: r.sub_status ? {
      periodicity: periodDays !== null && periodDays > 40 ? 'annual' : 'monthly',
      amountEur: PLAN_PRICE_EUR[plan] ?? 0,
      status: r.sub_status === 'trialing' ? 'trial'
        : (r.sub_status === 'past_due' || r.sub_status === 'unpaid') ? 'overdue'
          : 'current',
      nextChargeAt: iso(r.sub_status === 'trialing' ? r.trial_ends_at : r.current_period_end),
    } : null,
  };
}

async function loadClinics(pool, { includeDemo = true, tenantId = null } = {}) {
  const { rows } = await pool.query(CLINIC_SQL, [CLOSED_CASE_STATUSES, includeDemo, tenantId]);
  return rows.map(mapClinic);
}

/** The constants the derived figures rest on, so a screen can show its working. */
function derivationBasis() {
  return {
    planPriceEur: PLAN_PRICE_EUR,
    aiPricing: AI_PRICING,
    stuckAfterDays: STUCK_AFTER_DAYS,
    closedCaseStatuses: CLOSED_CASE_STATUSES,
  };
}

module.exports = {
  PLAN_PRICE_EUR, AI_PRICING, STUCK_AFTER_DAYS,
  parseIncludeDemo, loadClinics, mapClinic, aiCostUsd, derivationBasis,
};

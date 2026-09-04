-- Migration: 007_create_subscriptions / Created: 2026-05-17
-- Billing subscriptions linked to Stripe and a full Stripe webhook event log.
-- One active subscription per tenant at any time.

BEGIN;

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id              UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  stripe_customer_id     VARCHAR(50) UNIQUE,
  stripe_subscription_id VARCHAR(50) UNIQUE,
  stripe_price_id        VARCHAR(50),

  plan    VARCHAR(20) NOT NULL DEFAULT 'free',
  status  VARCHAR(20) NOT NULL DEFAULT 'active',

  leads_limit    INT NOT NULL DEFAULT 50,
  messages_limit INT NOT NULL DEFAULT 500,
  users_limit    INT NOT NULL DEFAULT 3,

  trial_ends_at        TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_subscriptions_status CHECK (
    status IN ('active', 'past_due', 'cancelled', 'trialing', 'unpaid')
  )
);

COMMENT ON TABLE subscriptions IS
  'Stripe subscription record per tenant. Drives feature gating and usage caps.';

COMMENT ON COLUMN subscriptions.stripe_customer_id IS
  'Stripe customer ID, e.g. cus_XXXXXXXXXX. NULL for free-plan tenants with no card.';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS
  'Stripe subscription ID, e.g. sub_XXXXXXXXXX. NULL for free-plan tenants.';
COMMENT ON COLUMN subscriptions.stripe_price_id IS
  'Stripe price ID of the active plan, e.g. price_XXXXXXXXXX.';
COMMENT ON COLUMN subscriptions.plan IS
  'Mirrors tenants.plan_tier for convenience. Keep in sync via webhook handler.';
COMMENT ON COLUMN subscriptions.status IS
  'Stripe subscription status: active, past_due, cancelled, trialing, unpaid.';
COMMENT ON COLUMN subscriptions.leads_limit IS
  'Maximum number of new leads that can be created in the current billing period.';
COMMENT ON COLUMN subscriptions.messages_limit IS
  'Maximum number of AI-generated messages allowed in the current billing period.';
COMMENT ON COLUMN subscriptions.users_limit IS
  'Maximum number of active user seats for this tenant.';
COMMENT ON COLUMN subscriptions.trial_ends_at IS
  'End of the free-trial window. NULL for plans without a trial.';
COMMENT ON COLUMN subscriptions.cancelled_at IS
  'Timestamp when the customer initiated cancellation. Period access continues until current_period_end.';

-- ---------------------------------------------------------------------------
-- subscription_events  (Stripe webhook event log)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscription_events (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID        NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_event_id VARCHAR(100) NOT NULL UNIQUE,
  event_type      VARCHAR(100) NOT NULL,
  payload         JSONB        NOT NULL,
  processed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE subscription_events IS
  'Idempotent log of every Stripe webhook event received. '
  'stripe_event_id UNIQUE prevents double-processing of retried webhooks.';

COMMENT ON COLUMN subscription_events.stripe_event_id IS
  'Stripe event ID, e.g. evt_XXXXXXXXXX. Used for idempotency checks.';
COMMENT ON COLUMN subscription_events.event_type IS
  'Stripe event type string, e.g. invoice.paid, customer.subscription.updated.';
COMMENT ON COLUMN subscription_events.payload IS
  'Full Stripe event JSON payload stored for replay / audit purposes.';

COMMIT;

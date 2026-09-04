-- ============================================================
-- Migration 011: WhatsApp AI Upgrade
-- clinic_knowledge, clinic_ai_settings, appointments, clinic_availability
-- ============================================================

-- ── 1. Clinic Knowledge Base ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinic_knowledge (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category    TEXT        NOT NULL CHECK (category IN (
                'pricing','treatments','doctors','hours',
                'location','policies','faq','consent','custom'
              )),
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Clinic AI Settings ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinic_ai_settings (
  tenant_id              UUID        PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  tone                   TEXT        NOT NULL DEFAULT 'professional'
                           CHECK (tone IN ('professional','friendly','casual','formal')),
  language_mode          TEXT        NOT NULL DEFAULT 'auto',
  welcome_message        TEXT,
  out_of_hours_message   TEXT,
  escalation_enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
  escalation_keywords    TEXT[]      NOT NULL DEFAULT ARRAY['urgent','pain','emergency','bleeding','swelling','broken'],
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Appointments ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS appointments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id           UUID        REFERENCES leads(id) ON DELETE SET NULL,
  patient_name      TEXT        NOT NULL,
  patient_phone     TEXT        NOT NULL,
  treatment_type    TEXT,
  appointment_date  DATE        NOT NULL,
  appointment_time  TIME        NOT NULL,
  duration_minutes  INTEGER     NOT NULL DEFAULT 30,
  status            TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. Clinic Availability ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clinic_availability (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_of_week           INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time            TIME    NOT NULL DEFAULT '09:00',
  end_time              TIME    NOT NULL DEFAULT '18:00',
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, day_of_week)
);

-- ── 5. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_clinic_knowledge_tenant   ON clinic_knowledge(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clinic_knowledge_category ON clinic_knowledge(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant       ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date         ON appointments(tenant_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_phone        ON appointments(patient_phone);
CREATE INDEX IF NOT EXISTS idx_clinic_avail_tenant       ON clinic_availability(tenant_id);

-- ── 6. Seed: default availability (Mon–Fri 09:00–18:00, 30 min slots) ────────
-- Run this after inserting a new tenant, or seed existing tenants now.

INSERT INTO clinic_availability (tenant_id, day_of_week, start_time, end_time, slot_duration_minutes, is_active)
SELECT t.id, d.day, '09:00'::TIME, '18:00'::TIME, 30, TRUE
FROM   tenants t
CROSS  JOIN (VALUES (1),(2),(3),(4),(5)) AS d(day)  -- Mon=1 … Fri=5
ON CONFLICT (tenant_id, day_of_week) DO NOTHING;

-- Seed default AI settings for all existing tenants
INSERT INTO clinic_ai_settings (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Seed default knowledge entries for all existing tenants
INSERT INTO clinic_knowledge (tenant_id, category, title, content)
SELECT t.id, k.category, k.title, k.content
FROM tenants t
CROSS JOIN (VALUES
  ('faq',       'How quickly do you respond?',   'Our AI assistant responds within 30 seconds, 24/7. For complex queries, a team member follows up within 1 business hour during working hours.'),
  ('policies',  'Cancellation Policy',           'We ask for at least 24 hours notice to cancel or reschedule an appointment. Late cancellations may incur a £25 fee.'),
  ('hours',     'Opening Hours',                 'Monday–Friday: 9:00 AM – 6:00 PM. Saturday: 9:00 AM – 2:00 PM. Sunday: Closed. We offer emergency slots — please message us.')
) AS k(category, title, content)
ON CONFLICT DO NOTHING;

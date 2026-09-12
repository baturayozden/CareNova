-- Migration 066: tenant_compliance — per-clinic regulatory STATUS (one row per tenant).
--
-- compliance_events (061) is an EVENT log (blocked text, rule violations). The
-- admin Compliance panel needs the current STATE of each clinic's standing
-- obligations, which is a different shape: one row per tenant, overwritten as
-- the state changes. Every column below maps to an obligation named in
-- CARENOVA-STRATEJI.md — none is invented:
--
--   license_*                    Uluslararası Sağlık Turizmi Yetki Belgesi
--                                (2025 Sağlık Turizmi Yönetmeliği; STRATEJI L27, L275)
--   complication_insurance_*     Komplikasyon sigortası — 26 Nisan 2025 Yönetmeliği,
--                                31.12.2026'ya kadar zorunlu (STRATEJI L528, L560)
--   foreign_language_staff_ratio %20 yabancı dil yetkin personel — same regulation
--                                (STRATEJI L560). Stored as the RATIO, per brief.
--   verbis_*                     VERBİS kaydı — özel nitelikli (sağlık) veri işleyenler
--                                için büyüklük muafiyeti yok (KVKK; STRATEJI L550)
--   cross_border_*               Yurt dışı aktarım: Kurulca ilan edilen standart sözleşme
--                                + 5 iş günü içinde KVKK'ya bildirim (STRATEJI L552)
--   ek1_consents_*               Tanıtım Yönetmeliği Ek-1 standart görsel onam formu,
--                                geri alınabilir (STRATEJI L540, L546)
--
-- Two obligations from the same 2025 regulation are deliberately NOT modelled
-- yet because no screen or flow uses them: HealthTürkiye portal registration and
-- the annual performance review (STRATEJI L560). Add them when something reads them.
--
-- Tri-state statuses: 'unknown' (never assessed) is not the same as 'missing'
-- (assessed, absent). Collapsing them into a boolean would report an
-- un-audited clinic as non-compliant — or, worse, a NULL as compliant.
--
-- Ek-1 counts are NULLABLE and must only ever be written from real consent
-- records. A number with nothing behind it is a false consent claim.

BEGIN;

CREATE TABLE IF NOT EXISTS tenant_compliance (
  tenant_id                          UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

  license_number                     VARCHAR(64),
  license_expires_at                 DATE,

  complication_insurance_status      VARCHAR(16) NOT NULL DEFAULT 'unknown'
    CONSTRAINT chk_tc_insurance CHECK (complication_insurance_status IN ('unknown','missing','active','expired')),
  complication_insurance_expires_at  DATE,

  foreign_language_staff_ratio       NUMERIC(5,2)
    CONSTRAINT chk_tc_lang_ratio CHECK (foreign_language_staff_ratio BETWEEN 0 AND 100),

  verbis_status                      VARCHAR(16) NOT NULL DEFAULT 'unknown'
    CONSTRAINT chk_tc_verbis CHECK (verbis_status IN ('unknown','not_registered','registered')),
  verbis_registered_at               DATE,

  cross_border_contract_status       VARCHAR(16) NOT NULL DEFAULT 'unknown'
    CONSTRAINT chk_tc_crossborder CHECK (cross_border_contract_status IN ('unknown','missing','signed')),
  cross_border_notified_at           DATE,

  ek1_consents_total                 INTEGER CONSTRAINT chk_tc_ek1_total CHECK (ek1_consents_total >= 0),
  ek1_consents_revoked               INTEGER CONSTRAINT chk_tc_ek1_revoked CHECK (ek1_consents_revoked >= 0),

  updated_at                         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                         UUID REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE tenant_compliance IS
  'Per-clinic current state of regulatory obligations (2025 Sağlık Turizmi Yönetmeliği, KVKK, Tanıtım Yönetmeliği). One row per tenant. Events live in compliance_events.';
COMMENT ON COLUMN tenant_compliance.ek1_consents_total IS
  'Count of Ek-1 visual consents. NULL unless derived from real consent records — never a placeholder.';

COMMIT;

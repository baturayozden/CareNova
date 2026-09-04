-- Migration 056: Expand leads.language for CareNova's target markets.
-- CARENOVA-STRATEJI.md Bölüm 2.3: zorunlu ilk dil seti TR/EN/AR/DE/RU, ikinci
-- dalga FR/ES/RO/AZ/FA. Also adds Azerbaijani/Kazakh/Ukrainian/Albanian/
-- Bulgarian per the fast-growing Central Asia / Balkans source markets noted
-- in the same section.
BEGIN;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS chk_leads_language;

ALTER TABLE leads ADD CONSTRAINT chk_leads_language CHECK (
  language IN ('en','tr','ar','de','fr','es','pt','ru','zh','az','fa','ro','uk','kk','sq','bg')
);

COMMIT;

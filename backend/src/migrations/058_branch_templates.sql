-- Migration 058: Branch template engine (CARENOVA-STRATEJI.md Bölüm 7/M2).
--
-- CareNova is branch-agnostic: each clinic activates one or more branches;
-- the system loads that branch's pre-assessment questions, required media,
-- objections, and — critically — its AI PRICING AUTHORITY, which the prompt
-- compiler (KOMUT 7 / PAKET 7, not done tonight) must enforce as a hard rule.
--
-- NOT executed tonight (no reachable database — see BLOKAJLAR.md). Written
-- and reviewed for syntax only. Rollback path at the bottom.
BEGIN;

CREATE TABLE IF NOT EXISTS branch_templates (
  key                       VARCHAR(40) PRIMARY KEY,
  display_name              JSONB NOT NULL,             -- {"tr": "Saç Ekimi", "en": "Hair Transplant", "ar": "...", "de": "...", "ru": "..."}
  pre_assessment_questions  JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_media            JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{id, capture_instruction: {tr,en,ar,de,ru}}]
  ai_pricing_authority      VARCHAR(20) NOT NULL,
  doctor_approval_scope     JSONB NOT NULL DEFAULT '{}'::jsonb,
  typical_stay_days         INTEGER,
  typical_cycle_days        INTEGER,
  red_flags                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  branch_objections         JSONB NOT NULL DEFAULT '[]'::jsonb,
  aftercare_schedule        JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{day_offset, ...}]
  knowledge_seed            JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system                 BOOLEAN NOT NULL DEFAULT false,
  tenant_id                 UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = system template
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_branch_templates_authority CHECK (
    ai_pricing_authority IN ('full','range_from_photo','range_after_imaging','qualification_only','logistics_only')
  ),
  -- A system template's key is global; a clinic's custom template is scoped to it.
  CONSTRAINT chk_branch_templates_system_scope CHECK (
    (is_system = true AND tenant_id IS NULL) OR (is_system = false AND tenant_id IS NOT NULL)
  )
);

ALTER TABLE cases
  ADD CONSTRAINT fk_cases_branch_key FOREIGN KEY (branch_key) REFERENCES branch_templates(key) ON DELETE SET NULL;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS active_branch_keys TEXT[] NOT NULL DEFAULT '{}';

-- ── Seed: 3 fully-authored system templates (per AI authority matrix, Bölüm 7/M2 table) ──

INSERT INTO branch_templates (key, display_name, ai_pricing_authority, is_system, typical_stay_days, typical_cycle_days,
  pre_assessment_questions, required_media, red_flags, branch_objections, aftercare_schedule)
VALUES (
  'hair_transplant',
  '{"tr":"Saç Ekimi","en":"Hair Transplant","ar":"زراعة الشعر","de":"Haartransplantation","ru":"Пересадка волос"}',
  'range_from_photo', true, 3, 14,
  '[
    {"id":"yas","type":"number","required":true,"label":{"tr":"Yaş","en":"Age"}},
    {"id":"sac_dokulme_suresi","type":"select","options":["<1yıl","1-3yıl","3-5yıl","5yıl+"],"label":{"tr":"Saç dökülme süresi","en":"Hair loss duration"}},
    {"id":"onceki_operasyon","type":"boolean","label":{"tr":"Daha önce saç ekimi oldunuz mu?","en":"Have you had a hair transplant before?"}},
    {"id":"ilac_kullanimi","type":"text","label":{"tr":"Kullandığınız ilaçlar (finasterid/minoksidil vb.)","en":"Medications in use (finasteride/minoxidil etc.)"}},
    {"id":"kronik_hastalik","type":"text","label":{"tr":"Kronik hastalık","en":"Chronic conditions"}}
  ]'::jsonb,
  '[
    {"id":"on_gorunum","capture_instruction":{"tr":"Doğal ışıkta, saçlar kuru, alından çekilmiş","en":"Natural light, dry hair, taken from the front"}},
    {"id":"tepe","capture_instruction":{"tr":"Baş tepesi net görünecek şekilde yukarıdan","en":"From above, crown clearly visible"}},
    {"id":"donor_ense","capture_instruction":{"tr":"Ense/donör bölge, saçlar kısaltılmış görünürken ideal","en":"Nape/donor area, ideally with short hair"}},
    {"id":"yan_profil","capture_instruction":{"tr":"Sol ve sağ yan profil","en":"Left and right side profile"}}
  ]'::jsonb,
  '["aktif_alopecia_areata","yetersiz_donor","kontrolsuz_diyabet","24_yas_alti"]'::jsonb,
  '["trust_surgeon","donor_damage","graft_count_dispute"]'::jsonb,
  '[{"day_offset":1},{"day_offset":3},{"day_offset":7},{"day_offset":10,"note":"yıkama"},{"day_offset":15},{"day_offset":30},{"day_offset":90},{"day_offset":180},{"day_offset":365}]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO branch_templates (key, display_name, ai_pricing_authority, is_system, typical_stay_days, typical_cycle_days,
  red_flags, branch_objections, aftercare_schedule)
VALUES (
  'dental',
  '{"tr":"Diş","en":"Dental","ar":"طب الأسنان","de":"Zahnbehandlung","ru":"Стоматология"}',
  'range_after_imaging', true, 5, 10,
  '["kontrolsuz_diyabet","aktif_enfeksiyon","kemik_yetersizligi_dogrulanmamis"]'::jsonb,
  '["trust_surgeon","price_shock","material_brand_dispute"]'::jsonb,
  '[{"day_offset":1},{"day_offset":7},{"day_offset":30},{"day_offset":90},{"day_offset":180},{"day_offset":365}]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO branch_templates (key, display_name, ai_pricing_authority, is_system, typical_stay_days, typical_cycle_days,
  red_flags, branch_objections, aftercare_schedule)
VALUES (
  'aesthetic_surgery',
  '{"tr":"Estetik Cerrahi","en":"Aesthetic Surgery","ar":"الجراحة التجميلية","de":"Ästhetische Chirurgie","ru":"Эстетическая хирургия"}',
  'qualification_only', true, 7, 21,
  '["asa_uygunlugu_dogrulanmamis","psikiyatrik_oykü_belirtilmemis","18_yas_alti"]'::jsonb,
  '["safety_fear","trust_surgeon","aftercare_fear"]'::jsonb,
  '[{"day_offset":1},{"day_offset":3},{"day_offset":7},{"day_offset":14},{"day_offset":30},{"day_offset":90},{"day_offset":180}]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- ── Seed: skeleton templates for the remaining branches (empty content, correct authority only) ──

INSERT INTO branch_templates (key, display_name, ai_pricing_authority, is_system) VALUES
  ('eye_lasik',   '{"tr":"Göz (LASIK)","en":"Eye (LASIK)"}',       'qualification_only', true),
  ('bariatric',   '{"tr":"Bariatrik","en":"Bariatric"}',            'qualification_only', true),
  ('ivf',         '{"tr":"Tüp Bebek","en":"IVF"}',                  'qualification_only', true),
  ('orthopedics', '{"tr":"Ortopedi","en":"Orthopedics"}',           'qualification_only', true),
  ('cardiology',  '{"tr":"Kardiyoloji","en":"Cardiology"}',         'logistics_only',      true),
  ('oncology',    '{"tr":"Onkoloji","en":"Oncology"}',              'logistics_only',      true),
  ('checkup',     '{"tr":"Check-up","en":"Check-up"}',              'full',                true)
ON CONFLICT (key) DO NOTHING;

-- IVF's donor-gamete rule must be visible verbatim wherever a case escalates
-- past qualification (Bölüm 7/M2 KOMUT 6.5) — Turkey does not permit donor
-- eggs/sperm, and the AI must say so in its FIRST response, not waste time.
UPDATE branch_templates
SET knowledge_seed = jsonb_set(
  COALESCE(knowledge_seed, '{}'::jsonb), '{donor_gamete_rule}',
  '"Donor eggs and donor sperm are not legal in Turkey. If a patient indicates need for donor gametes, AI must state this clearly in the FIRST response and must not waste time before saying so."'::jsonb
)
WHERE key = 'ivf';

COMMIT;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- BEGIN;
-- ALTER TABLE cases DROP CONSTRAINT IF EXISTS fk_cases_branch_key;
-- ALTER TABLE tenants DROP COLUMN IF EXISTS active_branch_keys;
-- DROP TABLE IF EXISTS branch_templates;
-- COMMIT;

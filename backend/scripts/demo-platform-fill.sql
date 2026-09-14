-- backend/scripts/demo-platform-fill.sql
--
-- Fills the three holes that made the admin panel read as unfinished on
-- 14 September 2026:
--
--   1. All 11 platform demo clinics had 0 cases, so "Aktif vaka" was 0 in every
--      row of Klinikler and the overview's case funnel had nothing in it.
--   2. Each of those clinics had exactly ONE lead — literally named "Sentetik
--      trafik (demo)" — carrying up to 9 549 messages. Every conversation in
--      the product hung off a single bucket.
--   3. audit_logs and compliance_events were empty, so Denetim Kaydı rendered
--      its empty state and Uyum Paneli's event list was blank.
--
-- WHY IT IS SET-BASED. Everything here is derived from the tenants table at run
-- time: how many branches a clinic has, who works there, what its plan is. The
-- first draft of this file was 3 000 lines of generated INSERT literals with
-- clinic ids baked in; that version goes stale the moment a demo clinic is
-- added or a staff member changes, and nobody can read a diff of it. This one
-- is re-runnable and its correctness is visible.
--
-- Consent is NOT fabricated: gdpr_consent_given stays false on every lead —
-- the same rule an earlier seed had to be corrected for. Every row belongs to a
-- tenant with is_demo = true, so demo.roll_clock (071) keeps it current and the
-- panel's own DEMO banner marks it.
--
-- Idempotent: sections 1-5 delete their own rows first. audit_logs cannot be
-- deleted (append-only, migration 070), so section 6 only runs into an empty
-- table; from then on demo.roll_clock appends to it hourly.

BEGIN;

-- ── 0. Staff names ───────────────────────────────────────────────────────────
-- "Personel 07" is what the admin Kullanıcılar screen currently shows. Emails
-- are left untouched: they are what login matches on.
-- The two strides (7 and 11) are coprime with the two pool lengths, so names
-- cycle through a long sequence instead of repeating every few rows.

WITH pool AS (
  SELECT ARRAY['Ahmet','Ayşe','Burak','Ceren','Deniz','Ebru','Emre','Fatma','Gökhan','Hande',
               'İsmail','Jale','Kaan','Leyla','Murat','Nalan','Okan','Pelin','Rıza','Selin',
               'Tolga','Ufuk','Vildan','Yasin','Zeynep','Barış','Cansu','Doruk','Esra','Ferit',
               'Gizem','Halil','Irmak','Kerem','Lale','Mert','Neslihan','Onur','Özge','Serkan'] AS f,
         ARRAY['Yılmaz','Kaya','Demir','Şahin','Çelik','Yıldız','Yıldırım','Öztürk','Aydın','Özdemir',
               'Arslan','Doğan','Kılıç','Aslan','Çetin','Kara','Koç','Kurt','Özkan','Şimşek',
               'Polat','Korkmaz','Türk','Bulut','Erdoğan','Sarı','Ünal','Tekin','Güler','Ateş'] AS l
),
numbered AS (
  SELECT u.id, row_number() OVER (ORDER BY u.tenant_id, u.created_at, u.id) AS rn
  FROM users u
  JOIN tenants t ON t.id = u.tenant_id AND t.is_demo
  WHERE u.first_name = 'Personel' AND u.deleted_at IS NULL
)
UPDATE users u
   SET first_name = p.f[1 + ((n.rn * 7)  % array_length(p.f, 1))],
       last_name  = p.l[1 + ((n.rn * 11) % array_length(p.l, 1))]
  FROM numbered n, pool p
 WHERE u.id = n.id;

-- ── 1. Patient leads ─────────────────────────────────────────────────────────
-- Replaces the single "Sentetik trafik (demo)" bucket per clinic. Lead volume
-- is scaled to the clinic's real message volume, so a clinic with 9 549
-- messages gets more conversations than one with 30.
--
-- Names are stored as whole pairs per market, not first/last lists crossed at
-- random: Slavic and Turkic surnames are gendered, and crossing them produces
-- people called "Nurlan Yerlanova".

DELETE FROM compliance_events WHERE tenant_id IN (SELECT id FROM tenants WHERE is_demo);
DELETE FROM cases  WHERE tenant_id IN (SELECT id FROM tenants WHERE is_demo) AND case_number LIKE 'PF-%';
DELETE FROM leads  WHERE tenant_id IN (SELECT id FROM tenants WHERE is_demo) AND notes = 'platform-fill';

CREATE TEMP TABLE _markets ON COMMIT DROP AS
SELECT * FROM (VALUES
  (1, 'DE', '49',  'de', ARRAY['Michael Brandt','Jonas Weber','Lena Schneider','Klaus Richter',
                               'Anja Hoffmann','Stefan Keller','Birgit Vogel','Tobias Lang']),
  (2, 'GB', '44',  'en', ARRAY['Charlotte Bennett','Oliver Carter','Emily Hughes','Harry Ward',
                               'Sophie Palmer','James Brooks','Amelia Doyle','Daniel Shaw']),
  (3, 'SA', '966', 'ar', ARRAY['Ahmed Al-Rashid','Sara Al-Amin','Omar Haddad','Layla Khoury',
                               'Khalid Al-Sayed','Rania Nasser','Yusuf Darwish']),
  (4, 'RU', '7',   'ru', ARRAY['Irina Sokolova','Dmitri Ivanov','Olga Petrova','Sergey Volkov',
                               'Natalia Morozova','Pavel Orlov']),
  (5, 'NL', '31',  'en', ARRAY['Daan de Vries','Sanne Jansen','Bram Bakker','Femke Visser','Lars Mulder']),
  (6, 'FR', '33',  'fr', ARRAY['Sophie Girard','Julien Dubois','Camille Laurent','Thomas Moreau',
                               'Elodie Fontaine']),
  (7, 'IT', '39',  'en', ARRAY['Marco Rossi','Giulia Conti','Luca Ferrari','Chiara Greco','Matteo Marino']),
  (8, 'AZ', '994', 'az', ARRAY['Elnur Mammadov','Aysel Aliyeva','Rashad Huseynov','Nigar Guliyeva']),
  (9, 'KZ', '7',   'kk', ARRAY['Aidana Abenova','Nurlan Sultanov','Dinara Yerlanova','Timur Kairat']),
  (10,'RO', '40',  'ro', ARRAY['Andrei Popescu','Ioana Ionescu','Mihai Dumitru','Elena Stanciu']),
  (11,'TR', '90',  'tr', ARRAY['Emre Aydınoğlu','Zeynep Doğan','Burak Kılıç','Elif Arslan','Kerem Yalçın'])
) AS m(ord, country, dial, lang, names);

-- Lead and case counts per clinic, scaled to observed message volume.
CREATE TEMP TABLE _sizes ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('demo-karadeniz-estetik', 24, 14),
  ('demo-anadolu-dental',    20, 12),
  ('demo-nova-hair',         14,  9),
  ('demo-ege-estetik',       12,  7),
  ('demo-marmara-ivf',       10,  6),
  ('demo-akdeniz-goz',        7,  4),
  ('demo-anka-checkup',       5,  3),
  ('demo-bogazici-bariatrik', 4,  3),
  ('demo-istanbul-onkoloji',  3,  2),
  ('demo-selcuk-dental',      2,  1),
  ('demo-toros-ortopedi',     2,  1)
) AS s(slug, n_leads, n_cases);

INSERT INTO leads (tenant_id, first_name, last_name, phone, source, treatment_interest,
                   language, status, notes, gdpr_consent_given, ai_follow_up_enabled,
                   created_at, updated_at, status_changed_at)
SELECT t.id,
       split_part(m.names[1 + ((i / 11) % array_length(m.names, 1))], ' ', 1),
       substr(m.names[1 + ((i / 11) % array_length(m.names, 1))],
              strpos(m.names[1 + ((i / 11) % array_length(m.names, 1))], ' ') + 1),
       -- 9-digit national subscriber number; a 7-digit one reads as fake the
       -- moment a clinic owner looks at the list.
       '+' || m.dial || '5' || lpad(((abs(hashtext(t.slug || i::text)::bigint) % 1000000000))::text, 9, '0'),
       'whatsapp',
       t.active_branch_keys[1 + (i % array_length(t.active_branch_keys, 1))],
       m.lang,
       'contacted',
       'platform-fill',
       false,                                   -- consent is never fabricated
       true,
       -- 90 days of history, oldest lead first, evenly spaced. Section 4 gives
       -- each lead the slice of the clinic's message history that matches.
       now() - ((90 - (90 * i / s.n_leads)) * interval '1 day'),
       now() - ((90 - (90 * i / s.n_leads)) * interval '1 day'),
       now() - ((90 - (90 * i / s.n_leads)) * interval '1 day')
FROM tenants t
JOIN _sizes s ON s.slug = t.slug
CROSS JOIN LATERAL generate_series(0, s.n_leads - 1) AS i
JOIN _markets m ON m.ord = 1 + ((i * 3 + length(t.slug)) % 11)
WHERE t.is_demo;

-- ── 2. Cases ─────────────────────────────────────────────────────────────────
-- Each case belongs to one of the leads above, keeps that lead's country,
-- language and treatment, and is staffed only from that same clinic's users.
-- The status distribution is weighted mid-funnel, which is what a working
-- clinic's board actually looks like; the value bands are the real euro ranges
-- for each treatment.

CREATE TEMP TABLE _statuses ON COMMIT DROP AS
SELECT * FROM (VALUES
  (1,'new'),(2,'new'),(3,'qualified'),(4,'qualified'),(5,'qualified'),
  (6,'pre_assessment'),(7,'pre_assessment'),(8,'awaiting_doctor'),(9,'awaiting_doctor'),
  (10,'awaiting_doctor'),(11,'quoted'),(12,'quoted'),(13,'quoted'),(14,'quoted'),
  (15,'awaiting_deposit'),(16,'awaiting_deposit'),(17,'reserved'),(18,'reserved'),
  (19,'travel_planned'),(20,'arrived'),(21,'treated'),(22,'treated'),(23,'returned'),
  (24,'in_aftercare'),(25,'in_aftercare'),(26,'completed'),(27,'completed'),(28,'completed'),
  (29,'lost'),(30,'lost'),(31,'lost'),(32,'medically_ineligible')
) AS st(ord, status);

CREATE TEMP TABLE _bands ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('hair_transplant',   2200,  4800), ('dental',      3000,  9500),
  ('aesthetic_surgery', 3500, 11000), ('eye_lasik',   1600,  3200),
  ('bariatric',         4200,  8800), ('ivf',         3800,  7600),
  ('orthopedics',       5000, 14000), ('cardiology',  6000, 18000),
  ('oncology',          1200,  4500), ('checkup',      700,  1900)
) AS b(branch, lo, hi);

CREATE TEMP TABLE _picked ON COMMIT DROP AS
WITH ranked AS (
  SELECT l.*, t.slug,
         row_number() OVER (PARTITION BY l.tenant_id ORDER BY abs(hashtext(l.id::text)::bigint)) AS pick,
         row_number() OVER (PARTITION BY l.tenant_id ORDER BY l.created_at)              AS seq
  FROM leads l
  JOIN tenants t ON t.id = l.tenant_id
  WHERE l.notes = 'platform-fill'
)
SELECT r.*, s.n_cases
FROM ranked r JOIN _sizes s ON s.slug = r.slug
WHERE r.pick <= s.n_cases;

-- Staff of each clinic, one array per role, so a case can be assigned without
-- a correlated subquery per column.
-- The COALESCE fallbacks are resolved HERE rather than at each use site: a
-- three-person solo clinic has no patient adviser, so its doctor carries the
-- case. Resolving once also keeps the INSERT below subscriptable — Postgres
-- will not subscript a function result directly.
CREATE TEMP TABLE _staff ON COMMIT DROP AS
SELECT tenant_id,
       COALESCE(consultants, doctors, anyone) AS consultants,
       COALESCE(doctors, anyone)              AS doctors,
       COALESCE(coords, anyone)               AS coords,
       interps
FROM (
  SELECT u.tenant_id,
         array_agg(u.id) FILTER (WHERE r.name = 'doktor')          AS doctors,
         array_agg(u.id) FILTER (WHERE r.name = 'hasta_danismani') AS consultants,
         array_agg(u.id) FILTER (WHERE r.name = 'koordinator')     AS coords,
         array_agg(u.id) FILTER (WHERE r.name = 'tercuman')        AS interps,
         array_agg(u.id)                                           AS anyone
  FROM users u JOIN roles r ON r.id = u.role_id
  WHERE u.deleted_at IS NULL AND u.tenant_id IS NOT NULL
  GROUP BY u.tenant_id
) agg;

INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, source_channel,
                   assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id,
                   assigned_interpreter_id, patient_country, patient_language,
                   medical_eligibility, eligibility_note, eligibility_decided_by,
                   eligibility_decided_at, currency, estimated_value, created_at, updated_at)
SELECT p.tenant_id,
       p.id,
       'PF-' || lpad((row_number() OVER (ORDER BY p.tenant_id, p.seq))::text, 4, '0'),
       p.treatment_interest,
       st.status,
       'whatsapp',
       -- Only ever a user of this same clinic (_staff is grouped by tenant).
       sf.consultants[1 + (p.seq % array_length(sf.consultants, 1))],
       sf.doctors    [1 + (p.seq % array_length(sf.doctors, 1))],
       sf.coords     [1 + (p.seq % array_length(sf.coords, 1))],
       CASE WHEN sf.interps IS NULL THEN NULL
            ELSE sf.interps[1 + (p.seq % array_length(sf.interps, 1))] END,
       -- Market is re-derived exactly as section 1 chose it (seq = i + 1), so
       -- the case's country matches the lead's phone. Joining _markets on
       -- language instead would multiply rows: GB, NL and IT all speak 'en'.
       (SELECT country FROM _markets WHERE ord = 1 + (((p.seq - 1) * 3 + length(p.slug)) % 11)),
       p.language,
       -- A doctor has ruled only once the case is past awaiting_doctor. Before
       -- that the decision genuinely has not been taken, so it stays 'pending'
       -- with no decider and no date.
       CASE WHEN st.status = 'medically_ineligible' THEN 'ineligible'
            WHEN st.status IN ('new','qualified','pre_assessment','awaiting_doctor') THEN 'pending'
            WHEN abs(hashtext('e' || p.id::text)::bigint) % 100 < 22 THEN 'conditional'
            ELSE 'eligible' END,
       CASE WHEN st.status = 'medically_ineligible'
                 THEN 'Ön değerlendirme sonrası tedaviye uygun bulunmadı.'
            WHEN st.status NOT IN ('new','qualified','pre_assessment','awaiting_doctor')
                 AND abs(hashtext('e' || p.id::text)::bigint) % 100 < 22
                 THEN 'Uygun — kontrollü. Ek tetkik sonrası kesinleşecek.'
            ELSE NULL END,
       CASE WHEN st.status NOT IN ('new','qualified','pre_assessment','awaiting_doctor')
            THEN sf.doctors[1 + (p.seq % array_length(sf.doctors, 1))]
            ELSE NULL END,
       CASE WHEN st.status NOT IN ('new','qualified','pre_assessment','awaiting_doctor')
            THEN p.created_at + interval '2 days'
            ELSE NULL END,
       'EUR',
       -- rounded to the nearest 50: clinics quote round numbers
       round((b.lo + (abs(hashtext('v' || p.id::text)::bigint) % (b.hi - b.lo))) / 50.0) * 50,
       p.created_at + interval '1 day',
       p.created_at + interval '4 days'
FROM _picked p
JOIN _staff sf ON sf.tenant_id = p.tenant_id
JOIN _bands b  ON b.branch = p.treatment_interest
JOIN _statuses st ON st.ord = 1 + (abs(hashtext('s' || p.id::text)::bigint) % 32);

-- Point each lead at its case, and make the lead's own status agree with it.
-- A lead reading "qualified" next to a case reading "completed" is the kind of
-- contradiction a clinic owner spots in the first minute of a demo.
UPDATE leads l
   SET case_id = c.id,
       status = CASE
         WHEN c.status IN ('lost','medically_ineligible')                            THEN 'lost'
         WHEN c.status IN ('arrived','treated','returned','in_aftercare','completed') THEN 'attended'
         WHEN c.status IN ('reserved','travel_planned')                              THEN 'booked'
         ELSE 'qualified' END
  FROM cases c
 WHERE c.patient_id = l.id AND c.case_number LIKE 'PF-%';

-- ── 3. Status history ────────────────────────────────────────────────────────
-- One case_event per transition the case actually passed through, in order,
-- spread over the days between the case opening and now. Without this the
-- case-detail Denetim tab shows a status with no history behind it.

INSERT INTO case_events (case_id, event_type, actor_id, payload, created_at)
SELECT c.id,
       'status_changed',
       CASE WHEN step.st IN ('awaiting_doctor','medically_ineligible')
            THEN c.assigned_doctor_id ELSE c.assigned_consultant_id END,
       jsonb_build_object('to', step.st,
                          'from', CASE WHEN step.k > 1 THEN path.p[step.k - 1] END),
       -- Ends three hours ago, not at now(). demo.roll_clock takes its hand
       -- from the newest activity row; an event sitting exactly at now() gets
       -- pushed into the future by the very first roll, and further by each
       -- one after it. (Observed: 58 future-dated events on the first run.)
       c.created_at + (now() - interval '3 hours' - c.created_at)
                      * ((step.k - 1)::double precision
                         / GREATEST(1, array_length(path.p, 1) - 1))
FROM cases c
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN c.status = 'medically_ineligible'
      THEN ARRAY['new','qualified','pre_assessment','awaiting_doctor','medically_ineligible']
    WHEN c.status = 'lost'
      THEN (ARRAY['new','qualified','pre_assessment','awaiting_doctor','quoted'])
           [1 : 2 + (abs(hashtext('p' || c.id::text)::bigint) % 4)] || ARRAY['lost']
    ELSE (ARRAY['new','qualified','pre_assessment','awaiting_doctor','quoted','awaiting_deposit',
                'reserved','travel_planned','arrived','treated','returned','in_aftercare','completed'])
         [1 : array_position(
              ARRAY['new','qualified','pre_assessment','awaiting_doctor','quoted','awaiting_deposit',
                    'reserved','travel_planned','arrived','treated','returned','in_aftercare','completed'],
              c.status)]
  END AS p
) AS path
CROSS JOIN LATERAL unnest(path.p) WITH ORDINALITY AS step(st, k)
WHERE c.case_number LIKE 'PF-%';

-- ── 4. Redistribute the existing messages ────────────────────────────────────
-- ~21 000 messages currently hang off one lead per clinic. ntile() splits each
-- clinic's history into as many contiguous slices as it now has leads, and
-- slice i becomes lead i's conversation — so thread times line up with the
-- lead's own created_at from section 1.

WITH counts AS (
  SELECT tenant_id, count(*)::int AS n FROM leads WHERE notes = 'platform-fill' GROUP BY tenant_id
),
ranked AS (
  SELECT m.id, m.tenant_id, ntile(c.n) OVER (PARTITION BY m.tenant_id ORDER BY m.created_at) AS bucket
  FROM messages m JOIN counts c ON c.tenant_id = m.tenant_id
),
targets AS (
  SELECT id, tenant_id, row_number() OVER (PARTITION BY tenant_id ORDER BY created_at) AS bucket
  FROM leads WHERE notes = 'platform-fill'
)
UPDATE messages m
   SET lead_id = t.id
  FROM ranked r JOIN targets t ON t.tenant_id = r.tenant_id AND t.bucket = r.bucket
 WHERE m.id = r.id;

-- The synthetic single-bucket leads now have nothing pointing at them.
DELETE FROM leads
 WHERE first_name = 'Sentetik trafik (demo)'
   AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.lead_id = leads.id);

-- Derive each lead's AI counters from the messages it now owns, rather than
-- asserting numbers the thread does not support.
UPDATE leads l
   SET last_ai_message_at = s.last_ai,
       ai_follow_up_count = s.ai_n
  FROM (SELECT lead_id,
               max(created_at) FILTER (WHERE ai_generated) AS last_ai,
               count(*) FILTER (WHERE ai_generated AND direction = 'outbound')::int AS ai_n
        FROM messages GROUP BY lead_id) s
 WHERE s.lead_id = l.id AND l.notes = 'platform-fill';

-- ── 5. Compliance events ─────────────────────────────────────────────────────
-- What the Uyum Paneli exists to show: outbound text the filter STOPPED. These
-- are claims the Tanıtım Yönetmeliği actually forbids — guarantees of outcome,
-- comparative advertising, inducements, before/after without documented
-- consent, medical advice, unlicensed cure claims — not invented rule names.

INSERT INTO compliance_events (tenant_id, lead_id, case_id, rule, blocked_text, language, actor, created_at)
SELECT c.tenant_id, c.patient_id, c.id, r.rule, r.text, r.lang,
       CASE WHEN abs(hashtext('a' || c.id::text || n::text)::bigint) % 10 < 8 THEN 'ai' ELSE 'staff' END,
       now() - ((abs(hashtext('h' || c.id::text || n::text)::bigint) % 720) * interval '1 hour')
FROM cases c
CROSS JOIN generate_series(1, 2) AS n
JOIN LATERAL (
  SELECT rule, text, lang FROM (VALUES
    (1, 'guarantee_claim',  '%100 garantili sonuç, hiç risk yok.',                          'tr'),
    (2, 'guarantee_claim',  'We guarantee a perfect result with zero risk.',                 'en'),
    (3, 'price_promise',    'Bu fiyat size özel, kimseye söylemeyin.',                       'tr'),
    (4, 'comparative_ad',   'Türkiye''nin en iyi kliniği, diğerleri başarısız.',             'tr'),
    (5, 'comparative_ad',   'The best clinic in Turkey, the others fail.',                   'en'),
    (6, 'before_after',     'Öncesi/sonrası fotoğrafı paylaşıldı (hasta onayı yok).',        'tr'),
    (7, 'before_after',     'Before/after photo shared without documented patient consent.', 'en'),
    (8, 'medical_advice',   'İlacınızı kesin, gerek yok.',                                   'tr'),
    (9, 'medical_advice',   'Stop taking your medication, you will not need it.',            'en'),
    (10, 'testimonial',      'Hasta yorumu tedavi sonucu olarak sunuldu.',                    'tr'),
    (11, 'inducement',       'Arkadaşınızı getirin, ikinci tedavi bedava.',                   'tr'),
    (12, 'inducement',       'Bring a friend and the second treatment is free.',              'en'),
    (13, 'unlicensed_claim', 'Kanser tedavisinde kesin çözüm.',                               'tr'),
    (14, 'unlicensed_claim', 'A definitive cure for cancer.',                                 'en')
  ) AS v(ord, rule, text, lang)
  ORDER BY ord
  OFFSET (abs(hashtext('r' || c.id::text || n::text)::bigint) % 14) LIMIT 1
) r ON true
WHERE c.case_number LIKE 'PF-%'
  AND abs(hashtext('keep' || c.id::text || n::text)::bigint) % 100 < 45;   -- not every case trips the filter

-- ── 6. Audit trail ───────────────────────────────────────────────────────────
-- audit_logs is append-only (migration 070): it cannot be deleted or updated,
-- so this runs only into an empty table. From then on demo.roll_clock (071)
-- appends a row per clinic per hour, which is what keeps Denetim Kaydı current
-- instead of ageing out.

DO $seed$
BEGIN
  IF EXISTS (SELECT 1 FROM audit_logs) THEN
    RAISE NOTICE 'audit_logs is not empty - skipped (append-only, cannot be reseeded)';
    RETURN;
  END IF;

  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, created_at)
  SELECT c.tenant_id,
         CASE (e.k % 3) WHEN 0 THEN c.assigned_doctor_id
                        WHEN 1 THEN c.assigned_consultant_id
                        ELSE c.assigned_coordinator_id END,
         (ARRAY['case.status_changed','case.eligibility_decided','case.viewed',
                'case.quote_sent','case.assigned','case.medical_file_viewed'])
           [1 + (abs(hashtext('act' || c.id::text || e.k::text)::bigint) % 6)],
         'case', c.id,
         now() - ((abs(hashtext('t' || c.id::text || e.k::text)::bigint) % 1440) * interval '1 hour')
  FROM cases c
  CROSS JOIN generate_series(1, 3) AS e(k)
  WHERE c.tenant_id IN (SELECT id FROM tenants WHERE is_demo)
    AND c.deleted_at IS NULL;
END
$seed$;

-- ── 7. The demo clinic's own conversations ───────────────────────────────────
-- CareNova Demo Klinik is the tenant the CLINIC panel (app host) signs into. It
-- had 18 cases and 18 leads and ZERO messages: a clinic with patients and no
-- conversations, and the product's most distinctive screen — the AI WhatsApp
-- thread — empty. It also had no WhatsApp line at all, so the WhatsApp Hatları
-- screen read "Hat yok" next to its traffic; and its leads all carried the seed
-- moment as created_at, which put a patient's first message three months AFTER
-- the case she supposedly opened.
--
-- The script below is a real consultation arc (first contact -> treatment
-- question -> photos -> medical assessment -> written quote -> travel) in the
-- language each lead actually speaks. Nothing in it promises an outcome, quotes
-- before assessment, or gives medical advice: this is demo data for a health
-- product, so it models what the AI is ALLOWED to say. The blocked phrases in
-- section 5 are the counter-example and they are deliberately separate.

-- 7a. A clinic with messages needs a line for them to have arrived on.
-- Credentials are the same literal placeholders the other demo rows use;
-- nothing token-shaped is ever written to this table.
INSERT INTO whatsapp_configs (tenant_id, display_name, phone_number_id, business_account_id,
                              access_token, webhook_verify_token, is_active,
                              daily_message_limit, display_phone_number)
SELECT t.id, t.name, '778812345600100', 'demo-waba',
       'demo-not-a-token', 'demo-not-a-token', true, 1000, '+90 212 555 0100'
FROM tenants t
WHERE t.slug = 'carenova-demo'
  AND NOT EXISTS (SELECT 1 FROM whatsapp_configs w WHERE w.tenant_id = t.id);

-- 7b. The clinic opened in a live demo was also the emptiest detail page and
-- the only row in the Uyum Paneli reading "Bilinmiyor" throughout. Give it the
-- profile of a clinic that has done everything right: it is the reference the
-- others are compared against.
UPDATE tenants
   SET legal_name = COALESCE(legal_name, 'CareNova Demo Sağlık Hizmetleri A.Ş.'),
       email      = COALESCE(email, 'info@demo.carenova.ai'),
       phone      = COALESCE(phone, '+90 212 555 0100')
 WHERE slug = 'carenova-demo';

INSERT INTO tenant_compliance (tenant_id, license_number, license_expires_at,
                               complication_insurance_status, complication_insurance_expires_at,
                               verbis_status, verbis_registered_at,
                               cross_border_contract_status, cross_border_notified_at,
                               foreign_language_staff_ratio)
SELECT t.id, 'SB-34-2024-0100', (now() + interval '14 months')::date,
       'active', (now() + interval '9 months')::date,
       'registered', (now() - interval '8 months')::date,
       'signed', (now() - interval '7 months')::date,
       33   -- 5 of 15 staff work in a foreign language; the floor is 20%
FROM tenants t
WHERE t.slug = 'carenova-demo'
  AND NOT EXISTS (SELECT 1 FROM tenant_compliance tc WHERE tc.tenant_id = t.id);

-- 7c. The lead has to exist before the case it opened.
UPDATE leads l
   SET created_at        = c.created_at - ((1 + (abs(hashtext('lead' || l.id::text)::bigint) % 3)) * interval '1 day'),
       status_changed_at = c.created_at,
       status = CASE
         WHEN c.status IN ('lost','medically_ineligible')                             THEN 'lost'
         WHEN c.status IN ('arrived','treated','returned','in_aftercare','completed')  THEN 'attended'
         WHEN c.status IN ('reserved','travel_planned')                                THEN 'booked'
         WHEN c.status = 'new'                                                         THEN 'responded'
         ELSE 'qualified' END
  FROM cases c
 WHERE c.patient_id = l.id
   AND l.tenant_id = (SELECT id FROM tenants WHERE slug = 'carenova-demo');

DELETE FROM messages WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'carenova-demo');

CREATE TEMP TABLE _script ON COMMIT DROP AS
SELECT * FROM (VALUES
 ('tr',1,'inbound' ,'Merhaba, tedavi hakkında bilgi almak istiyorum.'),
 ('tr',2,'outbound','Merhaba! Size yardımcı olayım. Öncelikle hangi tedaviyi düşündüğünüzü ve yaşınızı öğrenebilir miyim?'),
 ('tr',3,'inbound' ,'38 yaşındayım. Daha önce başka bir klinikte görüştüm ama karar veremedim.'),
 ('tr',4,'outbound','Anlıyorum. Doktorumuzun ön değerlendirme yapabilmesi için birkaç fotoğraf ve mevcut sağlık durumunuza dair kısa bir form gerekiyor. Formu göndereyim mi?'),
 ('tr',5,'inbound' ,'Evet, gönderin.'),
 ('tr',6,'outbound','Formu ve fotoğraf yükleme bağlantısını paylaştım. Doktor değerlendirmesi genellikle 1 iş günü sürüyor.'),
 ('tr',7,'inbound' ,'Fotoğrafları yükledim. Fiyat aralığı nedir?'),
 ('tr',8,'outbound','Teşekkürler, doktora ilettim. Kesin fiyatı ancak doktor değerlendirmesinden sonra, yazılı teklif olarak paylaşabiliyoruz — tahmini rakam vermek sizi yanıltır.'),
 ('tr',9,'inbound' ,'Tamam, bekliyorum.'),
 ('tr',10,'outbound','Doktorumuz dosyanızı inceledi ve tedaviye uygun buldu. Yazılı teklifinizi ve takvim seçeneklerini gönderiyorum.'),
 ('tr',11,'inbound' ,'Teklifi aldım. Uçuş ve otel de dahil mi?'),
 ('tr',12,'outbound','Teklifte konaklama ve havalimanı transferi dahil, uçuş biletiniz hariç. İsterseniz koordinatörümüz tarihlere göre öneri hazırlasın.'),

 ('en',1,'inbound' ,'Hello, I would like information about treatment.'),
 ('en',2,'outbound','Hello! Happy to help. Could you tell me which treatment you are considering and your age?'),
 ('en',3,'inbound' ,'I am 41. I have been researching clinics in Turkey for a few months.'),
 ('en',4,'outbound','Understood. For our doctor to make an initial assessment we need a few photos and a short health questionnaire. Shall I send the form?'),
 ('en',5,'inbound' ,'Yes please.'),
 ('en',6,'outbound','I have shared the form and the photo upload link. The doctor''s assessment usually takes one working day.'),
 ('en',7,'inbound' ,'Uploaded. What is the price range?'),
 ('en',8,'outbound','Thank you, I have passed it to the doctor. We only quote after the assessment, in writing — an estimate before that would be misleading.'),
 ('en',9,'inbound' ,'That is fair. I will wait.'),
 ('en',10,'outbound','Our doctor has reviewed your file and considers you suitable for treatment. I am sending your written quote and the available dates.'),
 ('en',11,'inbound' ,'Got the quote. Does it include flights and the hotel?'),
 ('en',12,'outbound','The quote includes accommodation and airport transfers; flights are not included. Our coordinator can put together options around your dates.'),

 ('de',1,'inbound' ,'Guten Tag, ich interessiere mich für eine Behandlung.'),
 ('de',2,'outbound','Guten Tag! Gerne. Dürfte ich fragen, welche Behandlung Sie in Betracht ziehen und wie alt Sie sind?'),
 ('de',3,'inbound' ,'Ich bin 45. Ich vergleiche gerade mehrere Kliniken.'),
 ('de',4,'outbound','Verstehe. Für die Ersteinschätzung unseres Arztes brauchen wir einige Fotos und einen kurzen Gesundheitsfragebogen. Soll ich das Formular senden?'),
 ('de',5,'inbound' ,'Ja, bitte.'),
 ('de',6,'outbound','Ich habe Ihnen das Formular und den Upload-Link geschickt. Die ärztliche Einschätzung dauert in der Regel einen Werktag.'),
 ('de',7,'inbound' ,'Hochgeladen. Was kostet das ungefähr?'),
 ('de',8,'outbound','Danke, ich habe alles an den Arzt weitergeleitet. Einen Preis nennen wir erst nach der Einschätzung und schriftlich — eine Schätzung vorab wäre irreführend.'),
 ('de',9,'inbound' ,'In Ordnung, ich warte.'),
 ('de',10,'outbound','Unser Arzt hat Ihre Unterlagen geprüft und hält die Behandlung für geeignet. Ich sende Ihnen das schriftliche Angebot und mögliche Termine.'),
 ('de',11,'inbound' ,'Angebot erhalten. Sind Flug und Hotel enthalten?'),
 ('de',12,'outbound','Unterkunft und Flughafentransfer sind enthalten, der Flug nicht. Unsere Koordinatorin stellt Ihnen gern Vorschläge zu Ihren Terminen zusammen.'),

 ('ru',1,'inbound' ,'Здравствуйте, хочу узнать о лечении.'),
 ('ru',2,'outbound','Здравствуйте! С удовольствием помогу. Подскажите, какое лечение вы рассматриваете и сколько вам лет?'),
 ('ru',3,'inbound' ,'Мне 36. Сравниваю несколько клиник в Турции.'),
 ('ru',4,'outbound','Понимаю. Для первичной оценки врача нужны несколько фотографий и короткая анкета о здоровье. Отправить форму?'),
 ('ru',5,'inbound' ,'Да, отправьте.'),
 ('ru',6,'outbound','Отправила форму и ссылку для загрузки фотографий. Оценка врача обычно занимает один рабочий день.'),
 ('ru',7,'inbound' ,'Загрузила. Какой примерный диапазон цен?'),
 ('ru',8,'outbound','Спасибо, передала врачу. Цену мы называем только после оценки и письменно — предварительная сумма ввела бы вас в заблуждение.'),
 ('ru',9,'inbound' ,'Хорошо, жду.'),
 ('ru',10,'outbound','Врач изучил ваши материалы и считает лечение подходящим. Отправляю письменное предложение и доступные даты.'),
 ('ru',11,'inbound' ,'Получила. Перелёт и отель включены?'),
 ('ru',12,'outbound','В предложение входят проживание и трансфер из аэропорта, перелёт — нет. Координатор подготовит варианты под ваши даты.'),

 ('ar',1,'inbound' ,'مرحبًا، أود الحصول على معلومات حول العلاج.'),
 ('ar',2,'outbound','مرحبًا! يسعدني مساعدتك. هل يمكنك إخباري بالعلاج الذي تفكر فيه وعمرك؟'),
 ('ar',3,'inbound' ,'عمري 39 عامًا، وأقارن بين عدة عيادات.'),
 ('ar',4,'outbound','مفهوم. لكي يجري طبيبنا تقييمًا أوليًا نحتاج بعض الصور واستبيانًا صحيًا قصيرًا. هل أرسل لك النموذج؟'),
 ('ar',5,'inbound' ,'نعم، من فضلك.'),
 ('ar',6,'outbound','أرسلت لك النموذج ورابط رفع الصور. عادةً ما يستغرق تقييم الطبيب يوم عمل واحد.'),
 ('ar',7,'inbound' ,'تم الرفع. ما هو النطاق السعري؟'),
 ('ar',8,'outbound','شكرًا، أرسلتها إلى الطبيب. نحن نقدّم السعر كتابةً بعد التقييم فقط — أي تقدير قبل ذلك سيكون مضللًا.'),
 ('ar',9,'inbound' ,'حسنًا، سأنتظر.'),
 ('ar',10,'outbound','راجع طبيبنا ملفك ويرى أنك مناسب للعلاج. أرسل لك العرض المكتوب والمواعيد المتاحة.'),
 ('ar',11,'inbound' ,'وصلني العرض. هل يشمل الطيران والفندق؟'),
 ('ar',12,'outbound','العرض يشمل الإقامة والنقل من المطار، أما تذكرة الطيران فغير مشمولة. يمكن لمنسّقنا إعداد خيارات حسب تواريخك.')
) AS s(lang, turn, direction, text);

-- The window each thread occupies: from the lead's first contact to when the
-- conversation actually stopped. A closed case stopped talking when it closed;
-- an open one is still recent. Clamped to three hours ago at the latest —
-- demo.roll_clock (071) takes its hand from the newest activity row, so a
-- thread ending at now() would be pushed into the future by the first roll.
CREATE TEMP TABLE _threads ON COMMIT DROP AS
SELECT l.id AS lead_id, l.tenant_id, l.language,
       l.created_at AS starts,
       LEAST(
         CASE WHEN c.status IN ('completed','lost','medically_ineligible')
              THEN c.updated_at + interval '2 days'
              ELSE now() - ((2 + (abs(hashtext('end' || l.id::text)::bigint) % 40)) * interval '1 hour')
         END,
         now() - interval '3 hours'
       ) AS ends,
       CASE WHEN l.status = 'lost'     THEN 4 + (abs(hashtext('n' || l.id::text)::bigint) % 4)
            WHEN l.status = 'attended' THEN 12
            ELSE 6 + (abs(hashtext('n' || l.id::text)::bigint) % 7) END AS turns
FROM leads l
JOIN cases c   ON c.patient_id = l.id
JOIN tenants t ON t.id = l.tenant_id AND t.slug = 'carenova-demo';

INSERT INTO messages (tenant_id, lead_id, direction, content, message_type, status,
                      status_updated_at, ai_generated, ai_model, ai_prompt_tokens,
                      ai_completion_tokens, sent_at, created_at)
SELECT th.tenant_id, th.lead_id, s.direction, s.text, 'text',
       -- A small share of outbound messages fail to deliver, which is what the
       -- Platform Sağlığı screen exists to surface. Inbound never "fails".
       CASE WHEN s.direction = 'outbound'
             AND abs(hashtext('f' || th.lead_id::text || s.turn::text)::bigint) % 100 < 3
            THEN 'failed' ELSE 'read' END,
       at.ts, s.direction = 'outbound',
       CASE WHEN s.direction = 'outbound' THEN 'claude-sonnet-4-5' END,
       CASE WHEN s.direction = 'outbound'
            THEN 900 + (abs(hashtext('pt' || th.lead_id::text || s.turn::text)::bigint) % 700) END,
       CASE WHEN s.direction = 'outbound'
            THEN 60 + (abs(hashtext('ct' || th.lead_id::text || s.turn::text)::bigint) % 180) END,
       at.ts, at.ts
FROM _threads th
JOIN _script s ON s.lang = th.language AND s.turn <= th.turns
CROSS JOIN LATERAL (
  SELECT th.starts + (GREATEST(th.ends, th.starts + interval '3 hours') - th.starts)
                     * (s.turn::double precision / th.turns) AS ts
) at;

-- The AI does not take hours to answer, and the platform overview reports
-- exactly that: average first reply. Laying every turn out evenly put the AI's
-- response hours after the patient's message and the overview read 1 989,8 s —
-- 33 minutes — for a product whose whole claim is an instant answer. The
-- patient takes hours or days to write back; the AI answers in seconds.
WITH seq AS (
  SELECT m.id, m.direction,
         lag(m.created_at) OVER (PARTITION BY m.lead_id ORDER BY m.created_at) AS prev_at,
         lag(m.direction)  OVER (PARTITION BY m.lead_id ORDER BY m.created_at) AS prev_dir
  FROM messages m
  WHERE m.tenant_id = (SELECT id FROM tenants WHERE slug = 'carenova-demo')
),
fixed AS (
  -- 18-180 s: fast, but not so uniform that it reads as generated.
  SELECT id, prev_at + ((18 + (abs(hashtext('d' || id::text)::bigint) % 163)) * interval '1 second') AS ts
  FROM seq WHERE direction = 'outbound' AND prev_dir = 'inbound' AND prev_at IS NOT NULL
)
UPDATE messages m SET created_at = f.ts, sent_at = f.ts, status_updated_at = f.ts
  FROM fixed f WHERE m.id = f.id;

-- Counters derived from the thread, never asserted.
UPDATE leads l
   SET last_ai_message_at = s.last_ai,
       ai_follow_up_count = s.ai_n
  FROM (SELECT lead_id,
               max(created_at) FILTER (WHERE ai_generated) AS last_ai,
               count(*) FILTER (WHERE ai_generated AND direction = 'outbound')::int AS ai_n
        FROM messages GROUP BY lead_id) s
 WHERE s.lead_id = l.id
   AND l.tenant_id = (SELECT id FROM tenants WHERE slug = 'carenova-demo');

COMMIT;

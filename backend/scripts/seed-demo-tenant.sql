BEGIN;
INSERT INTO tenants (name, slug, status, plan_tier, country, timezone, is_demo, active_branch_keys)
VALUES ('CareNova Demo Klinik','carenova-demo','active','klinik','TR','Europe/Istanbul',true, ARRAY['hair_transplant','dental','aesthetic_surgery','eye_lasik','ivf']::text[])
ON CONFLICT (slug) DO UPDATE SET is_demo=true, active_branch_keys=EXCLUDED.active_branch_keys, updated_at=now();
CREATE TEMP TABLE _t AS SELECT id FROM tenants WHERE slug='carenova-demo';
INSERT INTO users (tenant_id, role_id, email, password_hash, first_name, last_name, is_active) VALUES
((SELECT id FROM _t), 12, 'emre.yildiz@demo.carenova.ai', '!unusable-no-login', 'Emre', 'Yıldız', true),
((SELECT id FROM _t), 12, 'selin.kaya@demo.carenova.ai', '!unusable-no-login', 'Selin', 'Kaya', true),
((SELECT id FROM _t), 12, 'mert.aydin@demo.carenova.ai', '!unusable-no-login', 'Mert', 'Aydın', true),
((SELECT id FROM _t), 12, 'ayla.celik@demo.carenova.ai', '!unusable-no-login', 'Ayla', 'Çelik', true),
((SELECT id FROM _t), 12, 'kerem.ates@demo.carenova.ai', '!unusable-no-login', 'Kerem', 'Ateş', true),
((SELECT id FROM _t), 11, 'ayse.demir@demo.carenova.ai', '!unusable-no-login', 'Ayşe', 'Demir', true),
((SELECT id FROM _t), 11, 'jonas.fischer@demo.carenova.ai', '!unusable-no-login', 'Jonas', 'Fischer', true),
((SELECT id FROM _t), 11, 'layla.hassan@demo.carenova.ai', '!unusable-no-login', 'Layla', 'Hassan', true),
((SELECT id FROM _t), 11, 'olga.petrova@demo.carenova.ai', '!unusable-no-login', 'Olga', 'Petrova', true),
((SELECT id FROM _t), 13, 'kaan.sahin@demo.carenova.ai', '!unusable-no-login', 'Kaan', 'Şahin', true),
((SELECT id FROM _t), 13, 'elif.aksoy@demo.carenova.ai', '!unusable-no-login', 'Elif', 'Aksoy', true),
((SELECT id FROM _t), 14, 'reem.al.sayed@demo.carenova.ai', '!unusable-no-login', 'Reem', 'Al-Sayed', true),
((SELECT id FROM _t), 14, 'natasha.ivanova@demo.carenova.ai', '!unusable-no-login', 'Natasha', 'Ivanova', true),
((SELECT id FROM _t), 14, 'hans.weber@demo.carenova.ai', '!unusable-no-login', 'Hans', 'Weber', true)
ON CONFLICT (tenant_id, email) DO UPDATE SET role_id=EXCLUDED.role_id, first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, updated_at=now();
INSERT INTO users (tenant_id, role_id, email, password_hash, first_name, last_name, is_active)
VALUES ((SELECT id FROM _t), 10, 'demo@carenova.ai', '!unusable-set-with-set-admin-password', 'Demo', 'Kullanici', true)
ON CONFLICT (tenant_id, email) DO UPDATE SET role_id=EXCLUDED.role_id, is_active=true, updated_at=now();
INSERT INTO user_tenants (user_id, tenant_id, role_id)
SELECT u.id, u.tenant_id, u.role_id FROM users u WHERE u.tenant_id=(SELECT id FROM _t) ON CONFLICT (user_id, tenant_id) DO NOTHING;
DELETE FROM cases WHERE tenant_id=(SELECT id FROM _t);
DELETE FROM leads WHERE tenant_id=(SELECT id FROM _t);
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Michael Brandt', '+900001000001', 'de', 'new', 'hair_transplant', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0201', 'hair_transplant', 'new', 'pending', NULL,
         'DE', 'de', 'EUR', 2600,
         (SELECT id FROM users WHERE email='ayse.demir@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         '2026-09-07T07:42:00.000Z'::timestamptz, '2026-09-07T07:42:00.000Z'::timestamptz
  FROM l RETURNING id
)
, ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"new"}'::jsonb,'2026-09-07T07:42:00.000Z')) AS v(p,at) RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Sara Al-Amin', '+900001000002', 'ar', 'new', 'dental', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0187', 'dental', 'qualified', 'pending', NULL,
         'IQ', 'ar', 'EUR', 3400,
         (SELECT id FROM users WHERE email='layla.hassan@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='reem.al.sayed@demo.carenova.ai'),
         '2026-09-07T06:00:00.000Z'::timestamptz, '2026-09-07T06:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, comp AS (INSERT INTO case_companions (case_id, name, relationship) SELECT cse.id, v.name, v.rel FROM cse, (VALUES ('Youssef Al-Amin','Eş')) AS v(name,rel) RETURNING 1), ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"new"}'::jsonb,'2026-09-05T08:00:00.000Z'),('{"status":"qualified"}'::jsonb,'2026-09-07T06:00:00.000Z')) AS v(p,at) RETURNING 1), asm AS (INSERT INTO case_assessments (case_id, template_key, answers, completed_at) SELECT cse.id, 'dental', '[{"q":"Eksik diş sayısı","a":"4"}]'::jsonb, now() FROM cse RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Lukas Weber', '+900001000003', 'de', 'new', 'hair_transplant', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0142', 'hair_transplant', 'awaiting_doctor', 'pending', NULL,
         'DE', 'de', 'EUR', 2900,
         (SELECT id FROM users WHERE email='jonas.fischer@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         '2026-09-07T03:00:00.000Z'::timestamptz, '2026-09-07T03:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"new"}'::jsonb,'2026-09-04T08:00:00.000Z'),('{"status":"qualified"}'::jsonb,'2026-09-05T08:00:00.000Z'),('{"status":"pre_assessment"}'::jsonb,'2026-09-05T08:00:00.000Z'),('{"status":"awaiting_doctor"}'::jsonb,'2026-09-07T03:00:00.000Z')) AS v(p,at) RETURNING 1), asm AS (INSERT INTO case_assessments (case_id, template_key, answers, completed_at) SELECT cse.id, 'hair_transplant', '[{"q":"Norwood evresi (fotoğraftan)","a":"4"},{"q":"Kronik hastalık","a":"Yok"}]'::jsonb, now() FROM cse RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Ahmed Al-Rashid', '+900001000004', 'ar', 'new', 'dental', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0198', 'dental', 'awaiting_doctor', 'pending', NULL,
         'IQ', 'ar', 'EUR', 3100,
         (SELECT id FROM users WHERE email='layla.hassan@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='ayla.celik@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='reem.al.sayed@demo.carenova.ai'),
         '2026-09-07T00:00:00.000Z'::timestamptz, '2026-09-07T00:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"new"}'::jsonb,'2026-09-03T08:00:00.000Z'),('{"status":"qualified"}'::jsonb,'2026-09-04T08:00:00.000Z'),('{"status":"pre_assessment"}'::jsonb,'2026-09-05T08:00:00.000Z'),('{"status":"awaiting_doctor"}'::jsonb,'2026-09-07T00:00:00.000Z')) AS v(p,at) RETURNING 1), asm AS (INSERT INTO case_assessments (case_id, template_key, answers, completed_at) SELECT cse.id, 'dental', '[{"q":"Eksik diş sayısı","a":"3"}]'::jsonb, now() FROM cse RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Charlotte Bennett', '+900001000005', 'en', 'new', 'aesthetic_surgery', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0156', 'aesthetic_surgery', 'quoted', 'eligible', 'Uygun, standart rinoplasti planı.',
         'GB', 'en', 'EUR', 5200,
         (SELECT id FROM users WHERE email='jonas.fischer@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='selin.kaya@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         '2026-09-06T20:00:00.000Z'::timestamptz, '2026-09-06T20:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, comp AS (INSERT INTO case_companions (case_id, name, relationship) SELECT cse.id, v.name, v.rel FROM cse, (VALUES ('James Bennett','Eş')) AS v(name,rel) RETURNING 1), ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"new"}'::jsonb,'2026-09-01T08:00:00.000Z'),('{"status":"qualified"}'::jsonb,'2026-09-02T08:00:00.000Z'),('{"status":"pre_assessment"}'::jsonb,'2026-09-03T08:00:00.000Z'),('{"status":"awaiting_doctor"}'::jsonb,'2026-09-05T08:00:00.000Z'),('{"status":"quoted"}'::jsonb,'2026-09-06T20:00:00.000Z')) AS v(p,at) RETURNING 1), asm AS (INSERT INTO case_assessments (case_id, template_key, answers, completed_at) SELECT cse.id, 'aesthetic_surgery', '[{"q":"İlgilenilen prosedür","a":"Rinoplasti"}]'::jsonb, now() FROM cse RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Irina Sokolova', '+900001000006', 'ru', 'new', 'eye_lasik', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0133', 'eye_lasik', 'awaiting_deposit', 'eligible', 'Uygun.',
         'RU', 'ru', 'EUR', 2100,
         (SELECT id FROM users WHERE email='olga.petrova@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='mert.aydin@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='kaan.sahin@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='natasha.ivanova@demo.carenova.ai'),
         '2026-09-06T08:00:00.000Z'::timestamptz, '2026-09-06T08:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"new"}'::jsonb,'2026-08-28T08:00:00.000Z'),('{"status":"quoted"}'::jsonb,'2026-09-04T08:00:00.000Z'),('{"status":"awaiting_deposit"}'::jsonb,'2026-09-06T08:00:00.000Z')) AS v(p,at) RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Fatima Zohra', '+900001000007', 'ar', 'new', 'hair_transplant', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0098', 'hair_transplant', 'reserved', 'eligible', 'Uygun.',
         'DZ', 'ar', 'EUR', 3300,
         (SELECT id FROM users WHERE email='layla.hassan@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='emre.yildiz@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='elif.aksoy@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='reem.al.sayed@demo.carenova.ai'),
         '2026-09-05T08:00:00.000Z'::timestamptz, '2026-09-05T08:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, comp AS (INSERT INTO case_companions (case_id, name, relationship) SELECT cse.id, v.name, v.rel FROM cse, (VALUES ('Amina Zohra','Kız kardeş')) AS v(name,rel) RETURNING 1), ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"new"}'::jsonb,'2026-08-18T08:00:00.000Z'),('{"status":"quoted"}'::jsonb,'2026-08-26T08:00:00.000Z'),('{"status":"awaiting_deposit"}'::jsonb,'2026-08-30T08:00:00.000Z'),('{"status":"reserved"}'::jsonb,'2026-09-05T08:00:00.000Z')) AS v(p,at) RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'David Kim', '+900001000008', 'en', 'new', 'dental', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0077', 'dental', 'travel_planned', 'eligible', 'Uygun.',
         'KR', 'en', 'EUR', 4100,
         (SELECT id FROM users WHERE email='jonas.fischer@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='ayla.celik@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='kaan.sahin@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         '2026-09-04T08:00:00.000Z'::timestamptz, '2026-09-04T08:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"reserved"}'::jsonb,'2026-08-28T08:00:00.000Z'),('{"status":"travel_planned"}'::jsonb,'2026-09-04T08:00:00.000Z')) AS v(p,at) RETURNING 1), itn AS (INSERT INTO case_timeline (case_id, day_offset, title, type) SELECT cse.id, v.d, v.t, 'consultation' FROM cse, (VALUES (0,'{"tr":"Varış + konsültasyon","label":"Gün 1"}'::jsonb),(1,'{"tr":"Operasyon","label":"Gün 2"}'::jsonb),(2,'{"tr":"Dinlenme + kontrol","label":"Gün 3-4"}'::jsonb),(3,'{"tr":"Dönüş","label":"Gün 5"}'::jsonb)) AS v(d,t) RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Hassan Baig', '+900001000009', 'en', 'new', 'hair_transplant', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0055', 'hair_transplant', 'arrived', 'eligible', 'Uygun.',
         'PK', 'en', 'EUR', 2800,
         (SELECT id FROM users WHERE email='ayse.demir@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='emre.yildiz@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='kaan.sahin@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         '2026-09-07T02:00:00.000Z'::timestamptz, '2026-09-07T02:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, comp AS (INSERT INTO case_companions (case_id, name, relationship) SELECT cse.id, v.name, v.rel FROM cse, (VALUES ('Amir Baig','Kardeş')) AS v(name,rel) RETURNING 1), ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"travel_planned"}'::jsonb,'2026-09-02T08:00:00.000Z'),('{"status":"arrived"}'::jsonb,'2026-09-07T02:00:00.000Z')) AS v(p,at) RETURNING 1), itn AS (INSERT INTO case_timeline (case_id, day_offset, title, type) SELECT cse.id, v.d, v.t, 'consultation' FROM cse, (VALUES (0,'{"tr":"Varış — otelde","label":"Gün 1"}'::jsonb)) AS v(d,t) RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Marco Rossi', '+900001000010', 'en', 'new', 'aesthetic_surgery', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0031', 'aesthetic_surgery', 'treated', 'eligible', 'Operasyon başarılı.',
         'IT', 'en', 'EUR', 6100,
         (SELECT id FROM users WHERE email='jonas.fischer@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='selin.kaya@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='elif.aksoy@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         '2026-09-06T08:00:00.000Z'::timestamptz, '2026-09-06T08:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"arrived"}'::jsonb,'2026-09-04T08:00:00.000Z'),('{"status":"treated"}'::jsonb,'2026-09-06T08:00:00.000Z')) AS v(p,at) RETURNING 1), itn AS (INSERT INTO case_timeline (case_id, day_offset, title, type) SELECT cse.id, v.d, v.t, 'consultation' FROM cse, (VALUES (0,'{"tr":"Operasyon tamamlandı, dinlenme","label":"Gün 3"}'::jsonb)) AS v(d,t) RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Sophie Martin', '+900001000011', 'en', 'new', 'dental', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0012', 'dental', 'returned', 'eligible', 'Tamamlandı.',
         'FR', 'en', 'EUR', 2950,
         (SELECT id FROM users WHERE email='ayse.demir@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='ayla.celik@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         '2026-09-03T08:00:00.000Z'::timestamptz, '2026-09-03T08:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"treated"}'::jsonb,'2026-09-01T08:00:00.000Z'),('{"status":"returned"}'::jsonb,'2026-09-03T08:00:00.000Z')) AS v(p,at) RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Klaus Richter', '+900001000012', 'de', 'new', 'hair_transplant', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2025-0891', 'hair_transplant', 'in_aftercare', 'eligible', NULL,
         'DE', 'de', 'EUR', 3050,
         (SELECT id FROM users WHERE email='jonas.fischer@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='emre.yildiz@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         '2026-08-31T08:00:00.000Z'::timestamptz, '2026-08-31T08:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"treated"}'::jsonb,'2026-08-06T08:00:00.000Z'),('{"status":"returned"}'::jsonb,'2026-08-08T08:00:00.000Z'),('{"status":"in_aftercare"}'::jsonb,'2026-08-08T08:00:00.000Z')) AS v(p,at) RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Rania Khoury', '+900001000013', 'ar', 'new', 'aesthetic_surgery', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2025-0654', 'aesthetic_surgery', 'completed', 'eligible', NULL,
         'LB', 'ar', 'EUR', 5500,
         (SELECT id FROM users WHERE email='layla.hassan@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='selin.kaya@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='reem.al.sayed@demo.carenova.ai'),
         '2026-06-09T08:00:00.000Z'::timestamptz, '2026-06-09T08:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"treated"}'::jsonb,'2026-03-06T08:00:00.000Z'),('{"status":"in_aftercare"}'::jsonb,'2026-03-11T08:00:00.000Z'),('{"status":"completed"}'::jsonb,'2026-06-09T08:00:00.000Z')) AS v(p,at) RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Tom Andersen', '+900001000014', 'en', 'new', 'hair_transplant', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0177', 'hair_transplant', 'lost', 'eligible', NULL,
         'NO', 'en', 'EUR', 2400,
         (SELECT id FROM users WHERE email='ayse.demir@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         '2026-08-23T08:00:00.000Z'::timestamptz, '2026-08-23T08:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"quoted"}'::jsonb,'2026-08-18T08:00:00.000Z'),('{"status":"lost"}'::jsonb,'2026-08-23T08:00:00.000Z')) AS v(p,at) RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Aylin Yusupova', '+900001000015', 'ru', 'new', 'ivf', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0203', 'ivf', 'medically_ineligible', 'ineligible', 'Donör gamet Türkiye''de yasal değil — branş şablonu kuralı gereği vaka kapatıldı.',
         'KZ', 'ru', 'EUR', 0,
         (SELECT id FROM users WHERE email='olga.petrova@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='kerem.ates@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='natasha.ivanova@demo.carenova.ai'),
         '2026-09-06T22:00:00.000Z'::timestamptz, '2026-09-06T22:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, comp AS (INSERT INTO case_companions (case_id, name, relationship) SELECT cse.id, v.name, v.rel FROM cse, (VALUES ('Ruslan Yusupov','Eş')) AS v(name,rel) RETURNING 1), ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"pre_assessment"}'::jsonb,'2026-09-06T08:00:00.000Z'),('{"status":"medically_ineligible"}'::jsonb,'2026-09-06T22:00:00.000Z')) AS v(p,at) RETURNING 1), asm AS (INSERT INTO case_assessments (case_id, template_key, answers, completed_at) SELECT cse.id, 'ivf', '[{"q":"Donör gamet ihtiyacı","a":"Evet"}]'::jsonb, now() FROM cse RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Isabella Conti', '+900001000016', 'en', 'new', 'aesthetic_surgery', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0211', 'aesthetic_surgery', 'awaiting_doctor', 'pending', NULL,
         'IT', 'en', 'EUR', 4800,
         (SELECT id FROM users WHERE email='jonas.fischer@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         '2026-09-07T07:48:00.000Z'::timestamptz, '2026-09-07T07:48:00.000Z'::timestamptz
  FROM l RETURNING id
)
, ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"new"}'::jsonb,'2026-09-06T08:00:00.000Z'),('{"status":"qualified"}'::jsonb,'2026-09-07T02:00:00.000Z'),('{"status":"pre_assessment"}'::jsonb,'2026-09-07T07:00:00.000Z'),('{"status":"awaiting_doctor"}'::jsonb,'2026-09-07T07:48:00.000Z')) AS v(p,at) RETURNING 1), asm AS (INSERT INTO case_assessments (case_id, template_key, answers, completed_at) SELECT cse.id, 'aesthetic_surgery', '[{"q":"İlgilenilen prosedür","a":"Karın germe + liposuction"},{"q":"Önceki ameliyat","a":"Sezaryen (2021)"}]'::jsonb, now() FROM cse RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Emre Aydınoğlu', '+900001000017', 'tr', 'new', 'eye_lasik', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0058', 'eye_lasik', 'awaiting_doctor', 'pending', NULL,
         'NL', 'tr', 'EUR', 2200,
         (SELECT id FROM users WHERE email='ayse.demir@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         '2026-09-05T08:00:00.000Z'::timestamptz, '2026-09-05T08:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"new"}'::jsonb,'2026-09-02T08:00:00.000Z'),('{"status":"qualified"}'::jsonb,'2026-09-03T08:00:00.000Z'),('{"status":"pre_assessment"}'::jsonb,'2026-09-04T08:00:00.000Z'),('{"status":"awaiting_doctor"}'::jsonb,'2026-09-05T08:00:00.000Z')) AS v(p,at) RETURNING 1), asm AS (INSERT INTO case_assessments (case_id, template_key, answers, completed_at) SELECT cse.id, 'eye_lasik', '[{"q":"Numara (sağ/sol)","a":"-4.5 / -4.0"},{"q":"Kornea kalınlığı ölçümü","a":"Yapılmadı"}]'::jsonb, now() FROM cse RETURNING 1)
SELECT 1;
WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), 'Omar Haddad', '+900001000018', 'ar', 'new', 'dental', false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, 'CN-2026-0019', 'dental', 'awaiting_doctor', 'pending', NULL,
         'JO', 'ar', 'EUR', 5200,
         (SELECT id FROM users WHERE email='layla.hassan@demo.carenova.ai'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='x@x'),
         (SELECT id FROM users WHERE email='reem.al.sayed@demo.carenova.ai'),
         '2026-09-04T08:00:00.000Z'::timestamptz, '2026-09-04T08:00:00.000Z'::timestamptz
  FROM l RETURNING id
)
, comp AS (INSERT INTO case_companions (case_id, name, relationship) SELECT cse.id, v.name, v.rel FROM cse, (VALUES ('Layla Haddad','Eş')) AS v(name,rel) RETURNING 1), ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ('{"status":"new"}'::jsonb,'2026-08-30T08:00:00.000Z'),('{"status":"qualified"}'::jsonb,'2026-09-01T08:00:00.000Z'),('{"status":"pre_assessment"}'::jsonb,'2026-09-03T08:00:00.000Z'),('{"status":"awaiting_doctor"}'::jsonb,'2026-09-04T08:00:00.000Z')) AS v(p,at) RETURNING 1), asm AS (INSERT INTO case_assessments (case_id, template_key, answers, completed_at) SELECT cse.id, 'dental', '[{"q":"Eksik diş sayısı","a":"8"},{"q":"Kronik hastalık","a":"Tip 2 diyabet — kontrolsüz"}]'::jsonb, now() FROM cse RETURNING 1)
SELECT 1;
COMMIT;
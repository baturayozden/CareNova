const fs=require('fs');
const D=JSON.parse(fs.readFileSync('demo-seed-data.json','utf8'));
const q=v=>v===null||v===undefined?'NULL':"'"+String(v).replace(/'/g,"''")+"'";
const j=v=>"'"+JSON.stringify(v).replace(/'/g,"''")+"'::jsonb";
const ROLE={doctors:12,consultants:11,coordinators:13,interpreters:14};
const tr={'ç':'c','ğ':'g','ı':'i','ö':'o','ş':'s','ü':'u','Ç':'c','Ğ':'g','İ':'i','Ö':'o','Ş':'s','Ü':'u'};
const email=n=>n.replace(/^Dr\.?\s*/,'').split('').map(c=>tr[c]||c).join('').toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'')+'@demo.carenova.ai';
const L=[];
L.push('BEGIN;');
const branches=[...new Set(D.cases.map(c=>c.branchKey))];
L.push(`INSERT INTO tenants (name, slug, status, plan_tier, country, timezone, is_demo, active_branch_keys)
VALUES ('CareNova Demo Klinik','carenova-demo','active','klinik','TR','Europe/Istanbul',true, ARRAY[${branches.map(q).join(',')}]::text[])
ON CONFLICT (slug) DO UPDATE SET is_demo=true, active_branch_keys=EXCLUDED.active_branch_keys, updated_at=now();`);
L.push(`CREATE TEMP TABLE _t AS SELECT id FROM tenants WHERE slug='carenova-demo';`);
// staff
const staffRows=[];
for(const [g,roleId] of Object.entries(ROLE)) for(const p of (D.staff[g]||[])){
  const name=typeof p==='string'?p:p.name;
  const parts=name.replace(/^Dr\.?\s*/,'').trim().split(/\s+/);
  const first=parts.shift(), last=parts.join(' ')||'-';
  staffRows.push({name, email:email(name), first, last, roleId});
}
L.push(`INSERT INTO users (tenant_id, role_id, email, password_hash, first_name, last_name, is_active) VALUES`);
L.push(staffRows.map(s=>`((SELECT id FROM _t), ${s.roleId}, ${q(s.email)}, '!unusable-no-login', ${q(s.first)}, ${q(s.last)}, true)`).join(',\n'));
L.push(`ON CONFLICT (tenant_id, email) DO UPDATE SET role_id=EXCLUDED.role_id, first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, updated_at=now();`);
L.push(`INSERT INTO users (tenant_id, role_id, email, password_hash, first_name, last_name, is_active)
VALUES ((SELECT id FROM _t), 10, 'demo@carenova.ai', '!unusable-set-with-set-admin-password', 'Demo', 'Kullanici', true)
ON CONFLICT (tenant_id, email) DO UPDATE SET role_id=EXCLUDED.role_id, is_active=true, updated_at=now();`);
L.push(`INSERT INTO user_tenants (user_id, tenant_id, role_id)
SELECT u.id, u.tenant_id, u.role_id FROM users u WHERE u.tenant_id=(SELECT id FROM _t) ON CONFLICT (user_id, tenant_id) DO NOTHING;`);
// wipe + cases
L.push(`DELETE FROM cases WHERE tenant_id=(SELECT id FROM _t);`);
L.push(`DELETE FROM leads WHERE tenant_id=(SELECT id FROM _t);`);
let n=0;
for(const c of D.cases){
  n++;
  const phone='+90000'+String(1000000+n).slice(0,7);
  L.push(`WITH l AS (
  INSERT INTO leads (tenant_id, first_name, phone, language, status, treatment_interest, gdpr_consent_given)
  VALUES ((SELECT id FROM _t), ${q(c.patientName)}, ${q(phone)}, ${q((c.patientLanguage||'en').slice(0,5))}, 'new', ${q(c.branchKey)}, false)
  RETURNING id
), cse AS (
  INSERT INTO cases (tenant_id, patient_id, case_number, branch_key, status, medical_eligibility, eligibility_note,
                     patient_country, patient_language, currency, estimated_value,
                     assigned_consultant_id, assigned_doctor_id, assigned_coordinator_id, assigned_interpreter_id,
                     created_at, updated_at)
  SELECT (SELECT id FROM _t), l.id, ${q(c.caseNumber)}, ${q(c.branchKey)}, ${q(c.status)}, ${q(c.doctorDecision||'pending')}, ${q(c.doctorNote)},
         ${q(c.patientCountryCode)}, ${q(c.patientLanguage)}, 'EUR', ${c.estimatedValueEur??'NULL'},
         (SELECT id FROM users WHERE email=${q(c.assignedConsultant?email(c.assignedConsultant):'x@x')}),
         (SELECT id FROM users WHERE email=${q(c.assignedDoctor?email(c.assignedDoctor):'x@x')}),
         (SELECT id FROM users WHERE email=${q(c.assignedCoordinator?email(c.assignedCoordinator):'x@x')}),
         (SELECT id FROM users WHERE email=${q(c.assignedInterpreter?email(c.assignedInterpreter):'x@x')}),
         ${q(c.lastActivityAt)}::timestamptz, ${q(c.lastActivityAt)}::timestamptz
  FROM l RETURNING id
)`);
  const parts=[];
  if(c.companions.length) parts.push(`comp AS (INSERT INTO case_companions (case_id, name, relationship) SELECT cse.id, v.name, v.rel FROM cse, (VALUES ${c.companions.map(x=>`(${q(x.name)},${q(x.relation||null)})`).join(',')}) AS v(name,rel) RETURNING 1)`);
  if(c.statusHistory.length) parts.push(`ev AS (INSERT INTO case_events (case_id, event_type, payload, created_at) SELECT cse.id,'status_change',v.p,v.at::timestamptz FROM cse, (VALUES ${c.statusHistory.map(h=>`(${j({status:h.status})},${q(h.at)})`).join(',')}) AS v(p,at) RETURNING 1)`);
  if(c.preAssessment&&c.preAssessment.length) parts.push(`asm AS (INSERT INTO case_assessments (case_id, template_key, answers, completed_at) SELECT cse.id, ${q(c.branchKey)}, ${j(c.preAssessment)}, now() FROM cse RETURNING 1)`);
  if(c.itinerary&&c.itinerary.length) parts.push(`itn AS (INSERT INTO case_timeline (case_id, day_offset, title, type) SELECT cse.id, v.d, v.t, 'consultation' FROM cse, (VALUES ${c.itinerary.map((s,i)=>`(${i},${j({tr:s.plan,label:s.day})})`).join(',')}) AS v(d,t) RETURNING 1)`);
  if(parts.length){ L.push(', '+parts.join(', ')); L.push(`SELECT 1;`); }
  else L.push(`SELECT 1 FROM cse;`);
}
L.push('COMMIT;');
// Written next to this script — the committed file IS the generated output, not a
// hand-copied snapshot of a /tmp file (which is how it used to drift).
const OUT = require('path').join(__dirname, 'seed-demo-tenant.sql');
fs.writeFileSync(OUT, L.join('\n'));
console.log('SQL yazildi. Satir:', L.join('\n').split('\n').length, '| Bayt:', fs.statSync(OUT).size);
console.log('personel:', staffRows.length, '| vaka:', D.cases.length);

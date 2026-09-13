'use strict';

// Seeds / purges the admin console's DEMO PLATFORM: the 11 example clinics of
// frontend/src/data/adminDemoData.ts as real tenant rows (ASAMA-3A Görev 3).
// Data comes from demo-platform-seed-data.json, which generate-admin-seed-data.js
// compiles from that TypeScript file — nothing here is retyped.
//
// WHAT IS REAL AND WHAT IS SYNTHETIC
//   * Every tenant is is_demo = true (migration 065) and slugged `demo-…`.
//   * Clinic profile, plan, status, branches, onboarding, compliance status,
//     subscription and WhatsApp line state are carried over from the dataset.
//   * AI usage and message traffic are SYNTHETIC ROWS in `messages`, so the
//     platform endpoints DERIVE the panel's numbers instead of storing them
//     (Baturay chose this over showing zeros). They carry no conversation
//     content, belong only to demo tenants, and their token counts are the two
//     documented averages below — cost on screen is computed from those.
//   * Consent is NEVER fabricated. Ek-1 counts stay NULL: there are no consent
//     records behind the dataset's numbers. The traffic lead has
//     gdpr_consent_given = false.
//   * The audit log is NOT seeded. audit_logs is append-only at the database
//     level (migration 070): a fabricated event written there could never be
//     removed again, so `--purge` could not undo it, and the legal trail would
//     carry events that never happened for good. The admin Audit screen shows
//     the real log — today, an honest empty state.
//   * Contact and user e-mails are rewritten to @demo.carenova.ai. The
//     dataset's own addresses (ops@novahairclinic.com, …) sit on domains that
//     may belong to real people, and anything that ever mails a tenant would
//     reach them.
//
// SAFETY: idempotent (purge-then-insert, one transaction), and purge refuses to
// run if any `demo-…` tenant is not flagged is_demo = true.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'demo-platform-seed-data.json'), 'utf8'));

const SLUG_PREFIX = 'demo-';
const EMAIL_DOMAIN = 'demo.carenova.ai';
const AI_MODEL = 'claude-sonnet-4-5';

// Synthetic traffic — documented averages, not measurements. A compiled system
// prompt (universal core + regulatory shield + branch template + clinic
// knowledge) is ~1.4k tokens; a WhatsApp-length reply ~200.
const AVG_PROMPT_TOKENS = 1450;
const AVG_COMPLETION_TOKENS = 210;
const FIRST_REPLY_SECONDS = 4.2;

const ROLE_ID = {
  klinik_sahibi: 9, operasyon_muduru: 10, hasta_danismani: 11,
  doktor: 12, koordinator: 13, tercuman: 14, muhasebe: 15,
};
const PLACEHOLDER_ROLES = ['hasta_danismani', 'doktor', 'koordinator', 'tercuman'];

const TENANT_STATUS = { active: 'active', trial: 'active', onboarding: 'pending', suspended: 'suspended' };
const SUB_STATUS = { current: 'active', overdue: 'past_due', trial: 'trialing' };

const slugOf = key => SLUG_PREFIX + key.replace(/^clinic-/, '');
const at = (now, offsetMs) => (offsetMs == null ? null : new Date(now.getTime() - offsetMs));

function asciiSlug(s) {
  return s.toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, c => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c]))
    .replace(/^dr\.?\s*/, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
}

function unusableHash() {
  // Not a bcrypt hash: bcrypt.compare() returns false for it, so nobody can log in.
  return `!demo-no-login-${crypto.randomBytes(8).toString('hex')}`;
}

async function purgePlatform(client) {
  const { rows: tenants } = await client.query(
    `SELECT id, slug, is_demo FROM tenants WHERE slug LIKE $1`, [`${SLUG_PREFIX}%`],
  );
  const unsafe = tenants.filter(t => t.is_demo !== true);
  if (unsafe.length) {
    throw new Error(`GUVENLIK: is_demo = false olan '${SLUG_PREFIX}…' tenant var (${unsafe.map(t => t.slug).join(', ')}). Silinmedi.`);
  }
  const ids = tenants.map(t => t.id);
  const counts = {};
  const del = async (label, sql, params) => { counts[label] = (await client.query(sql, params)).rowCount; };
  if (ids.length) {
    await del('messages', 'DELETE FROM messages WHERE tenant_id = ANY($1)', [ids]);
    await del('leads', 'DELETE FROM leads WHERE tenant_id = ANY($1)', [ids]);
    await del('whatsapp_configs', 'DELETE FROM whatsapp_configs WHERE tenant_id = ANY($1)', [ids]);
    await del('subscriptions', 'DELETE FROM subscriptions WHERE tenant_id = ANY($1)', [ids]);
    await del('tenant_compliance', 'DELETE FROM tenant_compliance WHERE tenant_id = ANY($1)', [ids]);
    // audit_logs is append-only: rows referencing these tenants/users keep the
    // event and lose the pointer (ON DELETE SET NULL, migration 070).
    await del('user_tenants', 'DELETE FROM user_tenants WHERE tenant_id = ANY($1)', [ids]);
    await del('users', 'DELETE FROM users WHERE tenant_id = ANY($1)', [ids]);
    await del('tenants', 'DELETE FROM tenants WHERE id = ANY($1) AND is_demo = true', [ids]);
  }
  await del('demo_requests', 'DELETE FROM demo_requests WHERE is_demo = true', []);
  return counts;
}

async function insertMessages(client, rows) {
  if (!rows.length) return;
  const col = k => rows.map(r => r[k]);
  await client.query(
    `INSERT INTO messages (tenant_id, lead_id, whatsapp_config_id, direction, content, message_type, status,
                           error_code, error_message, ai_generated, ai_model, ai_prompt_tokens, ai_completion_tokens,
                           created_at, sent_at, status_updated_at)
     SELECT $1, $2, $3, d, c, 'text', s, ec, em, ai, CASE WHEN ai THEN $4 END,
            CASE WHEN ai THEN $5::int END, CASE WHEN ai THEN $6::int END, ts,
            CASE WHEN d = 'outbound' THEN ts END, ts + interval '2 seconds'
     FROM unnest($7::text[], $8::text[], $9::text[], $10::text[], $11::text[], $12::boolean[], $13::timestamptz[])
          AS x(d, c, s, ec, em, ai, ts)`,
    [rows[0].tenantId, rows[0].leadId, rows[0].configId, AI_MODEL, AVG_PROMPT_TOKENS, AVG_COMPLETION_TOKENS,
      col('direction'), col('content'), col('status'), col('errorCode'), col('errorMessage'), col('ai'), col('ts')],
  );
}

async function seedPlatform(client) {
  // Every timestamp is an offset from the DATABASE's now() — not this machine's
  // clock, not a fixed date. A re-seed is one command; a forgotten one still
  // leaves a coherent timeline. (now() is fixed for the whole transaction.)
  const { rows: [{ now }] } = await client.query('SELECT now() AS now');
  const purged = await purgePlatform(client);
  const stats = { tenants: 0, users: 0, messages: 0, demoRequests: 0 };
  const { rows: [{ month_start: monthStart }] } = await client.query(`SELECT date_trunc('month', $1::timestamptz) AS month_start`, [now]);

  for (let idx = 0; idx < DATA.clinics.length; idx++) {
    const c = DATA.clinics[idx];
    const slug = slugOf(c.key);
    const { rows: [t] } = await client.query(
      `INSERT INTO tenants (name, slug, status, plan_tier, country, timezone, is_demo, active_branch_keys,
                            legal_name, city, currency, email, phone, ai_monthly_limit, ai_overage_policy,
                            onboarding_step, onboarding_step_started_at, created_at)
       VALUES ($1,$2,$3,$4,'TR',$5,true,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [c.name, slug, TENANT_STATUS[c.status], c.plan, c.timezone, c.branches, c.legalName, c.city, c.currency,
        `${slug.slice(SLUG_PREFIX.length)}@${EMAIL_DOMAIN}`, c.contactPhone, c.aiUsage.monthlyQuota, c.aiUsage.overagePolicy,
        c.onboarding.step, at(now, c.onboarding.stepStartedOffset), at(now, c.onboarding.stepStartedOffset) || now],
    );
    stats.tenants++;

    // Compliance STATUS (tri-state). Ek-1 counts deliberately left NULL.
    const co = c.compliance;
    await client.query(
      `INSERT INTO tenant_compliance (tenant_id, license_number, license_expires_at,
         complication_insurance_status, complication_insurance_expires_at, foreign_language_staff_ratio,
         verbis_status, cross_border_contract_status, cross_border_notified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [t.id, co.licenseOnFile ? c.licenseNumber : null, co.licenseOnFile ? at(now, c.licenseExpiryOffset) : null,
        // A policy whose end date has passed is 'expired', not 'active'.
        !co.complicationInsurance ? 'missing' : (co.complicationInsuranceExpiryOffset > 0 ? 'expired' : 'active'),
        co.complicationInsurance ? at(now, co.complicationInsuranceExpiryOffset) : null,
        co.foreignLanguageStaffRatio, co.verbisRegistered ? 'registered' : 'not_registered',
        co.crossBorderNotified ? 'signed' : 'missing', co.crossBorderNotified ? at(now, co.crossBorderNotifiedOffset) : null],
    );

    // Subscription: next charge = end of the current period (or of the trial).
    const next = at(now, c.billing.nextChargeOffset);
    const periodDays = c.billing.periodicity === 'annual' ? 365 : 30;
    await client.query(
      `INSERT INTO subscriptions (tenant_id, plan, status, trial_ends_at, current_period_start, current_period_end)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [t.id, c.plan, SUB_STATUS[c.billing.status],
        c.billing.status === 'trial' ? next : null,
        c.billing.status === 'trial' ? null : new Date(next.getTime() - periodDays * 86400000),
        c.billing.status === 'trial' ? null : next],
    );

    // Clinics still onboarding have no line yet (empty phoneNumberId): no config row.
    const w = c.whatsapp;
    const { rows: [cfg = { id: null }] } = !w.phoneNumberId ? { rows: [] } : await client.query(
      `INSERT INTO whatsapp_configs (tenant_id, display_name, phone_number_id, business_account_id, access_token,
                                    webhook_verify_token, is_active, display_phone_number)
       VALUES ($1,$2,$3,'demo-waba','demo-not-a-token','demo-not-a-token',$4,$5) RETURNING id`,
      [t.id, c.name, w.phoneNumberId, w.connected, w.displayNumber],
    );

    // Users: the dataset's named users, then neutral placeholders up to userCount.
    // Placeholders are "Personel NN" — inventing further realistic people adds
    // nothing but more fake identities.
    const named = DATA.clinicUsers.filter(u => u.clinicKey === c.key);
    const clinicSlug = slug.slice(SLUG_PREFIX.length);
    for (let i = 0; i < c.userCount; i++) {
      const u = named[i];
      const role = u ? u.role : (i === 0 ? 'klinik_sahibi' : PLACEHOLDER_ROLES[i % PLACEHOLDER_ROLES.length]);
      const [first, ...rest] = u ? u.name.split(' ') : ['Personel', String(i + 1).padStart(2, '0')];
      const email = u ? `${asciiSlug(u.name)}.${clinicSlug}@${EMAIL_DOMAIN}` : `personel${String(i + 1).padStart(2, '0')}.${clinicSlug}@${EMAIL_DOMAIN}`;
      const { rows: [row] } = await client.query(
        `INSERT INTO users (tenant_id, role_id, email, password_hash, first_name, last_name, is_active, last_login_at)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING id`,
        [t.id, ROLE_ID[role], email, unusableHash(), first, rest.join(' ') || '-', u ? at(now, u.lastLoginOffset) : null],
      );
      await client.query('INSERT INTO user_tenants (user_id, tenant_id, role_id) VALUES ($1,$2,$3)', [row.id, t.id, ROLE_ID[role]]);
      stats.users++;
    }

    // Traffic lead: one per clinic, carries the synthetic messages. No consent, no AI follow-up.
    const { rows: [lead] } = await client.query(
      `INSERT INTO leads (tenant_id, first_name, phone, language, status, gdpr_consent_given, ai_follow_up_enabled)
       VALUES ($1,'Sentetik trafik (demo)',$2,'tr','new',false,false) RETURNING id`,
      [t.id, `+90000${String(idx + 1).padStart(3, '0')}0000`],
    );

    const base = { tenantId: t.id, leadId: lead.id, configId: cfg.id };
    const rows = [];
    const healthError = DATA.healthErrors.find(e => e.clinicName === c.name);

    // Last 24h: inbound → AI reply pairs, evenly spread; the earliest pair
    // replies after FIRST_REPLY_SECONDS so avg first reply is derivable.
    const n24 = Math.max(w.messagesLast24h, w.errorsLast24h);
    const aiReplies = w.messagesLast24h > 0 ? Math.floor(n24 / 2) : n24;
    const inbound = n24 - aiReplies;
    const errorsLeft = { n: w.errorsLast24h };
    const span24 = 23 * 3600 * 1000;
    for (let i = 0; i < inbound; i++) {
      const ts = new Date(now.getTime() - span24 + (i * span24) / Math.max(inbound, 1));
      rows.push({ ...base, direction: 'inbound', content: '[demo — sentetik gelen mesaj, içerik yok]', status: 'read', errorCode: null, errorMessage: null, ai: false, ts });
    }
    for (let i = 0; i < aiReplies; i++) {
      const pairIn = inbound ? rows[Math.min(i, inbound - 1)].ts : new Date(now.getTime() - span24 + (i * span24) / aiReplies);
      const ts = new Date(pairIn.getTime() + FIRST_REPLY_SECONDS * 1000 + i * 17);
      const failed = errorsLeft.n > 0 && i >= aiReplies - w.errorsLast24h;
      if (failed) errorsLeft.n--;
      // The dataset names one error per clinic; it goes on the last failure,
      // any further failures get a generic message at their own time.
      const named = failed && errorsLeft.n === 0 && healthError;
      rows.push({
        ...base, direction: 'outbound', content: '[demo — sentetik AI yanıtı, içerik yok]',
        status: failed ? 'failed' : 'delivered',
        errorCode: failed ? 'DEMO' : null,
        errorMessage: failed ? (named ? healthError.message : 'Gönderim başarısız (demo)') : null,
        ai: true, ts: named ? at(now, healthError.atOffset) : ts,
      });
    }

    // Earlier this month: the rest of usedThisMonth as delivered AI replies.
    const older = Math.max(0, c.aiUsage.usedThisMonth - aiReplies);
    const olderEnd = new Date(now.getTime() - 24 * 3600 * 1000);
    const olderSpan = Math.max(0, olderEnd - new Date(monthStart));
    for (let i = 0; i < older; i++) {
      const ts = new Date(new Date(monthStart).getTime() + (olderSpan * i) / Math.max(older, 1));
      rows.push({ ...base, direction: 'outbound', content: '[demo — sentetik AI yanıtı, içerik yok]', status: 'delivered', errorCode: null, errorMessage: null, ai: true, ts });
    }
    await insertMessages(client, rows);
    stats.messages += rows.length;
  }

  for (const r of DATA.demoRequests) {
    await client.query(
      `INSERT INTO demo_requests (name, email, clinic_name, city, phone, branch_key, status, notes, is_demo, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$9)`,
      [r.name, `${asciiSlug(r.name)}@${EMAIL_DOMAIN}`, r.clinicName, r.city, r.phone, r.branchKey, r.status, r.notes, at(now, r.createdOffset)],
    );
    stats.demoRequests++;
  }

  // carenova-demo (the app-side demo tenant with the 18 cases) is the 12th demo
  // clinic. It is fully set up, so it is "live" in onboarding terms.
  await client.query(
    `UPDATE tenants SET onboarding_step = 7, onboarding_step_started_at = COALESCE(onboarding_step_started_at, created_at),
            city = COALESCE(city, 'İstanbul')
     WHERE slug = 'carenova-demo' AND is_demo = true`,
  );

  return { purged, stats };
}

module.exports = { seedPlatform, purgePlatform, SLUG_PREFIX };

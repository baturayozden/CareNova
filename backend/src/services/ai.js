const Anthropic      = require('@anthropic-ai/sdk');
const { pool }       = require('../db/index');
const { generateSlots } = require('../routes/appointments');
const { createLead, normalizePhone } = require('./leadStore');
const promptCompiler = require('./promptCompiler');
const outputGuard    = require('./outputGuard');

const MODEL = 'claude-sonnet-4-5';

// ── System prompt (GECE-4-BRIEFI.md Bölüm A) ────────────────────────────────
//
// This used to be ~90 lines of dental-flavored single-block text (see git
// history). It's now a thin adapter over services/promptCompiler.js's 6
// independently-testable layers — see that file for the actual rule text
// and services/__tests__/promptCompiler.test.js for what's verified about
// it. Keeping the name/signature close to the old one minimises the diff
// at every call site below; the real logic moved out.
function buildSystemPrompt({
  tone = 'professional', knowledgeContext = '', branchContext = '',
  welcomeBack = false, outOfHours = false, clinicTimezone = 'Europe/Istanbul',
  patientName = '', branchTemplate = null, objectionType = null,
  patientCountry = null, patientLanguage = null, patientTimezone = null,
}) {
  return promptCompiler.compileSystemPrompt({
    tone, knowledgeContext, branchContext, welcomeBack, outOfHours,
    clinicTimezone, patientName, branchTemplate, objectionType,
    patientCountry, patientLanguage, patientTimezone,
  });
}

// ── Knowledge base loader ─────────────────────────────────────────────────────

async function loadKnowledge(tenantId) {
  try {
    const { rows } = await pool.query(
      `SELECT category, title, content FROM clinic_knowledge
       WHERE tenant_id = $1 AND is_active = TRUE
       ORDER BY category, created_at`,
      [tenantId],
    );
    if (!rows.length) return '';

    // Group by category
    const grouped = {};
    for (const r of rows) {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push(`  [${r.title}]\n  ${r.content}`);
    }

    return Object.entries(grouped)
      .map(([cat, items]) => `### ${cat.toUpperCase()}\n${items.join('\n\n')}`)
      .join('\n\n');
  } catch {
    return '';
  }
}

// ── AI Settings loader ────────────────────────────────────────────────────────

async function loadAiSettings(tenantId) {
  try {
    const { rows } = await pool.query(
      `SELECT t.timezone AS tenant_timezone, cas.*
       FROM tenants t
       LEFT JOIN clinic_ai_settings cas ON cas.tenant_id = t.id
       WHERE t.id = $1`,
      [tenantId],
    );
    if (!rows.length) return null;
    return rows[0];
  } catch {
    return null;
  }
}

// ── Branch loader ─────────────────────────────────────────────────────────────

async function loadBranches(tenantId) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, address, postcode, linked_tenant_id
         FROM clinic_branches
        WHERE tenant_id = $1 AND is_active = TRUE
        ORDER BY sort_order`,
      [tenantId],
    );
    return rows;
  } catch {
    return [];
  }
}

// ── Case File / branch template loaders (GECE-4-BRIEFI.md Bölüm A) ─────────
//
// NOTE the naming collision this deliberately avoids: `clinic_branches`
// above is a PHYSICAL LOCATION (a clinic's second office), completely
// unrelated to `branch_templates` (a MEDICAL SPECIALTY — hair transplant,
// dental, ...). Both call themselves "branch" in this codebase for
// historical reasons; the functions below are named *BranchTemplate*
// specifically to keep that distinction visible at every call site.

function mapBranchTemplateRow(row) {
  if (!row) return null;
  return {
    key: row.key,
    displayName: row.display_name,
    aiPricingAuthority: row.ai_pricing_authority,
    preAssessmentQuestions: row.pre_assessment_questions,
    requiredMedia: row.required_media,
    redFlags: row.red_flags,
    objectionStrategies: row.objection_strategies || {},
    knowledgeSeed: row.knowledge_seed,
  };
}

async function loadBranchTemplate(branchKey) {
  if (!branchKey) return null;
  try {
    const { rows } = await pool.query(`SELECT * FROM branch_templates WHERE key = $1`, [branchKey]);
    return mapBranchTemplateRow(rows[0]);
  } catch {
    return null;
  }
}

// A lead becomes a case at qualification time (leads.case_id, nullable —
// migration 057); most leads never have one. Returns null rather than
// throwing so every caller can treat "no case yet" as the common case.
async function loadCaseForLead(leadId, tenantId) {
  if (!leadId || !tenantId) return null;
  try {
    const { rows } = await pool.query(
      `SELECT c.* FROM cases c
         JOIN leads l ON l.case_id = c.id
        WHERE l.id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL`,
      [leadId, tenantId],
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

// Feeds outputGuard's range_from_photo/range_after_imaging enforcement —
// "yeterli kalitede" (Bölüm B) means quality_ok = TRUE, not just present.
// 'scan'/'report' are the medical-imaging kinds (panoramic/CBCT/MR/blood
// work); a plain 'photo' does not satisfy range_after_imaging's stricter
// requirement even if quality_ok.
async function loadCaseMediaReadiness(caseId) {
  if (!caseId) return { hasQualifyingPhoto: false, hasImaging: false };
  try {
    const { rows } = await pool.query(
      `SELECT kind, quality_ok FROM case_media WHERE case_id = $1 AND quality_ok = TRUE`,
      [caseId],
    );
    return {
      hasQualifyingPhoto: rows.some(r => r.kind === 'photo'),
      hasImaging: rows.some(r => r.kind === 'scan' || r.kind === 'report'),
    };
  } catch {
    return { hasQualifyingPhoto: false, hasImaging: false };
  }
}

/** Resolve a branch by name (case-insensitive) from a pre-loaded branch list. */
function resolveBranch(branches, branchName) {
  if (!branchName || !branches.length) return null;
  const q = branchName.toLowerCase().trim();
  return branches.find(b => b.name.toLowerCase() === q) || null;
}

// ── Working hours check ───────────────────────────────────────────────────────

async function isWithinWorkingHours(tenantId) {
  try {
    const now   = new Date();
    const dow   = now.getDay();                              // 0=Sun … 6=Sat
    const hhmm  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const { rows } = await pool.query(
      `SELECT start_time, end_time FROM clinic_availability
       WHERE tenant_id = $1 AND day_of_week = $2 AND is_active = TRUE`,
      [tenantId, dow],
    );
    if (!rows.length) return false;   // no rule = closed
    const { start_time, end_time } = rows[0];
    return hhmm >= start_time.slice(0, 5) && hhmm < end_time.slice(0, 5);
  } catch {
    return true;   // fail open — don't block messages on DB errors
  }
}

// ── Slot tool definition ──────────────────────────────────────────────────────

const SLOT_TOOL = {
  name: 'get_available_slots',
  description: 'Get available appointment slots for a given date at this clinic. Use when the patient asks about booking, availability, or specific times. If the clinic has multiple branches and the patient has chosen one, pass branch_name.',
  input_schema: {
    type: 'object',
    properties: {
      date:        { type: 'string', description: 'Date in YYYY-MM-DD format' },
      branch_name: { type: 'string', description: 'Branch name exactly as listed in BRANCHES (optional; omit for single-branch clinics)' },
    },
    required: ['date'],
  },
};

const CREATE_APPT_TOOL = {
  name: 'create_appointment',
  description: 'Book an appointment ONLY AFTER the patient has explicitly confirmed the specific date, time, treatment, their name, AND (for multi-branch clinics) their preferred location. Never call speculatively.',
  input_schema: {
    type: 'object',
    properties: {
      appointment_date: { type: 'string', description: 'YYYY-MM-DD — use the exact date from the date reference list, never calculate' },
      appointment_time: { type: 'string', description: 'HH:MM 24-hour — must be one of the free slots offered by get_available_slots' },
      patient_name:     { type: 'string', description: 'Confirmed full name of the patient' },
      treatment_type:   { type: 'string', description: 'e.g. hair transplant consultation, initial assessment (optional)' },
      duration_minutes: { type: 'number', description: 'Defaults to 30 if unknown' },
      branch_name:      { type: 'string', description: 'Branch name exactly as listed in BRANCHES (required for multi-branch clinics once patient has chosen)' },
    },
    required: ['appointment_date', 'appointment_time', 'patient_name'],
  },
};

// ── Slot tool handler ─────────────────────────────────────────────────────────

async function getAvailableSlotsForTenant(tenantId, date, branches = [], branchName = null) {
  try {
    const d   = new Date(date + 'T12:00:00'); // noon UTC — avoids day shift in any timezone
    const dow = d.getDay(); // 0=Sun … 6=Sat

    // If a branch is named and it bridges to another tenant, check that tenant's availability
    let effectiveTenantId = tenantId;
    if (branchName) {
      const branch = resolveBranch(branches, branchName);
      if (branch?.linked_tenant_id) {
        effectiveTenantId = branch.linked_tenant_id;
        console.log(`[get_available_slots] cross-tenant: branch="${branchName}" → tenant=${effectiveTenantId}`);
      }
    }

    const { rows } = await pool.query(
      `SELECT start_time, end_time, slot_duration_minutes FROM clinic_availability
       WHERE tenant_id = $1 AND day_of_week = $2 AND is_active = TRUE`,
      [effectiveTenantId, dow],
    );
    if (!rows.length) return { date, closed: true, slots: [] };

    const rule      = rows[0];
    const allSlots  = generateSlots(rule.start_time, rule.end_time, rule.slot_duration_minutes);

    const { rows: booked } = await pool.query(
      `SELECT appointment_time FROM appointments
       WHERE tenant_id = $1 AND appointment_date = $2
         AND status NOT IN ('cancelled')`,
      [effectiveTenantId, date],
    );
    const bookedTimes = new Set(booked.map(b => b.appointment_time.slice(0, 5)));
    const freeSlots   = allSlots.filter(s => !bookedTimes.has(s));

    return { date, closed: false, slots: freeSlots };
  } catch (err) {
    return { date, error: err.message, slots: [] };
  }
}

// ── Appointment creation handler ──────────────────────────────────────────────

async function createAppointmentForTenant({ tenantId, leadId, patientPhone, appointment_date, appointment_time, patient_name, treatment_type, duration_minutes, branches = [], branchName = null }) {
  try {
    if (!tenantId || !patientPhone || !appointment_date || !appointment_time || !patient_name) {
      return { success: false, reason: 'missing_data', message: 'Missing required booking info; do not claim it is booked.' };
    }

    // ── Branch resolution ────────────────────────────────────────────────────
    let effectiveTenantId = tenantId;
    let effectiveLeadId   = leadId;
    let resolvedBranchId  = null;

    if (branchName) {
      const branch = resolveBranch(branches, branchName);
      if (branch) {
        if (branch.linked_tenant_id) {
          // ── Cross-tenant bridge ──────────────────────────────────────────
          effectiveTenantId = branch.linked_tenant_id;
          console.log(`[create_appointment] cross-tenant bridge: branch="${branchName}" → tenant=${effectiveTenantId}`);

          // Fetch source tenant name for referral note
          const { rows: srcRows } = await pool.query(
            `SELECT name FROM tenants WHERE id = $1`, [tenantId],
          );
          const sourceName = srcRows[0]?.name || 'partner clinic';

          // Find or create lead in target tenant
          const normalizedPhone = normalizePhone(patientPhone);
          const nameParts  = patient_name.trim().split(/\s+/);
          const firstName  = nameParts[0];
          const lastName   = nameParts.slice(1).join(' ') || '';
          try {
            await createLead({
              tenantId:          effectiveTenantId,
              firstName,
              lastName,
              phone:             patientPhone,
              source:            'partner_referral',
              notes:             `Referred from ${sourceName} WhatsApp (branch: ${branchName})`,
              aiFollowUpEnabled: false,  // source WhatsApp handles the conversation
            });
          } catch (dupErr) {
            if (dupErr.code !== 'DUPLICATE_PHONE') throw dupErr;
            // Lead already exists in target — that's fine, fall through
          }

          // Resolve the target lead id
          const { rows: tgtLead } = await pool.query(
            `SELECT id FROM leads WHERE tenant_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1`,
            [effectiveTenantId, normalizedPhone],
          );
          effectiveLeadId  = tgtLead[0]?.id || null;
          resolvedBranchId = null; // target tenant manages its own branch layout
        } else {
          // Same-tenant named branch
          resolvedBranchId = branch.id;
        }
      } else {
        console.warn(`[create_appointment] branch_name="${branchName}" not found — booking without branch`);
      }
    }

    // ── Build notes for cross-tenant bridge (branch info would otherwise be lost) ──
    let bookingNotes = null;
    if (branchName && !resolvedBranchId) {
      // cross-tenant: branch_id stays NULL in target tenant; record branch name in notes
      const { rows: srcRows2 } = await pool.query(
        `SELECT name FROM tenants WHERE id = $1`, [tenantId],
      );
      const sourceName2 = srcRows2[0]?.name || 'partner clinic';
      bookingNotes = `Booked for ${branchName} branch (partner referral from ${sourceName2})`;
    }

    // ── Clash check in effective tenant ─────────────────────────────────────
    const clash = await pool.query(
      `SELECT 1 FROM appointments
        WHERE tenant_id = $1 AND appointment_date = $2 AND appointment_time = $3
          AND status NOT IN ('cancelled') LIMIT 1`,
      [effectiveTenantId, appointment_date, appointment_time],
    );
    if (clash.rows.length) {
      return { success: false, reason: 'slot_taken', message: 'That time was just taken. Apologise and offer other free slots.' };
    }

    // ── Insert into effective tenant ─────────────────────────────────────────
    const ins = await pool.query(
      `INSERT INTO appointments
         (tenant_id, lead_id, patient_name, patient_phone, treatment_type,
          appointment_date, appointment_time, duration_minutes, branch_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [effectiveTenantId, effectiveLeadId || null, patient_name, patientPhone,
       treatment_type || null, appointment_date, appointment_time,
       duration_minutes || 30, resolvedBranchId, bookingNotes],
    );
    console.log(`[create_appointment] booked id=${ins.rows[0].id} tenant=${effectiveTenantId} ${appointment_date} ${appointment_time} (pending)`);

    // Fire-and-forget: activation flag
    pool.query(
      `UPDATE tenants SET activated = TRUE, activated_at = now(), first_booking_at = now()
       WHERE id = $1 AND activated IS NOT TRUE`,
      [effectiveTenantId],
    ).catch(() => {});

    // Fire-and-forget: alert the EFFECTIVE tenant's staff
    const { sendAppointmentAlert } = require('../utils/email');
    pool.query('SELECT name, notification_email FROM tenants WHERE id = $1', [effectiveTenantId])
      .then(({ rows }) => sendAppointmentAlert({
        to:          rows[0]?.notification_email,
        clinicName:  rows[0]?.name,
        patientName: patient_name,
        treatment:   treatment_type || null,
        date:        appointment_date instanceof Date ? appointment_date.toISOString().slice(0, 10) : appointment_date,
        time:        appointment_time,
      }))
      .catch(() => {});

    // Fire-and-forget: booking confirmation email + SMS to patient
    const { sendBookingConfirmation } = require('./appointmentReminders');
    sendBookingConfirmation(ins.rows[0].id)
      .catch(err => console.error('[booking-confirm]', err.message));

    return { success: true, appointment_id: ins.rows[0].id, date: appointment_date, time: appointment_time, status: 'requested', message: 'Request received. Tell the patient their appointment request has been received and the team will review and confirm it shortly. Do NOT say it is already confirmed or definitely booked.' };
  } catch (e) {
    console.error('[create_appointment] error:', e.message);
    return { success: false, reason: 'error', message: 'Could not book right now; tell the patient the team will follow up.' };
  }
}

// ── Escalation detector ───────────────────────────────────────────────────────

function shouldEscalate(text, keywords = []) {
  if (!text || !keywords.length) return false;
  const t = text.toLowerCase();
  return keywords.some(kw => t.includes(kw.toLowerCase().trim()));
}

// ── Returning patient lookup ──────────────────────────────────────────────────

async function findExistingLead(phone, tenantId) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, status, created_at FROM leads
       WHERE phone = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [phone, tenantId],
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

// ── Scenarios ─────────────────────────────────────────────────────────────────

const SCENARIOS = {
  NEW_ENQUIRY:        'new_enquiry',
  FINANCE_OBJECTION:  'finance_objection',
  COLD_LEAD:          'cold_lead',
  MISSED_CALL:        'missed_call',
  APPOINTMENT_REQUEST:'appointment_request',
  EMERGENCY:          'emergency',
};

const SCENARIO_CONTEXT = {
  new_enquiry:          'The patient is enquiring about a medical treatment.',
  finance_objection:    'The patient has expressed concern about cost or asked about payment plans.',
  cold_lead:            'This patient has not responded for 3+ days. Re-engage warmly without being pushy.',
  missed_call:          'The patient missed a call from the clinic.',
  appointment_request:  'The patient wants to book or reschedule an appointment.',
  emergency:            'The patient has an urgent medical issue requiring immediate escalation.',
};

// ── Language detection ────────────────────────────────────────────────────────

function detectLanguage(text) {
  if (!text) return 'en';
  if (/[؀-ۿ]/.test(text)) return 'ar';
  // ı and İ excluded: Turkish keyboard users often type English with ı/İ ("ıs there", "İ am"),
  // causing false positives. Only strong Turkish-exclusive characters qualify alone.
  if (/[çğşöüÇĞŞÖÜ]/.test(text)) return 'tr';
  // Distinctly-Turkish keywords only — NO words identical in English (e.g. "implant",
  // "veneer") or an English message would be misdetected as Turkish.
  if (/\b(merhaba|selam|nasıl|nasil|diş|dis|fiyat|bilgi|lütfen|lutfen|teşekkür|tesekkur|evet|hayır|hayir|beyazlatma|ortodonti|randevu|dolgu|çekim|cekim|kaplama|gülüş|gulus|istiyorum|alabilir|mümkün|mumkun|tedavi|kanal|ağrı|agri|var mı|var mi|ne kadar)\b/i.test(text)) return 'tr';
  return 'en';
}

/**
 * detectConversationLanguage — language detection that uses conversation history.
 *
 * Problem: short/ambiguous ASCII messages ("ok", "arın 4pm", "4pm", "yes") give no
 * language signal on their own, causing detectLanguage to fall back to 'en' even when
 * the patient has been writing Turkish throughout. This function fixes that by consulting
 * recent inbound messages when the current text is ambiguous.
 *
 * Logic:
 *   1. Strong char-based signal in current message → return immediately (definitive).
 *   2. Keyword match in current message → return immediately (e.g. "randevu", "evet").
 *   3. Current is ambiguous (ASCII, short, no signal) → scan last 6 inbound messages,
 *      newest-first, and return the first non-'en' language found ("last strong signal wins").
 *   4. No signal anywhere → 'en' fallback.
 */
function detectConversationLanguage(currentText, messageHistory = []) {
  // Step 1 — strong character-level signal in current message
  if (/[؀-ۿ]/.test(currentText)) return 'ar';
  if (/[çğşöüÇĞŞÖÜ]/.test(currentText)) return 'tr';

  // Step 2 — keyword match in current message
  const currentLang = detectLanguage(currentText);
  if (currentLang !== 'en') return currentLang;

  // Step 3 — if current text is a substantial ASCII sentence (≥4 words), trust 'en' directly.
  // Short 1-3 word responses ("ok", "4pm", "arın 4pm") are ambiguous and need history;
  // longer phrases ("I want to book", "what times do you have") are clearly English.
  const wordCount = currentText.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount >= 4) return 'en';

  // Step 4 — current message is ambiguous; walk inbound history newest-first
  const inbound = messageHistory
    .filter(m => m.direction === 'inbound' && m.content)
    .slice(-6)
    .reverse();

  for (const msg of inbound) {
    const lang = detectLanguage(msg.content);
    if (lang !== 'en') return lang;
  }

  // Step 4 — no non-English signal found anywhere
  return 'en';
}

// ── Scenario classification ───────────────────────────────────────────────────

function classifyScenario(text) {
  if (!text) return SCENARIOS.NEW_ENQUIRY;
  const t = text.toLowerCase();

  if (/emergency|severe pain|unbearable|bleeding|swollen|abscess|acil|şiddetli ağrı|طارئ|ألم شديد/.test(t))
    return SCENARIOS.EMERGENCY;

  if (/book|appointment|schedule|available|slot|when can|randevu|موعد/.test(t))
    return SCENARIOS.APPOINTMENT_REQUEST;

  if (/expens|afford|cost|price|payment|financ|cheap|budget|pahal|ödeme|taksit|fiyat|غالي|تكلفة/.test(t))
    return SCENARIOS.FINANCE_OBJECTION;

  if (/missed|called|ring|rang|callback|call back|aradım|geri ara|فاتني|اتصال/.test(t))
    return SCENARIOS.MISSED_CALL;

  if (/treatment|procedure|consultation|tedavi|işlem|علاج/.test(t))
    return SCENARIOS.NEW_ENQUIRY;

  return SCENARIOS.NEW_ENQUIRY;
}

// ── Objection detection (GECE-4-BRIEFI.md Bölüm D.1) ──────────────────────
//
// Replaces the old 8-value generic taxonomy with the 11-type health-tourism
// taxonomy that promptCompiler.js/outputGuard.js were already written
// against (GENERIC_OBJECTION_GUIDANCE, MUST_ESCALATE_OBJECTIONS, and
// branch_templates.objection_strategies — migration 062 — all use these
// exact keys). Until this change, detectObjection returned values like
// 'trust_concern' that promptCompiler's MUST_ESCALATE_OBJECTIONS
// (`trust_surgeon`/`safety_fear`) never matched — the mandatory
// doctor-card/video-consultation escalation was silently unreachable.

const OBJECTION_TYPES = {
  price_shock:          'price_shock',
  trust_surgeon:        'trust_surgeon',
  trust_clinic:         'trust_clinic',
  safety_fear:          'safety_fear',
  aftercare_fear:       'aftercare_fear',
  travel_friction:      'travel_friction',
  timing:               'timing',
  comparison_shopping:  'comparison_shopping',
  language_barrier:     'language_barrier',
  partner_approval:     'partner_approval',
  financing:            'financing',
  general_enquiry:      'general_enquiry',
};

function detectObjection(text) {
  if (!text) return OBJECTION_TYPES.general_enquiry;
  const t = text.toLowerCase();

  // 🔴 trust_surgeon / safety_fear are checked first — these are the two
  // objections that trigger mandatory escalation in promptCompiler.js, so a
  // message that also happens to mention price or timing should still be
  // caught here first.
  if (/who is the doctor|who is the surgeon|which doctor|doctor'?s experience|is the (doctor|surgeon) (good|qualified|experienced)|doktor kim|cerrah kim|hangi doktor|doktor deneyimli mi|من هو الطبيب|من الجراح|خبرة الطبيب/.test(t))
    return OBJECTION_TYPES.trust_surgeon;
  if (/is it safe|does it hurt|will it hurt|complication|risky|scared|nervous|anxious|afraid|güvenli mi|ağrır mı|acıyor mu|korkuyorum|riskli|komplikasyon|آمن\?|هل هو آمن|يؤلم|خائف|مخاطر|مضاعفات/.test(t))
    return OBJECTION_TYPES.safety_fear;

  if (/is (this|the) clinic (real|legit|legitimate)|clinic reviews|reviews? (of|about|for) (this |the )?clinic|licensed clinic|trustworthy clinic|klinik güvenilir mi|klinik gerçek mi|kliniğin lisansı|هل العيادة موثوقة|تراخيص العيادة|تقييمات العيادة/.test(t))
    return OBJECTION_TYPES.trust_clinic;

  if (/what if something goes wrong after|after i go home|aftercare|follow.?up care|ameliyat sonrası|sonrasında (bir )?sorun|eve döndükten sonra|بعد عودتي|متابعة بعد العملية|إذا حدثت مشكلة بعد/.test(t))
    return OBJECTION_TYPES.aftercare_fear;

  if (/\bvisa\b|flight|how do i (get|travel) there|too far|travel arrangements|vize|uçuş|nasıl gelirim|seyahat düzenlemeleri|تأشيرة|رحلة الطيران|كيف أصل|ترتيبات السفر/.test(t))
    return OBJECTION_TYPES.travel_friction;

  if (/do you speak|don'?t understand|(anyone|someone) who speaks|can we talk in (arabic|turkish|my language)|i don'?t speak english|konuşan (biri|bir kişi) var|i̇ngilizce bilmiyorum|anlamıyorum|kendi dilimde|هل تتحدث|لا أفهم|بلغتي/.test(t))
    return OBJECTION_TYPES.language_barrier;

  if (/ask my (husband|wife|partner|family)|check with my (husband|wife|partner|family)|need to discuss with|eşime sormam|ailemle konuşmam|eşimle görüşmem|زوجي|زوجتي|أستشير عائلتي|أسأل عائلتي/.test(t))
    return OBJECTION_TYPES.partner_approval;

  if (/other clinic|checking around|got a quote|comparing (clinics|prices)|başka(\s+\w+){0,2}\s+klinik|karşılaştırıyorum|fiyat karşılaştır|عيادة أخرى|أقارن (الأسعار|العيادات)|عرض سعر آخر/.test(t))
    return OBJECTION_TYPES.comparison_shopping;

  if (/not ready|maybe later|next month|not yet|dates don'?t work|can'?t make (it|that date)|not available on|hazır değil|müsait değil|sonra düşünürüm|لست جاهزاً|لاحقاً|لا يناسبني الموعد|غير متاح/.test(t))
    return OBJECTION_TYPES.timing;

  if (/payment plan|pay monthly|instalments?|installments?|\bfinanc(e|ing)\b|taksit|ödeme planı|أقساط|تقسيط|تمويل/.test(t))
    return OBJECTION_TYPES.financing;

  if (/too expensive|can'?t afford|cannot afford|out of budget|how much|what.?s the cost|what.?s the price|pahal[ıi]|bütçe|fiyat ne|ne kadar tutar|غالي جداً|كم التكلفة|كم السعر/.test(t))
    return OBJECTION_TYPES.price_shock;

  return OBJECTION_TYPES.general_enquiry;
}

// ── WhatsApp reply sanitiser (deterministic, applied after AI generation) ────

function sanitizeForWhatsApp(text) {
  if (!text) return text;
  return text
    .replace(/^\s*[•·▪◦‣]\s*/gm, '- ')  // bullet at line start → "- "
    .replace(/[•·▪◦‣]\s*/g, '- ')        // bullet mid-line (edge case)
    .replace(/\*\*(.+?)\*\*/gs, '*$1*')  // **bold** → *bold* (WhatsApp single-asterisk)
    .replace(/^#{1,6}\s*/gm, '')          // strip markdown headings
    .replace(/\n{3,}/g, '\n\n');          // collapse excess blank lines
}

// ── Generate follow-up message ────────────────────────────────────────────────

async function generateFollowUp({ incomingText, language, scenario, patientName, messageHistory = [], tenantId, withinHours = true, leadId = null, patientPhone = null }) {
  const client = new Anthropic();

  // Load clinic-specific context
  const [knowledgeContext, aiSettings, branches, caseRow] = await Promise.all([
    tenantId ? loadKnowledge(tenantId)   : Promise.resolve(''),
    tenantId ? loadAiSettings(tenantId)  : Promise.resolve(null),
    tenantId ? loadBranches(tenantId)    : Promise.resolve([]),
    (tenantId && leadId) ? loadCaseForLead(leadId, tenantId) : Promise.resolve(null),
  ]);
  const branchTemplate = caseRow ? await loadBranchTemplate(caseRow.branch_key) : null;
  const mediaReadiness = caseRow ? await loadCaseMediaReadiness(caseRow.id) : { hasQualifyingPhoto: false, hasImaging: false };
  const objectionType  = detectObjection(incomingText);

  // Build branch context block for system prompt (only when >1 active branch)
  let branchContext = '';
  if (branches.length > 1) {
    const list = branches.map(b => {
      const parts = [b.name];
      if (b.address) parts.push(b.address);
      if (b.postcode) parts.push(b.postcode);
      return `- ${parts.join(', ')}`;
    }).join('\n');
    branchContext = `BRANCHES: This clinic has multiple locations:\n${list}\nWhen booking an appointment, ALWAYS ask which location the patient prefers BEFORE confirming the slot. Include the chosen location in your booking confirmation message.\n`;
  }

  const tone           = aiSettings?.tone     || 'professional';
  const clinicTimezone = aiSettings?.tenant_timezone || aiSettings?.timezone || 'Europe/London';
  const systemPrompt   = buildSystemPrompt({
    tone, knowledgeContext, branchContext, outOfHours: !withinHours, clinicTimezone,
    patientName: patientName || '', branchTemplate, objectionType,
    patientCountry: caseRow?.patient_country || null,
    patientLanguage: caseRow?.patient_language || language,
    patientTimezone: caseRow?.patient_timezone || null,
  });

  const scenarioHint = SCENARIO_CONTEXT[scenario] || SCENARIO_CONTEXT.new_enquiry;

  const LANG_LABELS = { en: 'English', tr: 'Turkish', ar: 'Arabic' };
  const langLabel = LANG_LABELS[language] || 'English';

  const userPrompt = [
    `Scenario: ${scenarioHint}`,
    `Patient name: ${patientName || 'the patient'}`,
    `Patient message: "${incomingText}"`,
    `CRITICAL: The patient's CURRENT message is in ${langLabel}. You MUST reply ONLY in ${langLabel}, regardless of any earlier messages in this conversation.`,
  ].join('\n');

  // Build text-only prior messages — plain strings, roles strictly alternating.
  // Tool_use / tool_result blocks are NEVER included in history: they belong only
  // in the current turn's tool-calling loop. Sending orphan tool_use in history
  // causes Anthropic 400 "tool_use found without tool_result" errors.
  const rawHistory = messageHistory
    .filter(m => m.content && typeof m.content === 'string' && m.content.trim())
    .slice(-8)
    .map(m => ({
      role:    m.direction === 'outbound' ? 'assistant' : 'user',
      content: m.content.trim(),
    }));

  // Collapse consecutive same-role entries (Anthropic rejects non-alternating roles)
  const priorMessages = [];
  for (const msg of rawHistory) {
    const last = priorMessages[priorMessages.length - 1];
    if (last && last.role === msg.role) {
      last.content += '\n' + msg.content;
    } else {
      priorMessages.push({ ...msg });
    }
  }
  // Anthropic requires first message to be 'user'
  while (priorMessages.length > 0 && priorMessages[0].role !== 'user') {
    priorMessages.shift();
  }

  const messages = [...priorMessages, { role: 'user', content: userPrompt }];

  const FALLBACK_REPLY = {
    tr: 'Özür dilerim, şu an bir aksaklık yaşıyoruz — lütfen tekrar dener misiniz? 🙏',
    ar: 'عذرًا، حدث خطأ ما — هل يمكنك المحاولة مرة أخرى؟ 🙏',
    en: 'Sorry, we ran into a problem right now — please try again in a moment. 🙏',
  };

  // GECE-4-BRIEFI.md Bölüm B: a guard block must never go silent either —
  // the patient still gets a warm, honest reply, just not the one the
  // model produced. "insana eskale et" happens one layer up, in
  // processIncoming, which sees guardBlocked=true on the return value.
  const GUARD_BLOCKED_REPLY = {
    tr: 'Bu konuda size en doğru bilgiyi verebilmek için ekibimizden birinin sizinle görüşmesi gerekiyor — birazdan size dönüş yapacaklar. 🙏',
    ar: 'لتقديم المعلومات الصحيحة لك، يحتاج أحد أعضاء فريقنا للتواصل معك — سيتم التواصل معك قريبًا. 🙏',
    en: "To give you the exact details on this, one of our team needs to follow up with you directly — they'll be in touch shortly. 🙏",
  };

  // ── Tool-calling loop (max 3 turns to prevent infinite loops) ───────────────
  let response;
  try {
    for (let turn = 0; turn < 3; turn++) {
      response = await client.messages.create({
        model:      MODEL,
        max_tokens: 400,
        system:     systemPrompt,
        tools:      [SLOT_TOOL, CREATE_APPT_TOOL],
        messages,
      });

      if (response.stop_reason !== 'tool_use') break;

      // Find the tool_use block
      const toolBlock = response.content.find(b => b.type === 'tool_use');
      if (!toolBlock) break;

      // Execute tool — always safe, never throws out
      let toolResult;
      try {
        if (toolBlock.name === 'get_available_slots') {
          toolResult = await getAvailableSlotsForTenant(tenantId, toolBlock.input.date, branches, toolBlock.input.branch_name || null);
        } else if (toolBlock.name === 'create_appointment') {
          toolResult = await createAppointmentForTenant({
            tenantId, leadId, patientPhone,
            appointment_date: toolBlock.input.appointment_date,
            appointment_time: toolBlock.input.appointment_time,
            patient_name:     toolBlock.input.patient_name,
            treatment_type:   toolBlock.input.treatment_type,
            duration_minutes: toolBlock.input.duration_minutes,
            branches,
            branchName:       toolBlock.input.branch_name || null,
          });
        } else {
          toolResult = { error: `Unknown tool: ${toolBlock.name}` };
        }
      } catch (err) {
        toolResult = { error: err.message, slots: [] };
      }

      // Append assistant turn (containing tool_use) + tool_result
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role:    'user',
        content: [{
          type:        'tool_result',
          tool_use_id: toolBlock.id,
          content:     JSON.stringify(toolResult),
        }],
      });
    }
  } catch (apiErr) {
    // Anthropic API error (e.g. 400 orphan tool_use, 500, timeout) — never go silent.
    console.error('[AI] Anthropic API error:', apiErr.status || '', apiErr.message);
    return { reply: FALLBACK_REPLY[language] || FALLBACK_REPLY.en, guardBlocked: false, guardReason: null };
  }

  // Extract final text — find type==='text' (may not be index 0 when tools involved)
  const textBlock = response.content.find(b => b.type === 'text');
  const rawReply = sanitizeForWhatsApp(textBlock ? textBlock.text.trim() : '');

  // GECE-4-BRIEFI.md Bölüm B — second line of defense, after the prompt's
  // own pricing-authority rule. hasQualifyingPhoto/hasImaging default to
  // false (the conservative default: an unknown case has no photo/imaging
  // on file, so range_from_photo/range_after_imaging branches stay
  // blocked until Bölüm C's media pipeline actually confirms one exists).
  const guardResult = outputGuard.guardOutboundMessage({
    replyText: rawReply,
    authority: branchTemplate?.aiPricingAuthority || null,
    hasQualifyingPhoto: mediaReadiness.hasQualifyingPhoto,
    hasImaging: mediaReadiness.hasImaging,
    language,
  });

  if (guardResult.blocked) {
    console.warn(`[OutputGuard] blocked reply (${guardResult.reason}): "${rawReply.slice(0, 120)}"`);
    return { reply: GUARD_BLOCKED_REPLY[language] || GUARD_BLOCKED_REPLY.en, guardBlocked: true, guardReason: guardResult.reason, blockedText: rawReply };
  }

  return { reply: rawReply, guardBlocked: false, guardReason: null };
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

/**
 * processIncoming
 *
 * Returns: { language, scenario, reply, escalate, outOfHours, isReturning }
 */
async function processIncoming(incomingMsg, messageHistory = [], tenantId = null, leadId = null) {
  const text     = incomingMsg.text || '';
  const language = detectConversationLanguage(text, messageHistory);
  const scenario = classifyScenario(text);

  // Load AI settings for escalation keywords + out-of-hours message
  const aiSettings = tenantId ? await loadAiSettings(tenantId) : null;

  // Check escalation
  const escalationKeywords = aiSettings?.escalation_keywords || ['urgent','pain','emergency','bleeding','swelling','broken'];
  const escalate = (aiSettings?.escalation_enabled !== false) && (
    scenario === SCENARIOS.EMERGENCY || shouldEscalate(text, escalationKeywords)
  );

  // Check working hours — used as context for AI, no longer blocks pipeline
  const withinHours = tenantId ? await isWithinWorkingHours(tenantId) : true;

  let reply;
  let guardBlocked = false;
  let guardReason  = null;

  if (escalate) {
    // Escalation response — short, immediate
    reply = language === 'tr'
      ? 'Sizi hemen ekibimizle bağlantıya geçiriyorum. Kısa süre içinde size ulaşılacak. 🆘'
      : language === 'ar'
        ? 'أقوم الآن بتوصيلك بفريقنا. سيتواصل معك شخص ما قريبًا. 🆘'
        : "I'm connecting you with our team now. Someone will be with you shortly. 🆘";
  } else {
    // AI pipeline — active at all hours; withinHours informs system prompt context
    const result = await generateFollowUp({
      incomingText:   text,
      language,
      scenario,
      patientName:    incomingMsg.senderName,
      messageHistory,
      tenantId,
      withinHours,
      leadId,
      patientPhone:   incomingMsg?.from || null,
    });
    reply        = result.reply;
    guardBlocked = result.guardBlocked;
    guardReason  = result.guardReason;
  }

  // guardBlocked=true means outputGuard/complianceGuard caught something the
  // prompt should have prevented — GECE-4-BRIEFI.md Bölüm B: "gönderme,
  // logla, insana eskale et." `escalate` (the emergency/keyword path) and
  // `guardBlocked` (the output-filter path) are independent signals; the
  // caller (routes/whatsapp.js) treats a guard block as its own escalation
  // reason even when the message itself wasn't an emergency.
  return { language, scenario, reply, escalate, guardBlocked, guardReason, outOfHours: !withinHours };
}

module.exports = {
  detectLanguage,
  detectConversationLanguage,
  classifyScenario,
  detectObjection,
  generateFollowUp,
  processIncoming,
  loadAiSettings,
  loadKnowledge,
  loadBranchTemplate,
  loadCaseForLead,
  loadCaseMediaReadiness,
  isWithinWorkingHours,
  shouldEscalate,
  findExistingLead,
  buildSystemPrompt,
  SCENARIOS,
  OBJECTION_TYPES,
};

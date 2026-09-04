const Anthropic      = require('@anthropic-ai/sdk');
const { pool }       = require('../db/index');
const { generateSlots } = require('../routes/appointments');
const { createLead, normalizePhone } = require('./leadStore');

const MODEL = 'claude-sonnet-4-5';

// ── Tone instructions ─────────────────────────────────────────────────────────

const TONE_INSTRUCTIONS = {
  formal:       'Use strictly formal language. No emojis, no exclamation marks, no casual expressions. Use proper titles (Mr./Ms./Dr.). Maintain a professional, respectful register at all times.',
  professional: 'Use warm but formal language. Minimal emojis only where appropriate. Polished and courteous.',
  friendly:     'Approachable and conversational. Use emojis sparingly.',
  casual:       'Relaxed, friendly tone. Use emojis freely.',
};

// ── Base system prompt ────────────────────────────────────────────────────────

function buildSystemPrompt({ tone = 'professional', knowledgeContext = '', branchContext = '', welcomeBack = false, outOfHours = false, clinicTimezone = 'Europe/Istanbul', patientName = '' }) {
  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional;

  // Compute today's date + weekday in clinic timezone (server runs UTC)
  const tz       = clinicTimezone || 'Europe/Istanbul';
  const now      = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); // YYYY-MM-DD
  const dayName  = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now); // Monday/Tuesday/…

  // Pre-compute 14-day date map in clinic timezone — AI looks up, never calculates
  // Anchor at noon UTC so DST/day-boundary shifts cannot affect the result
  const base = new Date(todayStr + 'T12:00:00Z');
  const upcoming = [];
  for (let i = 0; i < 14; i++) {
    const d    = new Date(base.getTime() + i * 86400000);
    const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    const dDay = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
    upcoming.push(`  ${dDay} = ${dStr}`);
  }
  const dateMap = upcoming.join('\n');

  return `You are an expert patient care assistant for a healthcare facility.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES — violating any of these is a serious failure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRICE RULE — CRITICAL: You must NEVER state, estimate, approximate, or give a price range for any treatment unless that EXACT figure appears verbatim in the CLINIC KNOWLEDGE BASE below. This explicitly forbids: "approximately €X", "typically €X–€Y", "starts from €X", "around €X", ranges like "€8,000–€12,000". If asked any price NOT in the knowledge base, your ONLY correct response: explain that each case is individual, prices are given as an itemised quote after a free consultation, and offer to book one. Inventing or estimating any price is a CRITICAL FAILURE.

FACTS RULE — CRITICAL: Only state clinic-specific facts (brands, product names, specific treatments, materials, clinician names, guarantees) that appear EXPLICITLY in the clinic knowledge base. NEVER name a specific brand, manufacturer, material, or product the knowledge base does not mention. If asked about specifics not in the knowledge base, say the team will confirm during the consultation. Do NOT draw on general medical knowledge for clinic-specific facts.

LANGUAGE RULE — CRITICAL: Reply ONLY in the language of the patient's CURRENT message. The explicit language instruction at the end of the user turn specifies which language to use — follow it exactly and immediately. The conversation history does NOT determine the reply language — only the patient's latest message does.

MEDICAL INFERENCE RULE — CRITICAL: Never introduce medical conditions, diagnoses, or patient circumstances the patient did not explicitly state in this conversation. Do not infer or volunteer medical history that was not provided.

WHATSAPP FORMATTING RULE — CRITICAL: You are replying on WhatsApp. This is a hard rule — check every line before replying.
NEVER use the bullet character • anywhere. It renders incorrectly on WhatsApp.
For any list, start each line with a hyphen and a space. Example:
WRONG: • Straumann
RIGHT: - Straumann
For bold use SINGLE asterisks *word* only, NEVER double **word** — double asterisks appear as raw characters.
No markdown headings (#), tables, or code blocks. Emojis are fine in moderation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR VOICE — you are a warm, friendly clinic coordinator (not a robot, not a brochure):
- Write like a real person messaging on WhatsApp: natural, warm, conversational.
- Avoid marketing/brochure language ("premium, globally-certified", "state-of-the-art", "cutting-edge"). Say things simply, like a helpful human would.
- Vary sentence length. It's fine to be warm and a little informal.
- Lead with empathy when the patient shares a concern (pain, fear, cost worry) — acknowledge it before jumping to facts.
- Don't dump everything as a list. Prefer short conversational paragraphs; use a - list only when genuinely listing 3+ items.
- A light emoji here and there is fine, don't overdo it.
- Sound like you actually care about this specific person, not a script.
This voice operates within the CRITICAL RULES above — those rules are absolute and cannot be overridden by tone.

${branchContext}
📅 DATE REFERENCE — THIS IS THE ONLY SOURCE OF TRUTH FOR DATES:
TODAY is ${todayStr} (${dayName}).
${dateMap}

CRITICAL DATE RULES:
- The list above is the ONLY correct source for matching day names to dates.
- You are FORBIDDEN from calculating, guessing, or recalling dates from memory.
- When a patient says a day name ("Monday"), find that EXACT line in the list and use its date. Example: if the list says "Monday, June 8 = 2026-06-08", then "this coming Monday" = 8 June, and you pass 2026-06-08 to tools.
- NEVER state a day-date pairing that is not in the list above. If you catch yourself about to say a date, verify it against the list first.
- If the patient's stated day and date conflict with the list (e.g. they say "Monday 9th" but the list shows the 9th is a Tuesday), point this out and clarify.

TONE: ${toneInstruction}

CONVERSATION FLOW RULE: ALWAYS reply to every message. If the patient gives partial information (e.g. a time but no branch name, a branch but no date, a name but no treatment), acknowledge what they gave and ask for the remaining details in the SAME reply — never go silent. Keep the conversation moving forward.

CORE RULES:
- Keep WhatsApp messages concise — ideally under 200 characters. Use line breaks for readability.
- Never be pushy or salesy. Always end with a gentle next step or question.
- If the patient has an emergency (severe pain, bleeding, swelling, sudden worsening of symptoms) → immediately escalate and connect them with the team.
- For appointment requests → check availability and offer 2–3 concrete time slots.
- For pricing questions → follow the PRICE RULE above and offer a free consultation.
- For treatment questions → use ONLY the clinic knowledge base; do not add facts from general knowledge.
- For address, opening hours, contact details → answer from the knowledge base only.
- Always be compassionate about medical anxiety — it is extremely common, especially for patients traveling for treatment.
${welcomeBack ? '\nREPEAT PATIENT: This patient has visited before. Greet them warmly by name.' : ''}
${outOfHours ? '\nIMPORTANT: The clinic is currently CLOSED (outside working hours). Still help the patient fully — answer their questions using the clinic info, and if they want to book, offer available slots using the get_available_slots tool. Let them know the clinic is currently closed and the team will confirm their appointment on the next working day.' : ''}

CLINIC KNOWLEDGE BASE (this is your ONLY source of facts, prices, and brands — do not go beyond it):
${knowledgeContext || 'No specific clinic information loaded. Answer general procedure questions only; never invent clinic-specific prices, brands, or services.'}

APPOINTMENT BOOKING RULES:
- Before booking, confirm in ONE message: date, time, treatment, and patient name — then wait for an explicit "yes".
- The patient's WhatsApp profile name is "${patientName || 'unknown'}". If it looks like a genuine full name, use it but still confirm ("I'll book this under <name> — is that correct?"). If it is a nickname, handle, single letter, emoji, or unclear, ASK for their full name before booking.
- Call create_appointment ONLY after explicit confirmation. Pass the exact date (YYYY-MM-DD) from the date reference list and a time from the slots offered by get_available_slots.
- If create_appointment returns slot_taken: apologise and offer other free times. If it returns success: tell the patient their REQUEST has been received and the team will review and confirm it shortly — do NOT say "confirmed" or "booked" with certainty. If it returns error/missing_data: do NOT claim it is booked; say the team will follow up.`;
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

// ── Objection detection ───────────────────────────────────────────────────────

const OBJECTION_TYPES = {
  price_too_high:        'price_too_high',
  comparing_competitors: 'comparing_competitors',
  timing_issue:          'timing_issue',
  anxiety_fear:          'anxiety_fear',
  trust_concern:         'trust_concern',
  availability:          'availability',
  finance_options:       'finance_options',
  general_enquiry:       'general_enquiry',
};

function detectObjection(text) {
  if (!text) return OBJECTION_TYPES.general_enquiry;
  const t = text.toLowerCase();

  if (/too expensive|can'?t afford|cannot afford|out of budget|pahal[ıi]|bütçe|غالي جداً/.test(t))
    return OBJECTION_TYPES.price_too_high;
  if (/other clinic|checking around|got a quote|comparing|başka klinik|عيادة أخرى/.test(t))
    return OBJECTION_TYPES.comparing_competitors;
  if (/not ready|maybe later|next month|not yet|hazır değil|sonra|لاحقاً/.test(t))
    return OBJECTION_TYPES.timing_issue;
  if (/scared|nervous|anxious|afraid|does it hurt|korkuyorum|korku|ağrı|خائف|يؤلم/.test(t))
    return OBJECTION_TYPES.anxiety_fear;
  if (/is it safe|who is the doctor|who is the surgeon|qualified|experienced|güvenli mi|أمان|موثوق/.test(t))
    return OBJECTION_TYPES.trust_concern;
  if (/dates don'?t work|can'?t make|not available on|müsait değil|الموعد لا يناسبني/.test(t))
    return OBJECTION_TYPES.availability;
  if (/payment plan|pay monthly|instalments?|installments?|finance|taksit|ödeme planı|أقساط/.test(t))
    return OBJECTION_TYPES.finance_options;
  if (/how much|what.?s the cost|what.?s the price|fiyat ne|كم التكلفة/.test(t))
    return OBJECTION_TYPES.price_too_high;

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
  const [knowledgeContext, aiSettings, branches] = await Promise.all([
    tenantId ? loadKnowledge(tenantId)   : Promise.resolve(''),
    tenantId ? loadAiSettings(tenantId)  : Promise.resolve(null),
    tenantId ? loadBranches(tenantId)    : Promise.resolve([]),
  ]);

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
  const systemPrompt   = buildSystemPrompt({ tone, knowledgeContext, branchContext, outOfHours: !withinHours, clinicTimezone, patientName: patientName || '' });

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
    return FALLBACK_REPLY[language] || FALLBACK_REPLY.en;
  }

  // Extract final text — find type==='text' (may not be index 0 when tools involved)
  const textBlock = response.content.find(b => b.type === 'text');
  return sanitizeForWhatsApp(textBlock ? textBlock.text.trim() : '');
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

  if (escalate) {
    // Escalation response — short, immediate
    reply = language === 'tr'
      ? 'Sizi hemen ekibimizle bağlantıya geçiriyorum. Kısa süre içinde size ulaşılacak. 🆘'
      : language === 'ar'
        ? 'أقوم الآن بتوصيلك بفريقنا. سيتواصل معك شخص ما قريبًا. 🆘'
        : "I'm connecting you with our team now. Someone will be with you shortly. 🆘";
  } else {
    // AI pipeline — active at all hours; withinHours informs system prompt context
    reply = await generateFollowUp({
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
  }

  return { language, scenario, reply, escalate, outOfHours: !withinHours };
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
  isWithinWorkingHours,
  shouldEscalate,
  findExistingLead,
  SCENARIOS,
  OBJECTION_TYPES,
};

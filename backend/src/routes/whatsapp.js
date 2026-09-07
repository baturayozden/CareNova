const express   = require('express');
const router    = express.Router();
const crypto    = require('crypto');
const whatsapp  = require('../services/whatsapp');
const ai        = require('../services/ai');
const leadStore = require('../services/leadStore');
const { pool }  = require('../db/index');
const { createNotification } = require('./notifications');
const { scoreLeadAsync }    = require('../services/leadScoring');
const { sendEscalationAlert } = require('../utils/email');
const { getDefaultAssignee } = require('../config/tenantDefaults');
// GECE-4-BRIEFI.md Bölüm C — voice note transcription + image/document
// understanding. See transcribeIncomingVoiceNote / handleIncomingVisualMedia
// near the bottom of this file.
const caseFileStore   = require('../services/caseFileStore');
const transcription   = require('../services/transcription');
const visionExtraction = require('../services/visionExtraction');
const supabaseStorage  = require('../lib/supabaseStorage');

// ---------------------------------------------------------------------------
// GET /webhook/whatsapp  — Meta webhook verification handshake
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verified ✅');
    return res.status(200).send(challenge);
  }

  console.warn('[WhatsApp] Webhook verification failed — token mismatch');
  res.sendStatus(403);
});

// ---------------------------------------------------------------------------
// POST /webhook/whatsapp  — incoming messages + delivery status updates
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  // ── X-Hub-Signature-256 verification ─────────────────────────────────────
  console.log('[Webhook] POST received — headers:', JSON.stringify({
    sig:         req.headers['x-hub-signature-256']?.slice(0, 20) + '...',
    contentType: req.headers['content-type'],
    hasRawBody:  !!req.rawBody,
    hasSecret:   !!process.env.WHATSAPP_APP_SECRET,
  }));

  const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
  if (!APP_SECRET) {
    console.error('[Webhook] WHATSAPP_APP_SECRET not set — rejecting');
    return res.sendStatus(500);
  }
  if (!req.rawBody) {
    console.warn('[Webhook] No raw body available — rejecting');
    return res.sendStatus(403);
  }
  const sig = req.headers['x-hub-signature-256'];
  if (!sig) {
    console.warn('[Webhook] Missing X-Hub-Signature-256 — rejecting');
    return res.sendStatus(403);
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET)
    .update(req.rawBody).digest('hex');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    console.warn('[Webhook] Invalid signature — rejecting');
    return res.sendStatus(403);
  }
  // ── Signature valid — acknowledge Meta immediately (< 5s requirement) ────
  res.sendStatus(200);

  const body = req.body;
  if (body.object !== 'whatsapp_business_account') return;

  // ── Delivery / read status update ────────────────────────────────────────
  const statusUpdate = whatsapp.parseStatusUpdate(body);
  if (statusUpdate) {
    if (statusUpdate.messageId) {
      await leadStore.updateMessageStatus(statusUpdate.messageId, statusUpdate.status);
    }
    return;
  }

  // ── Incoming message ──────────────────────────────────────────────────────
  const incomingMsg = whatsapp.parseIncomingMessage(body);
  if (!incomingMsg) return;

  console.log('[WhatsApp] Incoming:', {
    from:          incomingMsg.from,
    name:          incomingMsg.senderName,
    type:          incomingMsg.type,
    text:          incomingMsg.text,
    phoneNumberId: incomingMsg.phoneNumberId,
  });

  // GECE-4-BRIEFI.md Bölüm C: this used to be `if (type !== 'text') return`,
  // silently dropping every voice note, photo, and document — "en büyük tek
  // boşluk" per the brief, since voice notes are dominant behaviour on
  // Arabic/Turkish WhatsApp. audio/image/document are now handled below;
  // anything else (stickers, contacts, location, reactions, ...) still
  // exits here — no product spec exists yet for those types.
  const SUPPORTED_TYPES = ['text', 'audio', 'image', 'document'];
  if (!SUPPORTED_TYPES.includes(incomingMsg.type)) return;
  if (incomingMsg.type === 'text' && !incomingMsg.text) return;
  if (incomingMsg.type !== 'text' && !incomingMsg.mediaId) return;

  try {
    // ── 1. Resolve tenant from phone_number_id ────────────────────────────────
    const cfgRes = await pool.query(
      `SELECT tenant_id, id AS whatsapp_config_id, phone_number_id, access_token
       FROM whatsapp_configs WHERE phone_number_id = $1 AND is_active = TRUE`,
      [incomingMsg.phoneNumberId],
    );
    const cfg = cfgRes.rows[0];
    console.log(`[Webhook] Tenant lookup: phone_number_id=${incomingMsg.phoneNumberId} → ${cfg ? `tenant=${cfg.tenant_id}` : 'NO MATCH'}`);
    if (!cfg) {
      console.warn(`[Webhook] No whatsapp_configs match for phone_number_id=${incomingMsg.phoneNumberId} — message discarded, no tenant written`);
      return;
    }
    const tenantId         = cfg.tenant_id;
    const whatsappConfigId = cfg.whatsapp_config_id;
    const waConfig         = { phoneNumberId: cfg.phone_number_id, accessToken: cfg.access_token };

    // Mark as read using tenant's own phone/token
    try { await whatsapp.markAsRead(incomingMsg.messageId, waConfig); } catch {}

    // ── 2. Upsert lead ───────────────────────────────────────────────────────
    const lead = await leadStore.upsertLead({
      phone:      incomingMsg.from,
      senderName: incomingMsg.senderName,
      tenantId,
      assignedTo: getDefaultAssignee(tenantId),
    });

    // ── 2.5 Media (voice note / image / document) pre-processing ────────────
    // GECE-4-BRIEFI.md Bölüm C. audio → downloaded + transcribed, transcript
    // becomes incomingMsg.text and the pipeline continues exactly as for a
    // text message. image/document → downloaded, structurally extracted,
    // saved to case_media (never messages.content, never sent to the
    // patient) and handled to completion here — this pass ends without
    // calling the Claude pipeline, since nothing in the brief calls for an
    // AI-generated reply to a photo/document beyond a deterministic
    // acknowledgement or retake request.
    let inboundMessageType = 'text';
    if (incomingMsg.type === 'audio') {
      const transcript = await transcribeIncomingVoiceNote(incomingMsg, { tenantId, lead, waConfig });
      if (transcript == null) return; // failure already handled — retry-in-writing request sent
      incomingMsg.text = transcript;
      inboundMessageType = 'audio';
    } else if (incomingMsg.type === 'image' || incomingMsg.type === 'document') {
      await handleIncomingVisualMedia(incomingMsg, { tenantId, lead, waConfig });
      return;
    }

    // ── 3. Returning patient recognition ────────────────────────────────────
    const isReturning = lead.aiFollowUpCount > 0 || lead.status === 'responded';

    // ── 4. Detect objection + save inbound message ──────────────────────────
    const objectionType = ai.detectObjection(incomingMsg.text);

    await leadStore.saveMessage({
      leadId:            lead.id,
      direction:         'inbound',
      content:           incomingMsg.text,
      aiGenerated:       false,
      whatsappMessageId: incomingMsg.messageId,
      whatsappConfigId,
      status:            'delivered',
      objectionType,
      messageType:       inboundMessageType,
    });

    if (lead.status === 'contacted') {
      await leadStore.updateLeadStatus(incomingMsg.from, 'responded');
    }

    // ── 5. AI quota check ────────────────────────────────────────────────────
    const { rows: quotaRows } = await pool.query(`
      SELECT t.ai_monthly_limit, t.ai_overage_policy,
        (SELECT COUNT(*) FROM messages
         WHERE tenant_id = t.id AND direction = 'outbound'
           AND ai_generated = TRUE
           AND created_at >= DATE_TRUNC('month', NOW())
        ) AS used_this_month
      FROM tenants t WHERE t.id = $1
    `, [tenantId]);

    const quota = quotaRows[0];
    if (quota?.ai_overage_policy === 'block') {
      const used = parseInt(quota.used_this_month || 0, 10);
      if (used >= quota.ai_monthly_limit) {
        console.log(`[AI] Quota exceeded for tenant ${tenantId} — blocking reply`);
        return;
      }
    }

    // ── 6. Process through AI pipeline ───────────────────────────────────────
    const history = await leadStore.getMessages(lead.id);

    // Prepend welcome-back greeting for returning patients (first message this session)
    const welcomeMsg = isReturning && history.length <= 2
      ? `Welcome back, ${incomingMsg.senderName || 'there'}! `
      : '';

    const { language, scenario, reply: rawReply, escalate, guardBlocked, guardReason, outOfHours } =
      await ai.processIncoming(incomingMsg, history, tenantId, lead.id);

    const rawCombined = welcomeMsg && !escalate && !outOfHours
      ? `${welcomeMsg}${rawReply}`
      : rawReply;

    // Deterministic WhatsApp sanitisation — applied regardless of prompt instructions.
    // • / · → "- " (bullet chars WhatsApp renders as raw text)
    // **bold** → *bold* (WhatsApp only renders single-asterisk bold)
    const reply = rawCombined
      .replace(/^\s*[•·]\s*/gm, '- ')   // bullet at line start → hyphen
      .replace(/[•·]\s?/g, '- ')         // bullet mid-line (edge case)
      .replace(/\*\*(.+?)\*\*/gs, '*$1*'); // double-asterisk → single

    console.log(`[AI] lang=${language} scenario=${scenario} escalate=${escalate} guardBlocked=${guardBlocked} ooh=${outOfHours}`);
    console.log(`[AI] Reply: "${reply}"`);

    // ── 7. Handle escalation ──────────────────────────────────────────────────
    // GECE-4-BRIEFI.md Bölüm B: a guard block ("gönderme, logla, insana
    // eskale et") is its own escalation trigger, independent of the
    // emergency-keyword `escalate` path above — the patient never gets a
    // forbidden price/medical-inference reply, and staff always find out.
    if (escalate || guardBlocked) {
      // Mark lead as requiring human attention
      await pool.query(
        `UPDATE leads SET ai_follow_up_enabled = FALSE, action_required = TRUE
         WHERE id = $1`,
        [lead.id],
      ).catch(() => {});  // column may not exist yet — fail silently

      // Notify clinic via email
      sendEscalationEmail({ lead, tenantId, message: incomingMsg.text })
        .catch(err => console.error('[Escalation] Email error:', err.message));

      // Create in-app notification
      createNotification({
        tenantId,
        type:    'escalation',
        title:   guardBlocked ? '⚠️ AI reply blocked — needs a human reply' : '⚠️ Urgent: Patient needs attention',
        message: guardBlocked
          ? `${lead.name || lead.phone} — AI response withheld (${guardReason}). Original message: "${incomingMsg.text.slice(0, 120)}"`
          : `${lead.name || lead.phone} sent: "${incomingMsg.text.slice(0, 120)}"`,
        link:    `/ai-activity`,
      });

      if (guardBlocked) {
        console.warn(`[OutputGuard] lead=${lead.id} tenant=${tenantId} reason=${guardReason}`);
      }
    }

    // ── 8. Send reply via WhatsApp ────────────────────────────────────────────
    console.log(`[Webhook] Sending reply via phone_number_id=${waConfig.phoneNumberId} to +${incomingMsg.from}`);
    let sendResult;
    try {
      sendResult = await whatsapp.sendText(`+${incomingMsg.from}`, reply, waConfig);
      console.log(`[Webhook] Send OK — message_id=${sendResult.messages?.[0]?.id}`);
    } catch (sendErr) {
      console.error(`[Webhook] Send FAILED — phone_number_id=${waConfig.phoneNumberId} tenant=${tenantId} error=${sendErr.message}`);
      throw sendErr;
    }

    // ── 9. Save outbound message ──────────────────────────────────────────────
    await leadStore.saveMessage({
      leadId:            lead.id,
      direction:         'outbound',
      content:           reply,
      aiGenerated:       true,
      whatsappMessageId: sendResult.messages?.[0]?.id || null,
      whatsappConfigId,
      status:            'sent',
      scenarioType:      scenario,
    });

    // ── 10. Update lead AI tracking fields ───────────────────────────────────
    await leadStore.updateLeadAiFields(lead.id, {
      language,
      aiFollowUpCount: (lead.aiFollowUpCount || 0) + 1,
      lastAiMessageAt: new Date().toISOString(),
    });

    if (lead.status === 'new') {
      await leadStore.updateLeadStatus(incomingMsg.from, 'contacted');
    }

    // Non-blocking lead score update — never blocks the WhatsApp pipeline
    const allMessages = await leadStore.getMessages(lead.id);
    scoreLeadAsync(lead.id, allMessages);

    console.log(`[AI] Reply sent to +${incomingMsg.from} (lead ${lead.id})`);

  } catch (err) {
    console.error('[AI] Pipeline error:', err.message);
  }
});

// ── Escalation notification (email + optional WhatsApp alert) ─────────────────

async function sendEscalationEmail({ lead, tenantId, message }) {
  try {
    // 1. Get clinic name, primary email, and alert_phone
    const { rows: tenantRows } = await pool.query(
      `SELECT t.name, t.email, cas.alert_phone
       FROM tenants t
       LEFT JOIN clinic_ai_settings cas ON cas.tenant_id = t.id
       WHERE t.id = $1`, [tenantId],
    );
    const clinicName = tenantRows[0]?.name       || 'Clinic';
    const alertPhone = tenantRows[0]?.alert_phone || null;

    // 2. Collect all operasyon_muduru + klinik_sahibi emails for this tenant from PostgreSQL
    const { rows: staffRows } = await pool.query(
      `SELECT u.email FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.tenant_id = $1 AND u.deleted_at IS NULL AND u.is_active = TRUE
         AND r.name IN ('operasyon_muduru', 'klinik_sahibi')`,
      [tenantId],
    ).catch(() => ({ rows: [] }));

    // Also include the tenant's primary email as fallback
    const primaryEmail = tenantRows[0]?.email;
    const recipientSet = new Set(staffRows.map(r => r.email));
    if (primaryEmail) recipientSet.add(primaryEmail);
    const recipients = [...recipientSet].filter(Boolean);

    // 3. Send via shared shell() template
    sendEscalationAlert({
      recipients,
      leadName:  lead.name  || null,
      leadPhone: lead.phone || null,
      message,
      clinicName,
      leadId: lead.id || null,
    }).catch(err => console.error('[Escalation] email alert failed:', err.message));

    // 4. WhatsApp alert to clinic alert_phone if configured
    if (alertPhone) {
      const waMsg = `⚠️ CareNova Alert: ${lead.name || 'A patient'} needs urgent attention.\nMessage: "${message.slice(0, 100)}"\nReply here: https://wa.me/${lead.phone}`;
      const whatsapp = require('../services/whatsapp');
      const { rows: alertCfgRows } = await pool.query(
        `SELECT phone_number_id, access_token FROM whatsapp_configs
         WHERE tenant_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1`,
        [tenantId],
      ).catch(() => ({ rows: [] }));
      const alertWaConfig = alertCfgRows[0]
        ? { phoneNumberId: alertCfgRows[0].phone_number_id, accessToken: alertCfgRows[0].access_token }
        : {};
      await whatsapp.sendText(alertPhone.startsWith('+') ? alertPhone : `+${alertPhone}`, waMsg, alertWaConfig)
        .catch(err => console.error('[Escalation] WhatsApp alert error:', err.message));
      console.log(`[Escalation] WhatsApp alert sent to ${alertPhone}`);
    }
  } catch (err) {
    console.error('[Escalation] sendEscalationEmail error:', err.message);
  }
}

// ── Media handling (GECE-4-BRIEFI.md Bölüm C) ──────────────────────────────

function pickLocalized(map, language) {
  if (!map) return null;
  return map[language] || map.en || Object.values(map)[0] || null;
}

const TRANSCRIPTION_FAILURE_TEXT = {
  tr: 'Üzgünüm, sesli mesajınızı anlayamadım. Yazarak tekrar iletebilir misiniz?',
  ar: 'عذرًا، لم أتمكن من فهم رسالتك الصوتية. هل يمكنك إعادة إرسالها كتابةً؟',
  en: "Sorry, I couldn't understand your voice message. Could you send it again in writing?",
};

const MEDIA_ACK_NO_CASE_TEXT = {
  tr: 'Gönderdiğiniz için teşekkürler, aldım. Ekibimiz kısa süre içinde sizinle iletişime geçecek.',
  ar: 'شكرًا لإرسالك هذا. لقد استلمته، وسيتواصل معك فريقنا قريبًا.',
  en: "Thanks for sending that — I've received it. Our team will follow up with you shortly.",
};

const MEDIA_ACK_PARTIAL_TEXT = {
  tr: 'Aldım, teşekkürler. Değerlendirmeyi tamamlamak için birkaç görsel/belge daha gerekiyor.',
  ar: 'استلمته، شكرًا لك. نحتاج إلى بعض الصور/المستندات الإضافية لإكمال التقييم.',
  en: "Got it, thank you. We still need a few more photos/documents to complete the assessment.",
};

const MEDIA_ACK_COMPLETE_TEXT = {
  tr: 'Teşekkürler, ihtiyacımız olan her şeyi aldık. Doktorumuz dosyanızı inceleyip size geri dönecek.',
  ar: 'شكرًا لك، لقد استلمنا كل ما نحتاجه. سيقوم طبيبنا بمراجعة ملفك والتواصل معك.',
  en: "Thank you — we now have everything we need. Our doctor will review your file and get back to you.",
};

const RETAKE_PREFIX_TEXT = {
  tr: 'Bu görsel biraz belirsiz görünüyor, tekrar çeker misiniz?',
  ar: 'تبدو هذه الصورة غير واضحة بعض الشيء، هل يمكنك التقاطها مرة أخرى؟',
  en: "That photo came out a little unclear — could you retake it?",
};

const RETAKE_GENERIC_TEXT = {
  tr: 'Bu görsel biraz belirsiz görünüyor. İyi ışıkta, net bir şekilde tekrar gönderebilir misiniz?',
  ar: 'تبدو هذه الصورة غير واضحة. هل يمكنك إرسالها مرة أخرى في إضاءة جيدة وبوضوح؟',
  en: "That photo came out a little unclear. Could you send it again in good lighting, clearly in frame?",
};

/**
 * Voice note → transcript. Returns the transcript string on success, or
 * null on failure (media download or transcription error) after already
 * sending the patient a "please retype it" request — Bölüm C.1 item 5:
 * "AI must NOT go silent" on transcription failure.
 */
async function transcribeIncomingVoiceNote(incomingMsg, { tenantId, lead, waConfig }) {
  try {
    const { buffer, mimeType } = await whatsapp.downloadMedia(incomingMsg.mediaId, waConfig);
    const { transcript, detectedLanguage, confidence, provider } =
      await transcription.transcribeAudio(buffer, mimeType);

    const caseRow = tenantId ? await ai.loadCaseForLead(lead.id, tenantId) : null;
    if (caseRow) {
      await caseFileStore
        .addMedia(tenantId, caseRow.id, {
          kind: 'audio',
          whatsappMediaId: incomingMsg.mediaId,
          aiExtraction: { transcript, detectedLanguage, confidence, provider },
        }, null)
        .catch(err => console.error('[Media] addMedia(audio) failed:', err.message));
    }

    return transcript;
  } catch (err) {
    console.error(`[Media] Voice transcription failed for lead=${lead.id}:`, err.message);
    const knownLanguage = lead.language || 'en';
    await whatsapp
      .sendText(`+${incomingMsg.from}`, pickLocalized(TRANSCRIPTION_FAILURE_TEXT, knownLanguage), waConfig)
      .catch(sendErr => console.error('[Media] retry-request send failed:', sendErr.message));

    if (tenantId) {
      const caseRow = await ai.loadCaseForLead(lead.id, tenantId).catch(() => null);
      if (caseRow) {
        await caseFileStore
          .appendCaseEvent(tenantId, caseRow.id, 'media_error', null, { type: 'audio', reason: err.message })
          .catch(() => {});
      }
    }
    return null;
  }
}

/**
 * Image/document → structured extraction, saved only to
 * case_media.ai_extraction (🔴 MUTLAK KURAL — never patient-facing, see
 * visionExtraction.js). Fully self-contained: downloads, uploads to
 * storage, extracts, saves, and replies (ack / retake request) on its own;
 * the caller does not continue into the Claude pipeline for this message.
 * Bölüm C.3: any failure here is caught and logged to case_events —
 * res.sendStatus(200) to Meta already happened before this ever runs.
 */
async function handleIncomingVisualMedia(incomingMsg, { tenantId, lead, waConfig }) {
  const kind = incomingMsg.type === 'image' ? 'photo' : 'document';
  const messageType = incomingMsg.type === 'image' ? 'image' : 'document';

  try {
    const { buffer, mimeType } = await whatsapp.downloadMedia(incomingMsg.mediaId, waConfig);

    const caseRow = tenantId ? await ai.loadCaseForLead(lead.id, tenantId) : null;
    const language = caseRow?.patient_language || lead.language || 'en';
    const branchTemplate = caseRow ? await ai.loadBranchTemplate(caseRow.branch_key) : null;

    const storagePath = `${tenantId}/${lead.id}/${incomingMsg.mediaId}`;
    let uploaded = false;
    try {
      await supabaseStorage.uploadFile(storagePath, buffer, mimeType);
      uploaded = true;
    } catch (storageErr) {
      // Storage is best-effort here — a missing/misconfigured bucket must
      // not stop vision extraction or the patient-facing acknowledgement.
      console.error('[Media] Supabase upload failed:', storageErr.message);
    }

    await leadStore.saveMessage({
      leadId:            lead.id,
      direction:         'inbound',
      content:           incomingMsg.caption || `[${kind} received]`,
      aiGenerated:       false,
      whatsappMessageId: incomingMsg.messageId,
      status:            'delivered',
      messageType,
    });

    if (!caseRow) {
      // No case yet — qualification happens before a case exists, so
      // there's no branch template / required-media checklist to extract
      // against. Acknowledge receipt and stop; nothing to write to
      // case_media without a case_id.
      await whatsapp
        .sendText(`+${incomingMsg.from}`, pickLocalized(MEDIA_ACK_NO_CASE_TEXT, language), waConfig)
        .catch(err => console.error('[Media] ack send failed:', err.message));
      return;
    }

    const extraction = await visionExtraction.extractFromImage(buffer, mimeType, caseRow.branch_key, {
      requiredMediaSlots: branchTemplate?.requiredMedia || [],
    });
    const qualityInsufficient = visionExtraction.isQualityInsufficient(extraction);

    await caseFileStore
      .addMedia(tenantId, caseRow.id, {
        kind,
        whatsappMediaId: incomingMsg.mediaId,
        storagePath: uploaded ? storagePath : null,
        templateSlotId: extraction.matchedSlot || null,
        qualityOk: !qualityInsufficient,
        aiExtraction: extraction,
      }, null)
      .catch(err => console.error('[Media] addMedia failed:', err.message));

    if (qualityInsufficient) {
      const requiredMedia = branchTemplate?.requiredMedia || [];
      const slot = requiredMedia.find(s => s.id === extraction.matchedSlot) || requiredMedia[0];
      const instruction = slot?.captureInstruction ? pickLocalized(slot.captureInstruction, language) : null;
      const retakeMsg = instruction
        ? `${pickLocalized(RETAKE_PREFIX_TEXT, language)} ${instruction}`
        : pickLocalized(RETAKE_GENERIC_TEXT, language);
      await whatsapp.sendText(`+${incomingMsg.from}`, retakeMsg, waConfig)
        .catch(err => console.error('[Media] retake send failed:', err.message));
      return;
    }

    // Bölüm C.2 item 5: once every required-media slot has a quality_ok
    // entry, auto-transition the case to awaiting_doctor. The structured
    // extraction stays doctor-only regardless of which branch this takes.
    const requiredSlots = branchTemplate?.requiredMedia || [];
    let allComplete = requiredSlots.length === 0;
    if (requiredSlots.length > 0) {
      const existingMedia = await caseFileStore.listMedia(tenantId, caseRow.id).catch(() => []);
      const qualifyingSlotIds = new Set(
        (existingMedia || [])
          .filter(m => m.quality_ok)
          .map(m => m.template_slot_id)
          .filter(Boolean),
      );
      allComplete = requiredSlots.every(s => qualifyingSlotIds.has(s.id));
    }

    if (allComplete && caseRow.status !== 'awaiting_doctor') {
      await caseFileStore
        .updateCaseStatus(tenantId, caseRow.id, 'awaiting_doctor', null)
        .catch(err => console.error('[Media] case auto-transition failed:', err.message));
    }

    const ackMsg = allComplete
      ? pickLocalized(MEDIA_ACK_COMPLETE_TEXT, language)
      : pickLocalized(MEDIA_ACK_PARTIAL_TEXT, language);
    await whatsapp.sendText(`+${incomingMsg.from}`, ackMsg, waConfig)
      .catch(err => console.error('[Media] ack send failed:', err.message));

  } catch (err) {
    console.error(`[Media] Visual media handling failed for lead=${lead.id}:`, err.message);
    if (tenantId) {
      const caseRow = await ai.loadCaseForLead(lead.id, tenantId).catch(() => null);
      if (caseRow) {
        await caseFileStore
          .appendCaseEvent(tenantId, caseRow.id, 'media_error', null, { type: incomingMsg.type, reason: err.message })
          .catch(() => {});
      }
    }
  }
}

module.exports = router;
// GECE-4-BRIEFI.md Bölüm C — exported for unit testing without the HTTP
// layer (same _internal pattern as routes/caseFiles.js).
module.exports._internal = {
  transcribeIncomingVoiceNote,
  handleIncomingVisualMedia,
  pickLocalized,
  TRANSCRIPTION_FAILURE_TEXT,
  MEDIA_ACK_NO_CASE_TEXT,
  MEDIA_ACK_PARTIAL_TEXT,
  MEDIA_ACK_COMPLETE_TEXT,
  RETAKE_PREFIX_TEXT,
  RETAKE_GENERIC_TEXT,
};

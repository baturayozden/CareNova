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

  // Only process text messages
  if (incomingMsg.type !== 'text' || !incomingMsg.text) return;

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

    const { language, scenario, reply: rawReply, escalate, outOfHours } =
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

    console.log(`[AI] lang=${language} scenario=${scenario} escalate=${escalate} ooh=${outOfHours}`);
    console.log(`[AI] Reply: "${reply}"`);

    // ── 7. Handle escalation ──────────────────────────────────────────────────
    if (escalate) {
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
        title:   '⚠️ Urgent: Patient needs attention',
        message: `${lead.name || lead.phone} sent: "${incomingMsg.text.slice(0, 120)}"`,
        link:    `/ai-activity`,
      });
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

    // 2. Collect all director + clinic_admin emails for this tenant from PostgreSQL
    const { rows: staffRows } = await pool.query(
      `SELECT u.email FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.tenant_id = $1 AND u.deleted_at IS NULL AND u.is_active = TRUE
         AND r.name IN ('director', 'clinic_admin')`,
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

module.exports = router;

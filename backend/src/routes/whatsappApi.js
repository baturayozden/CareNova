const express  = require('express');
const router   = express.Router();
const whatsapp = require('../services/whatsapp');
const { pool } = require('../db/index');

// ---------------------------------------------------------------------------
// POST /api/whatsapp/test-send
// Sends the carenova_welcome template to a given number. Auth required.
// Body: { to?: string, language?: string }
// ---------------------------------------------------------------------------
router.post('/test-send', async (req, res) => {
  const to           = req.body.to       || '+447827690137';
  const language     = req.body.language || 'en_US';
  const templateName = 'carenova_welcome';

  try {
    const result = await whatsapp.sendTemplate(to, templateName, language);
    console.log(`[WhatsApp] Template "${templateName}" sent to ${to}:`, result);
    res.json({
      success: true,
      to,
      template: templateName,
      language,
      whatsapp: result,
    });
  } catch (err) {
    const apiError = err.response?.data?.error || null;
    console.error('[WhatsApp] test-send failed:', apiError || err.message);
    res.status(502).json({
      success: false,
      error: apiError?.message || err.message,
      code:  apiError?.code    || null,
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/whatsapp/status
// Returns the connected phone number's profile from the Meta API.
// ---------------------------------------------------------------------------
router.get('/status', async (req, res) => {
  try {
    const info = await whatsapp.getPhoneNumberInfo();
    res.json({ success: true, phoneNumber: info });
  } catch (err) {
    const apiError = err.response?.data?.error || null;
    res.status(502).json({
      success: false,
      error: apiError?.message || err.message,
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/whatsapp/activity
// Returns the 20 most recent AI message events for the activity feed.
// ---------------------------------------------------------------------------
router.get('/activity', async (req, res) => {
  try {
    const isPlatformAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const params = [];
    const tenantClause = isPlatformAdmin
      ? ''
      : (params.push(req.user.tenantId), `AND l.tenant_id = $${params.length}`);

    const { rows } = await pool.query(`
      SELECT
        m.id,
        m.direction,
        m.content,
        m.ai_generated,
        m.created_at,
        m.status,
        l.first_name,
        l.last_name,
        l.phone,
        t.name AS clinic_name
      FROM messages m
      JOIN leads l ON l.id = m.lead_id
      JOIN tenants t ON t.id = l.tenant_id
      WHERE 1=1 ${tenantClause}
      ORDER BY m.created_at DESC
      LIMIT 20
    `, params);

    const events = rows.map(r => ({
      id:        r.id,
      leadName:  `${r.first_name} ${r.last_name}`.trim() || r.phone,
      type:      r.direction === 'inbound' ? 'response_received' : 'message_sent',
      content:   r.content,
      timestamp: r.created_at,
      clinic:    r.clinic_name,
      aiGenerated: r.ai_generated,
    }));

    res.json({ events, total: events.length });
  } catch (err) {
    console.error('[WhatsApp] activity error:', err.message);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

module.exports = router;

'use strict';

const express = require('express');
const router  = express.Router();
const { processReminders }        = require('../services/appointmentReminders');
const { ensureAllCurrentPeriods } = require('../services/commissionPeriods');

// POST /api/cron/reminders — hourly GitHub Actions trigger
// Protected by X-Cron-Secret header (CRON_SECRET env var on Render).
router.post('/reminders', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers['x-cron-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const [remindersResult, periodsResult] = await Promise.all([
      processReminders(),
      ensureAllCurrentPeriods().catch(err => {
        console.error('[Cron] ensureAllCurrentPeriods error:', err.message);
        return { error: err.message };
      }),
    ]);
    console.log('[Cron] reminders processed:', remindersResult);
    console.log('[Cron] commission periods ensured:', periodsResult);
    return res.json({ ok: true, ...remindersResult, commissionPeriods: periodsResult });
  } catch (err) {
    console.error('[Cron] reminders error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

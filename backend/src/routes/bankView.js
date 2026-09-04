'use strict';

const express   = require('express');
const router    = express.Router();
const linkStore = require('../store/linkStore');

function formatSortCode(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 6) return `${digits.slice(0,2)}-${digits.slice(2,4)}-${digits.slice(4,6)}`;
  return raw;
}

function expiredPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Link expired</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{background:#fff;border-radius:16px;padding:48px 32px;max-width:420px;width:100%;text-align:center;box-shadow:0 2px 16px rgba(0,0,0,.08)}h1{font-size:22px;color:#374151;margin-bottom:12px}p{color:#6b7280;font-size:15px;line-height:1.6}</style>
</head>
<body>
  <div class="card">
    <div style="font-size:40px;margin-bottom:16px">🔒</div>
    <h1>This link is no longer valid</h1>
    <p>The payment details link has expired or been cancelled. Please contact your clinic for assistance.</p>
  </div>
</body>
</html>`;
}

function detailsPage(row) {
  const clinic    = row.trading_name || row.legal_entity_name || 'Your Clinic';
  const patient   = row.patient_name || '';
  const treatment = row.treatment_description || '';
  const amount    = row.amount_due || row.total_cost;
  const amountStr = amount ? `€${Number(amount).toFixed(2)}` : null;
  const reference = patient || row.case_id?.slice(0, 8).toUpperCase() || '';
  const sortCode  = formatSortCode(row.sort_code);

  const rows = [
    row.bank_name      && ['Bank',           row.bank_name],
    row.bank_account_name && ['Account holder', row.bank_account_name],
    sortCode           && ['Sort code',      sortCode],
    row.account_number && ['Account number', row.account_number],
    reference          && ['Reference',      reference],
  ].filter(Boolean);

  const detailRows = rows.map(([label, value]) => `
    <div class="detail-row">
      <span class="detail-label">${label}</span>
      <span class="detail-value">${value}</span>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Payment details — ${clinic}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4f8;min-height:100vh;padding:24px 16px}
    .container{max-width:460px;margin:0 auto}
    .logo{text-align:center;margin-bottom:20px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#2563EB}
    .card{background:#fff;border-radius:16px;padding:28px 24px;box-shadow:0 2px 16px rgba(0,0,0,.08);margin-bottom:12px}
    h1{font-size:20px;font-weight:800;color:#0d1426;margin-bottom:4px}
    .clinic{color:#6b7280;font-size:14px;margin-bottom:20px}
    .amount{font-size:36px;font-weight:900;color:#2563EB;text-align:center;padding:16px 0 20px}
    .section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:12px}
    .bank-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px}
    .detail-row{display:flex;justify-content:space-between;align-items:baseline;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:15px;gap:12px}
    .detail-row:last-child{border-bottom:none}
    .detail-label{color:#6b7280;white-space:nowrap}
    .detail-value{font-weight:700;color:#0d1426;text-align:right;word-break:break-all}
    .ref-note{margin-top:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px}
    .ref-note p{color:#1d4ed8;font-size:13px}
    .ref-note strong{font-weight:700}
    .footer{text-align:center;margin-top:20px;color:#9ca3af;font-size:12px;line-height:1.6}
    ${treatment ? '.treat{color:#475569;font-size:13px;margin-bottom:16px;line-height:1.5}' : ''}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">CareNova</div>
    <div class="card">
      <h1>Payment details</h1>
      <p class="clinic">${clinic}</p>
      ${treatment ? `<p class="treat">${treatment}</p>` : ''}
      ${amountStr ? `<div class="amount">${amountStr}</div>` : ''}
      <p class="section-label">Bank transfer</p>
      <div class="bank-box">
        ${detailRows || '<p style="color:#9ca3af;font-size:14px">Contact the clinic for bank details.</p>'}
      </div>
      <div class="ref-note">
        <p>When making your transfer please use <strong>${reference}</strong> as the payment reference.</p>
      </div>
    </div>
    <div class="footer">
      This page is for your personal use only. Do not share this link.<br />
      Powered by CareNova&nbsp;AI
    </div>
  </div>
</body>
</html>`;
}

router.get('/:token', async (req, res) => {
  try {
    const row = await linkStore.getByToken(req.params.token);
    if (!row) {
      return res.status(404).send(expiredPage());
    }
    await linkStore.markOpened(row.id);
    res.set('Cache-Control', 'no-store');

    if ((row.kind === 'payment' || row.kind === 'signature') && row.target_url) {
      return res.redirect(302, row.target_url);
    }

    res.send(detailsPage(row));
  } catch (err) {
    console.error('[BankView] error:', err.message);
    res.status(500).send(expiredPage());
  }
});

module.exports = router;

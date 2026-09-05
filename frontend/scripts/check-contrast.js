#!/usr/bin/env node
'use strict';

/**
 * Computes WCAG contrast ratios for every text/surface pair used by the
 * "Clinical White" token system (light + dark) and writes the results to
 * docs/contrast-report.md. Exits 1 if any pair meant for body text fails
 * AA (4.5:1 normal text, 3:1 large text/UI components).
 *
 * Run manually: node scripts/check-contrast.js
 * (Not wired into `npm run build` — it's a design-review tool, not a build
 * gate; failing it shouldn't block a deploy the way a compile error does.)
 */

const fs = require('fs');
const path = require('path');

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

function relLuminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(hex1, hex2) {
  const L1 = relLuminance(hexToRgb(hex1));
  const L2 = relLuminance(hexToRgb(hex2));
  const [lighter, darker] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (lighter + 0.05) / (darker + 0.05);
}

// ── Token values (must match src/index.css) ─────────────────────────────────

const LIGHT = {
  'surface-0': '#FFFFFF', 'surface-1': '#F6F8FA', 'surface-2': '#EDF1F5',
  'ink': '#0B1F33', 'ink-muted': '#5A6B7C', 'ink-subtle': '#64748B',
  'accent': '#1B6FEA', 'accent-hover': '#1559C4',
  'success': '#0EA47A', 'warning': '#C77A0A', 'danger': '#E0483B',
  'white': '#FFFFFF',
};

const DARK = {
  'surface-0': '#0F1626', 'surface-1': '#070B14', 'surface-2': '#1A2437',
  'ink': '#E8EDF5', 'ink-muted': '#94A3B8', 'ink-subtle': '#64748B',
  'accent': '#2563EB', 'accent-hover': '#2E6EE0',
  'success': '#34D399', 'warning': '#F59E0B', 'danger': '#F87171',
  'white': '#FFFFFF',
};

// [textToken, surfaceToken, minimum required ratio, note]
const PAIRS = [
  ['ink',        'surface-0', 4.5, 'Body text on card'],
  ['ink',        'surface-1', 4.5, 'Body text on page background'],
  ['ink',        'surface-2', 4.5, 'Body text on sunken/input surface'],
  ['ink-muted',  'surface-0', 4.5, 'Muted text on card'],
  ['ink-muted',  'surface-1', 4.5, 'Muted text on page background'],
  ['ink-muted',  'surface-2', 4.5, 'Muted text on sunken/input surface'],
  ['ink-subtle', 'surface-0', 3.0, 'Subtle text on card (large/UI text only)'],
  ['ink-subtle', 'surface-1', 3.0, 'Subtle text on page background (large/UI text only)'],
  ['ink-subtle', 'surface-2', 3.0, 'Subtle text on sunken surface — riskiest pair per design brief'],
  ['white',      'accent',       4.5, 'White button/badge text on accent'],
  ['white',      'accent-hover', 4.5, 'White button/badge text on accent-hover'],
  ['accent',     'surface-0',    3.0, 'Accent used as link/icon (large/UI text only)'],
  ['accent',     'surface-1',    3.0, 'Accent used as link/icon on page bg (large/UI text only)'],
  ['success',    'surface-0',    3.0, 'Success icon/text on card'],
  ['warning',    'surface-0',    3.0, 'Warning icon/text on card'],
  ['danger',     'surface-0',    3.0, 'Danger icon/text on card'],
];

function runTheme(name, tokens) {
  const rows = [];
  let failCount = 0;
  for (const [textKey, surfaceKey, min, note] of PAIRS) {
    const ratio = contrastRatio(tokens[textKey], tokens[surfaceKey]);
    const pass = ratio >= min;
    if (!pass) failCount++;
    rows.push({ textKey, surfaceKey, ratio, min, pass, note });
  }
  return { name, rows, failCount };
}

const results = [runTheme('Light (default)', LIGHT), runTheme('Dark', DARK)];

// ── Report ───────────────────────────────────────────────────────────────

let md = `# Kontrast Raporu — "Klinik Beyazı" Renk Sistemi\n\n`;
md += `WCAG AA eşiği: normal metin 4.5:1, büyük metin/UI bileşeni 3:1. Otomatik üretildi — \`node scripts/check-contrast.js\`.\n\n`;

let totalFail = 0;
for (const { name, rows, failCount } of results) {
  totalFail += failCount;
  md += `## ${name}\n\n`;
  md += `| Metin | Zemin | Oran | Eşik | Sonuç | Not |\n`;
  md += `|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    md += `| ${r.textKey} | ${r.surfaceKey} | ${r.ratio.toFixed(2)}:1 | ${r.min}:1 | ${r.pass ? '✅' : '❌'} | ${r.note} |\n`;
  }
  md += `\n${failCount === 0 ? '✅ Tüm çiftler geçti.' : `❌ ${failCount} çift eşiği geçemedi.`}\n\n`;
}

const outPath = path.join(__dirname, '..', '..', 'docs', 'contrast-report.md');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, md);
console.log(`[contrast] Wrote ${outPath}`);
console.log(totalFail === 0 ? '[contrast] All pairs pass.' : `[contrast] ${totalFail} pair(s) failed.`);

if (totalFail > 0) process.exitCode = 1;

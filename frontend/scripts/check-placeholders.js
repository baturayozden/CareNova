#!/usr/bin/env node
'use strict';

/**
 * Fails the build while business registration values are still missing, or if a
 * placeholder token would ship.
 *
 * Two checks:
 *   1. Empty required values in src/lib/businessDetails.ts. These are omitted
 *      from the UI and from JSON-LD rather than rendered, so nothing looks
 *      broken — but the build should still refuse to call itself release-ready.
 *   2. Literal TODO_ / COPY_VERBATIM_ tokens anywhere in src or public, in case
 *      one is ever inlined directly instead of going through businessDetails.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let failed = false;

// ── 1. Empty required business values ────────────────────────────────────────
const REQUIRED = ['taxOrCompanyNumber', 'kvkkVerbisNumber', 'phone'];
const detailsPath = path.join(ROOT, 'src/lib/businessDetails.ts');
const details = fs.readFileSync(detailsPath, 'utf8');

const missing = REQUIRED.filter(key => {
  const m = details.match(new RegExp(`${key}\\s*:\\s*'([^']*)'`));
  return !m || !m[1].trim();
});

if (missing.length) {
  console.error(`[placeholders] Missing business values in src/lib/businessDetails.ts: ${missing.join(', ')}`);
  failed = true;
}

// ── 2. Literal placeholder tokens ────────────────────────────────────────────
const TOKENS = ['TODO_TAX_COMPANY_NUMBER', 'TODO_KVKK_VERBIS_NUMBER', 'TODO_PHONE', 'COPY_VERBATIM_'];
const hits = execSync(
  `grep -rn "${TOKENS.join('\\|')}" src public --include="*.tsx" --include="*.ts" --include="*.html" || true`,
  { cwd: ROOT, encoding: 'utf8' },
).trim();

if (hits) {
  console.error('[placeholders] Literal placeholder tokens found:\n' + hits);
  failed = true;
}

// ── Verdict ──────────────────────────────────────────────────────────────────
if (failed) {
  console.error('\n[placeholders] These are real business values and must be supplied before release.');
  if (!process.env.ALLOW_PLACEHOLDERS) {
    console.error('[placeholders] Set ALLOW_PLACEHOLDERS=1 to build anyway (pre-launch only).');
    process.exit(1);
  }
  console.error('[placeholders] ALLOW_PLACEHOLDERS set — continuing.\n');
}

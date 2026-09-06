#!/usr/bin/env node
'use strict';

/**
 * Scans the rendered landing page in BOTH languages for i18n leaks:
 *   - TR mode: a UI label that's still in English (e.g. an eyebrow/kicker
 *     span with a hardcoded literal instead of a `pick()`-driven function).
 *   - EN mode: leftover Turkish text (e.g. a hardcoded "Kaynak:" prefix that
 *     doesn't flip with the rest of the page).
 *
 * A first version of this script tried a generic "does this look like
 * English/Turkish" heuristic over every visible text node. It produced 59+
 * false positives on the TR page alone — Turkish has plenty of ordinary
 * words spelled with no special characters at all (Klinik, Vaka, Komisyon,
 * Solo, Kanal, Kurulum, Dil, Kesintisiz...), so "looks like plain Latin
 * letters" is not a usable signal for "is untranslated English" in either
 * direction. Rewritten to two narrow, high-precision checks instead:
 *
 *   1. EYEBROW/KICKER LABELS — the actual bug we found (Trust/Aftercare/
 *      Setup/ROI hardcoded as literals). These use a specific, consistent
 *      CSS signature across every section (`uppercase` + a `tracking-*`
 *      class). Rather than guessing whether a label "looks English" (the
 *      approach that just failed), this loads the page ONCE PER LANGUAGE
 *      and compares the two renders POSITIONALLY: the Nth eyebrow element
 *      in TR mode vs. the Nth eyebrow element in EN mode. A real leak
 *      shows up as identical text at the same position (e.g. "Trust" ==
 *      "Trust"); a correctly translated label never does ("Dil" != "Language",
 *      "Kurulum" != "Setup"). No dictionary, no per-word guessing.
 *   2. KNOWN-LEAK DENYLISTS — exact strings that have leaked before in
 *      this project, checked as substrings anywhere on the page. This is
 *      a regression guard for the specific mistakes already found (see
 *      GECE-LOG.md), not a general translator.
 *
 * EN-mode Turkish-character detection is the one broad, low-noise signal
 * that DOES generalize (Turkish-specific letters essentially never occur
 * in genuine English copy) — kept, but with an allowlist for the several
 * real Turkish proper nouns (USHAŞ, TÜİK, VERBİS, HealthTürkiye, personal
 * names) that are correctly identical in both languages because they don't
 * have English equivalents.
 *
 * Known limitations (documented rather than silently assumed away):
 *   - Only checks visible landing-page text, not aria-labels/alt text/meta.
 *   - Both denylists are manually maintained — a genuinely new leak outside
 *     them, or a new legitimate proper noun, needs a one-line addition here.
 *   - Content inside the Hero's WhatsApp mock is skipped — it's a scripted,
 *     illustrative multi-language conversation by design, not a UI label.
 *   - This cannot verify a translation is *correct*, only that something
 *     in the wrong language wasn't left on screen.
 *
 * Requires a server already running (see USAGE below) — this checks the
 * REAL rendered DOM, not the source files, so language detection, i18next
 * initialization and Framer Motion's reveal timing are all exercised
 * exactly as a visitor would experience them.
 *
 * Usage:
 *   npm start                              # in one terminal
 *   node scripts/check-i18n-leaks.js        # in another (defaults to :3002)
 *   I18N_CHECK_URL=http://localhost:3000 node scripts/check-i18n-leaks.js
 */

const fs = require('fs');
const path = require('path');

const URL = process.env.I18N_CHECK_URL || 'http://localhost:3002';
const REPORT_PATH = path.join(__dirname, '..', '..', 'docs', 'i18n-leak-report.md');

const TURKISH_CHARS = /[ğşıöüçİĞŞÖÜÇ]/;

// Real Turkish proper nouns/institution names with no English equivalent —
// legitimately identical in both languages (see CARENOVA-STRATEJI.md for
// each). Stripped out before the Turkish-character check runs, so their
// presence alone never trips an EN-mode false positive.
const EN_MODE_ALLOWED_TR_TOKENS = ['USHAŞ', 'TÜİK', 'VERBİS', 'HealthTürkiye', 'Yıldız'];

// Exact strings that have leaked before, or are structurally identical to a
// leak that has (see GECE-LOG.md "i18n sızıntıları"). Checked as a
// case-sensitive substring anywhere on the page.
const EN_MODE_LEAK_DENYLIST = ['Kaynak:', 'Örnek', 'Yakında'];
const TR_MODE_LEAK_DENYLIST = [
  'Trust', 'Aftercare', 'Setup', 'Recommended', 'Regulatory Shield',
  'What we build on', 'Open menu', 'Close menu', 'Source:',
];

// The eyebrow/kicker CSS signature used consistently across every landing
// section (see e.g. TrustSection.tsx, RoiSection.tsx): a short label styled
// with `uppercase` + a `tracking-*` letter-spacing utility.
const EYEBROW_SELECTOR = '[class*="uppercase"][class*="tracking-"]';
// Text that's SUPPOSED to stay identical between languages (brand/acronyms,
// or content that's genuinely language-invariant) — excluded from the
// eyebrow positional diff so it doesn't get flagged as "didn't change".
const EYEBROW_INVARIANT = new Set(['CareNova', 'WhatsApp', 'AI', 'ROI', 'FAQ', 'KVKK', 'GDPR']);
// Pattern-based invariants: the Aftercare timeline's day markers (D+1,
// D+7, D+30, ...) are a universal notation, not a translated word.
const EYEBROW_INVARIANT_PATTERNS = [/^D\+\d+$/];
function isEyebrowInvariant(text) {
  return EYEBROW_INVARIANT.has(text) || EYEBROW_INVARIANT_PATTERNS.some(p => p.test(text));
}

async function loadPuppeteer() {
  try {
    return require('puppeteer');
  } catch (err) {
    throw new Error(`[i18n-leaks] Could not load puppeteer (${err.message}). Run: npm i -D puppeteer`);
  }
}

/** Runs in-page. Returns { fullText, eyebrows: string[] } — eyebrows in DOM
 *  order, so the Nth entry is comparable 1:1 across a TR and an EN pass of
 *  the same page (same component tree, only the text differs). The hero
 *  mock is hidden (not cloned — a detached clone's `.innerText` is
 *  unreliable in Chromium, since it needs layout info) so its scripted,
 *  multi-language demo conversation never pollutes either check. */
function extractFromPage(heroMockSelector) {
  const heroMock = document.querySelector(heroMockSelector);
  const prevDisplay = heroMock ? heroMock.style.display : null;
  if (heroMock) heroMock.style.display = 'none';

  const fullText = document.body.innerText || '';
  const eyebrows = Array.from(document.querySelectorAll('[class*="uppercase"][class*="tracking-"]'))
    .filter(el => !heroMock || !heroMock.contains(el))
    .map(el => el.textContent.trim())
    .filter(Boolean);

  if (heroMock) heroMock.style.display = prevDisplay;
  return { fullText, eyebrows };
}

function checkDenylist(fullText, denylist, langLabel) {
  const violations = [];
  for (const phrase of denylist) {
    if (fullText.includes(phrase)) {
      violations.push({ section: null, reason: `known-leak phrase "${phrase}" found on the ${langLabel} page` });
    }
  }
  return violations;
}

function checkEnTurkishChars(fullText) {
  const violations = [];
  let stripped = fullText;
  for (const tok of EN_MODE_ALLOWED_TR_TOKENS) stripped = stripped.split(tok).join('');
  for (const rawLine of stripped.split('\n')) {
    const line = rawLine.trim();
    if (line && TURKISH_CHARS.test(line)) {
      violations.push({ section: null, reason: `Turkish character found in "${line.slice(0, 80)}" while page is in EN mode` });
    }
  }
  return violations;
}

/** Compares the Nth eyebrow of the TR render against the Nth eyebrow of the
 *  EN render. Flags any pair that's identical text — a correctly
 *  translated label never matches its counterpart in the other language. */
function checkEyebrowsDiffer(trEyebrows, enEyebrows) {
  const violations = [];
  if (trEyebrows.length !== enEyebrows.length) {
    violations.push({
      section: null,
      reason: `eyebrow count differs between languages (TR: ${trEyebrows.length}, EN: ${enEyebrows.length}) — cannot positionally compare, inspect manually`,
    });
    return violations;
  }
  trEyebrows.forEach((trText, i) => {
    const enText = enEyebrows[i];
    if (trText === enText && !isEyebrowInvariant(trText)) {
      violations.push({ section: null, reason: `eyebrow #${i + 1} is "${trText}" in BOTH TR and EN — looks untranslated` });
    }
  });
  return violations;
}

async function loadInLanguage(page, lang) {
  await page.evaluateOnNewDocument((l) => {
    try { window.localStorage.setItem('carenova_language', l); } catch {}
  }, lang);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  const actualLang = await page.evaluate(() => document.documentElement.lang);
  if (!actualLang.startsWith(lang)) {
    throw new Error(`[i18n-leaks] Asked for lang="${lang}" but document.documentElement.lang="${actualLang}" — language switch did not take effect.`);
  }
  return page.evaluate(extractFromPage, '#hero .relative.bg-surface-raised');
}

async function run() {
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let trViolations = [];
  let enViolations = [];
  let error = null;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const tr = await loadInLanguage(page, 'tr');
    const en = await loadInLanguage(page, 'en');

    const eyebrowViolations = checkEyebrowsDiffer(tr.eyebrows, en.eyebrows);
    trViolations = [...eyebrowViolations, ...checkDenylist(tr.fullText, TR_MODE_LEAK_DENYLIST, 'TR')];
    enViolations = [...checkEnTurkishChars(en.fullText), ...checkDenylist(en.fullText, EN_MODE_LEAK_DENYLIST, 'EN')];
  } catch (err) {
    error = err;
  } finally {
    await browser.close();
  }

  const lines = [
    '# i18n Leak Report',
    '',
    `Checked: ${URL}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'Heuristic scan — see scripts/check-i18n-leaks.js header for exactly what',
    'this does and does not catch (known limitations documented there).',
    '',
  ];

  if (error) {
    lines.push('## ⚠️ Could not complete the check', '', '```', error.message, '```', '');
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
    console.error(error.message);
    console.error(`[i18n-leaks] Is a server running at ${URL}? (npm start, then re-run this script.)`);
    process.exit(1);
  }

  function renderSection(title, violations) {
    lines.push(`## ${title}`, '');
    if (violations.length === 0) {
      lines.push('✅ 0 violations.', '');
      return;
    }
    lines.push(`❌ ${violations.length} violation(s):`, '');
    for (const v of violations) {
      lines.push(`- **[${v.section || '(page-wide)'}]** ${v.reason}`);
    }
    lines.push('');
  }

  renderSection('TR mode — unexpected English labels', trViolations);
  renderSection('EN mode — leftover Turkish text', enViolations);

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');

  const total = trViolations.length + enViolations.length;
  console.log(`[i18n-leaks] TR mode: ${trViolations.length} violation(s). EN mode: ${enViolations.length} violation(s).`);
  console.log(`[i18n-leaks] Report written to ${path.relative(process.cwd(), REPORT_PATH)}`);
  if (total > 0) {
    trViolations.forEach(v => console.error(`  [TR] ${v.reason}`));
    enViolations.forEach(v => console.error(`  [EN] ${v.reason}`));
    process.exit(1);
  }
}

run().catch(err => {
  console.error('[i18n-leaks]', err.message);
  process.exit(1);
});

#!/usr/bin/env node
'use strict';

/**
 * Checks WCAG contrast on the LIVE RENDERED PAGE, not the design-token
 * table. The previous version of this script only checked the *token
 * system's own pairs* (e.g. "does ink-subtle clear 3:1 against surface-2")
 * in the abstract — it could not, and did not, catch a real page bug where
 * a component uses the wrong token/class entirely (e.g. Compliance's dark
 * panel had children reading `text-white`, which — because that class is
 * itself theme-inverted in src/index.css for elements lacking a matching
 * bg-* pairing — silently rendered dark-on-dark). That exact bug shipped
 * and was only found by looking at the actual page. This script now does
 * that automatically: it loads the real DOM, and for every element with
 * its own visible text, resolves the ACTUAL computed foreground color and
 * the ACTUAL effective background (compositing through transparent/
 * semi-transparent ancestors, not assuming a token pairing), then computes
 * the real WCAG ratio.
 *
 * Requires a server already running — see USAGE below.
 *
 * Usage:
 *   npm start                              # in one terminal
 *   node scripts/check-contrast.js          # in another (defaults to :3002)
 *   CONTRAST_CHECK_URL=http://localhost:3000 node scripts/check-contrast.js
 */

const fs = require('fs');
const path = require('path');

const URL = process.env.CONTRAST_CHECK_URL || 'http://localhost:3002';
const REPORT_PATH = path.join(__dirname, '..', '..', 'docs', 'contrast-report.md');

async function loadPuppeteer() {
  try {
    return require('puppeteer');
  } catch (err) {
    throw new Error(`[contrast] Could not load puppeteer (${err.message}). Run: npm i -D puppeteer`);
  }
}

/** Runs in-page. Returns an array of violations: elements whose own visible
 *  text fails the WCAG AA ratio for its effective size/weight. */
function scanContrast(heroMockSelector) {
  function parseColor(str) {
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map(s => parseFloat(s.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }

  function relLuminance({ r, g, b }) {
    const [R, G, B] = [r, g, b].map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  function contrastRatio(fg, bg) {
    const L1 = relLuminance(fg);
    const L2 = relLuminance(bg);
    const [lighter, darker] = L1 > L2 ? [L1, L2] : [L2, L1];
    return (lighter + 0.05) / (darker + 0.05);
  }

  function compositeOver(fg, bg) {
    return {
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
    };
  }

  /** Walk from `el` up to the document root, compositing every ancestor's
   *  (and the element's own) background-color in painter's order —
   *  outermost first — onto an assumed white page canvas. This is what
   *  makes the check correct for translucent panels (bg-white/5 etc.)
   *  stacked on top of a solid dark section, instead of naively reading
   *  just the nearest non-transparent ancestor. */
  function effectiveBackground(el) {
    const layers = [];
    let node = el;
    while (node) {
      const bg = parseColor(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) layers.push(bg);
      node = node.parentElement;
    }
    let result = { r: 255, g: 255, b: 255 };
    for (let i = layers.length - 1; i >= 0; i--) result = compositeOver(layers[i], result);
    return result;
  }

  function isLargeText(cs) {
    const px = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    return px >= 24 || (px >= 18.66 && weight >= 700);
  }

  const heroMock = document.querySelector(heroMockSelector);
  const violations = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  while (node) {
    node = walker.nextNode();
    if (!node) break;
    if (heroMock && heroMock.contains(node)) continue;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH'].includes(node.tagName)) continue;

    const directText = Array.from(node.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent.trim())
      .filter(Boolean)
      .join(' ');
    if (!directText) continue;

    const rect = node.getBoundingClientRect();
    const cs = getComputedStyle(node);
    const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && parseFloat(cs.opacity) > 0.05;
    if (!visible) continue;

    const fg = parseColor(cs.color);
    if (!fg) continue;
    const bg = effectiveBackground(node);
    const foregroundOverBg = compositeOver(fg, bg);
    const ratio = contrastRatio(foregroundOverBg, bg);
    const required = isLargeText(cs) ? 3.0 : 4.5;

    if (ratio < required) {
      const section = node.closest('[id]');
      violations.push({
        section: section ? section.id : null,
        tag: node.tagName.toLowerCase(),
        text: directText.slice(0, 60),
        ratio: Math.round(ratio * 100) / 100,
        required,
        color: `rgb(${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)})`,
        background: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      });
    }
  }
  return violations;
}

async function checkLanguage(page, lang) {
  await page.evaluateOnNewDocument((l) => {
    try { window.localStorage.setItem('carenova_language', l); } catch {}
  }, lang);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  const actualLang = await page.evaluate(() => document.documentElement.lang);
  if (!actualLang.startsWith(lang)) {
    throw new Error(`[contrast] Asked for lang="${lang}" but document.documentElement.lang="${actualLang}" — language switch did not take effect.`);
  }
  return page.evaluate(scanContrast, '#hero .relative.bg-surface-raised');
}

async function run() {
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const results = {};
  let error = null;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    results.tr = await checkLanguage(page, 'tr');
    results.en = await checkLanguage(page, 'en');
  } catch (err) {
    error = err;
  } finally {
    await browser.close();
  }

  const lines = [
    '# Kontrast Raporu — Render Edilmiş Sayfa',
    '',
    `Kontrol edilen: ${URL}`,
    `Oluşturulma: ${new Date().toISOString()}`,
    '',
    'WCAG AA eşiği: normal metin 4.5:1, büyük metin (≥24px, veya ≥18.66px ve',
    'kalın) 3:1. Bu sürüm CANLI DOM üzerinde çalışır — her metin elemanının',
    'gerçek computed rengini ve şeffaf atalar üzerinden çözümlenmiş gerçek',
    'efektif arka planını ölçer; token çiftlerinin teorik uyumunu değil.',
    '',
  ];

  if (error) {
    lines.push('## ⚠️ Kontrol tamamlanamadı', '', '```', error.message, '```', '');
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
    console.error(error.message);
    console.error(`[contrast] ${URL} adresinde bir sunucu çalışıyor mu? (npm start, sonra bu script'i tekrar çalıştır.)`);
    process.exit(1);
  }

  let totalViolations = 0;
  for (const [lang, violations] of Object.entries(results)) {
    totalViolations += violations.length;
    lines.push(`## ${lang.toUpperCase()} modu`, '');
    if (violations.length === 0) {
      lines.push('✅ 0 ihlal.', '');
      continue;
    }
    lines.push(`❌ ${violations.length} ihlal:`, '');
    lines.push('| Bölüm | Eleman | Metin | Oran | Eşik | Renk | Zemin |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const v of violations) {
      lines.push(`| ${v.section || '—'} | \`<${v.tag}>\` | ${v.text} | ${v.ratio}:1 | ${v.required}:1 | ${v.color} | ${v.background} |`);
    }
    lines.push('');
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');

  console.log(`[contrast] TR: ${results.tr.length} ihlal. EN: ${results.en.length} ihlal.`);
  console.log(`[contrast] Rapor yazıldı: ${path.relative(process.cwd(), REPORT_PATH)}`);
  if (totalViolations > 0) {
    for (const [lang, violations] of Object.entries(results)) {
      violations.forEach(v => console.error(`  [${lang.toUpperCase()}] [${v.section || '—'}] <${v.tag}> "${v.text}" — ${v.ratio}:1 (needs ${v.required}:1)`));
    }
    process.exit(1);
  }
}

run().catch(err => {
  console.error('[contrast]', err.message);
  process.exit(1);
});

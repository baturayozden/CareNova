#!/usr/bin/env node
'use strict';

/**
 * Writes the locale-redirect <script> into public/index.html, between the
 * CN_LOCALE_REDIRECT markers, from src/i18n/locales.json.
 *
 * Why generated rather than hand-written: this is the one place that needs the
 * language list in plain HTML, before any bundle loads. Hand-maintaining it
 * would mean "add a language" touches index.html too, and a list that drifts
 * from the router is worse than no redirect at all. Generating it keeps the
 * promise that locales.json is the only file you edit.
 *
 * Why an inline, parser-blocking script rather than code in the bundle:
 * carenova.ai serves PRERENDERED HTML (scripts/prerender.js). A redirect that
 * waits for the bundle would run after the Turkish page has already painted —
 * a visible flash of the wrong language on every first visit. Inline in <head>
 * it runs during parse, before <body> is rendered.
 *
 * Runs before react-scripts build so CRA copies the filled-in file.
 */

const fs = require('fs');
const path = require('path');
const { LOCALES, DEFAULT_LOCALE, X_DEFAULT, LOCALIZED_ROUTES } = require('./lib/locales');

const registry = require('../src/i18n/locales.json');
const INDEX_HTML = path.join(__dirname, '..', 'public', 'index.html');
const START = '<!-- CN_LOCALE_REDIRECT:START -->';
const END = '<!-- CN_LOCALE_REDIRECT:END -->';

function buildSnippet() {
  const config = {
    prefixes: LOCALES.filter(l => l.prefix).map(l => ({ code: l.code, prefix: l.prefix })),
    codes: LOCALES.map(l => l.code),
    localized: LOCALIZED_ROUTES,
    def: DEFAULT_LOCALE.code,
    xdef: X_DEFAULT.code,
    key: registry.choiceStorageKey,
  };

  // Kept deliberately small and dependency-free — it is parser-blocking.
  return `    <script>
      /* GENERATED — edit src/i18n/locales.json, not this. */
      (function () {
        try {
          var C = ${JSON.stringify(config)};

          /* Never redirect an automated client.
             - navigator.webdriver is true under Puppeteer, which is what
               scripts/prerender.js uses: without this the prerenderer's own
               en-US Chromium would follow the redirect and we would bake the
               ENGLISH page into the file served at "/".
             - Googlebot does not set webdriver, so its UA is matched too. This
               is not cloaking: the content is identical either way, we only
               stop auto-redirecting so the crawler can reach and index both
               URLs, which is what Google asks for when hreflang is present.
             - ?nolangredirect is the manual escape hatch. */
          if (navigator.webdriver) return;
          if (/bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pagespeed/i.test(navigator.userAgent || '')) return;
          if (location.search.indexOf('nolangredirect') !== -1) return;

          var path = location.pathname.replace(/\\/+$/, '') || '/';

          /* Already on a locale URL: the URL wins, always. */
          for (var i = 0; i < C.prefixes.length; i++) {
            var p = C.prefixes[i].prefix;
            if (path === p || path.indexOf(p + '/') === 0) return;
          }
          /* Only pages that exist in more than one language participate. */
          if (C.localized.indexOf(path) === -1) return;

          var target = null;
          try { target = localStorage.getItem(C.key); } catch (e) {}

          if (!target) {
            var langs = (navigator.languages && navigator.languages.length)
              ? navigator.languages : [navigator.language || ''];
            for (var j = 0; j < langs.length && !target; j++) {
              var base = String(langs[j]).toLowerCase().split('-')[0];
              if (C.codes.indexOf(base) !== -1) target = base;
            }
            if (!target) target = C.xdef;
          }

          if (!target || target === C.def) return;

          var prefix = '';
          for (var k = 0; k < C.prefixes.length; k++) {
            if (C.prefixes[k].code === target) prefix = C.prefixes[k].prefix;
          }
          if (!prefix) return;

          location.replace((path === '/' ? prefix : prefix + path) + location.search + location.hash);
        } catch (e) {
          /* A redirect problem must never stop the page rendering. */
        }
      })();
    </script>`;
}

function run() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const startIdx = html.indexOf(START);
  const endIdx = html.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`[locale-redirect] Markers missing from ${path.relative(process.cwd(), INDEX_HTML)}.`);
  }

  const next =
    html.slice(0, startIdx + START.length) + '\n' + buildSnippet() + '\n    ' + html.slice(endIdx);

  if (next === html) {
    console.log('[locale-redirect] Already up to date.');
    return;
  }
  fs.writeFileSync(INDEX_HTML, next, 'utf8');
  console.log(
    `[locale-redirect] Injected redirect for ${LOCALES.length} locale(s) ` +
    `(${LOCALES.map(l => l.code).join(', ')}), ${LOCALIZED_ROUTES.length} localized route(s).`,
  );
}

try {
  run();
} catch (err) {
  // Unlike the sitemap, this one IS load-bearing: without it, every non-Turkish
  // visitor silently lands on the Turkish page. Fail the build loudly.
  console.error(err.message);
  process.exit(1);
}

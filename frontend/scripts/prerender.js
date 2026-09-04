#!/usr/bin/env node
'use strict';

/**
 * Prerenders every marketing route to static HTML after react-scripts build.
 *
 * Output goes to build/_hosts/prerendered/<route>/index.html — deliberately NOT
 * to build/<route>/index.html. Vercel checks the filesystem before it applies
 * rewrites, so a file sitting at the real path is served to every host on this
 * deployment. carenova.ai and app.carenova.ai are the same deployment and
 * the same bundle; writing marketing HTML to build/index.html would ship the
 * landing page to the app subdomain's login screen.
 *
 * FAIL-SAFE DIRECTION: vercel.json routes apex(carenova.ai) → prerendered
 * marketing, and EVERYTHING ELSE (the unconditional catch-all — app.carenova.ai,
 * admin.carenova.ai, a typo'd host rule, a future host, this file's own
 * *.vercel.app preview URL) → the app shell. A host-rule misconfiguration can
 * only make marketing briefly serve the app shell — recoverable, no customer
 * impact — never the reverse. app.carenova.ai's production path IS the
 * default path, which means it's exercised by any preview's own hostname with
 * zero host-spoofing and zero real customer traffic.
 *
 * For the same reason the script's last act is to move build/index.html to
 * build/_hosts/app-shell.html and leave nothing at the root. While a real file
 * sits at "/", the filesystem answers first and no rewrite — host-conditional
 * or not — ever runs. With the root empty, every HTML path is governed by
 * rewrites. Static assets keep their real paths and are still served straight
 * from the filesystem — they are host-agnostic.
 *
 * Chromium resolves carenova.ai to the local static server, so
 * window.location.hostname reads "carenova.ai" and App.tsx renders the
 * marketing branch rather than redirecting to /login.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const { allPaths, API_URL, MARKETING_ROUTES } = require('./lib/routes');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const OUT_DIR   = path.join(BUILD_DIR, '_hosts', 'prerendered');
const APEX_HOST = 'carenova.ai';
const NAV_TIMEOUT = 30000;
const READY_TIMEOUT = 20000;
/** Pages rendered at once. Serial would put ~3 min on every deploy. */
const CONCURRENCY = 4;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml',
  '.map':  'application/json',
};

/** Static server over build/, falling back to index.html so SPA routes render. */
function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let filePath = path.join(BUILD_DIR, urlPath);

    // Reject traversal outside build/.
    if (!filePath.startsWith(BUILD_DIR)) {
      res.writeHead(403).end();
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(BUILD_DIR, 'index.html');
    }

    const body = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/**
 * Runs in the page. Resolves once the content we actually care about exists —
 * a fixed delay would silently capture half-rendered pages the day the API is
 * slow, and write them to disk as the canonical HTML.
 */
function readinessCheck(kind, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const canonical = document.querySelector('link[rel="canonical"]');
      const title = document.title;
      const text = document.body.innerText || '';
      const h1 = document.querySelector('h1');

      // Per-kind content assertions. A page can have a title, a canonical and
      // an h1 while its API-driven content is completely missing — the blog
      // index renders its heading and an empty list quite happily. Asserting
      // only the shared chrome would write those empty pages to disk as the
      // canonical HTML for the route.
      let contentOk = true;
      let detail = '';
      if (kind === 'post') {
        const len = document.querySelector('.blog-prose')?.innerText.length || 0;
        contentOk = len > 500;
        detail = ` articleLen=${len}`;
      } else if (kind === 'index') {
        const links = document.querySelectorAll('a[href^="/blog/"]').length;
        contentOk = links >= 10;
        detail = ` postLinks=${links}`;
      }

      if (canonical && title && title !== 'CareNova' && text.length > 500 && h1 && contentOk) {
        return resolve(true);
      }
      if (Date.now() > deadline) {
        return reject(new Error(
          `not ready: canonical=${!!canonical} title="${title}" textLen=${text.length} h1=${!!h1}${detail}`,
        ));
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

/**
 * Strips runtime-injected nodes that must not be baked into a static file.
 * The inline gtag('consent','default',…) block in index.html is left alone —
 * consent mode has to keep firing before the container loads.
 */
function sanitize() {
  const removed = { gtm: 0, banner: 0 };

  document.querySelectorAll('script[src], iframe[src], link[href]').forEach(el => {
    const url = el.src || el.href || '';
    if (/googletagmanager\.com|google-analytics\.com|googletagservices/.test(url)) {
      el.remove();
      removed.gtm++;
    }
  });

  // Prerender runs with no localStorage, so the banner is always open in the
  // snapshot. Baked in, a visitor who already accepted sees it flash on load.
  document.querySelectorAll('[role="dialog"][aria-label="Cookie consent"]').forEach(el => {
    el.remove();
    removed.banner++;
  });

  return removed;
}

/**
 * Two things must hold for the fail-safe direction to actually hold:
 *
 * 1. vercel.json lists the marketing pages explicitly with an apex host
 *    condition, so a page added to MARKETING_ROUTES and not vercel.json (or
 *    vice versa) can't silently serve the wrong thing.
 * 2. The LAST rewrite rule — the one every unmatched host falls through to —
 *    has NO host condition and targets app-shell.html. If a future edit adds
 *    a host condition to it, or repoints its destination, or reorders it
 *    above an apex rule, the whole safety property this file's header
 *    describes is gone, silently. This asserts the shape at every build.
 */
function assertVercelRoutesInSync() {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));

  const marketingRule = cfg.rewrites.find(r => /prerendered\/:page/.test(r.destination || ''));
  if (!marketingRule) throw new Error('[prerender] vercel.json has no marketing-page rewrite rule.');
  const apexHost = marketingRule.has?.find(h => h.type === 'host')?.value;
  if (apexHost !== APEX_HOST) {
    throw new Error(`[prerender] Marketing rewrite must be gated on host "${APEX_HOST}", found "${apexHost}".`);
  }

  const inVercel = new Set((marketingRule.source.match(/\(([^)]+)\)/)?.[1] || '').split('|').filter(Boolean));
  const expected = new Set(MARKETING_ROUTES.map(r => r.path.replace(/^\//, '')).filter(Boolean));
  const missing = [...expected].filter(p => !inVercel.has(p));
  const extra   = [...inVercel].filter(p => !expected.has(p));
  if (missing.length || extra.length) {
    throw new Error(
      '[prerender] vercel.json marketing routes are out of sync with scripts/lib/routes.js.' +
      (missing.length ? `\n  missing from vercel.json: ${missing.join(', ')}` : '') +
      (extra.length ? `\n  not a known route: ${extra.join(', ')}` : ''),
    );
  }

  const lastRule = cfg.rewrites[cfg.rewrites.length - 1];
  if (lastRule.has) {
    throw new Error('[prerender] The final (catch-all) rewrite has a host condition — it must be unconditional so every unmatched host fails safe to the app shell.');
  }
  if (lastRule.destination !== '/_hosts/app-shell.html') {
    throw new Error(`[prerender] The final (catch-all) rewrite must target /_hosts/app-shell.html, found "${lastRule.destination}".`);
  }
}

/**
 * The app shell must be noindex even before React mounts — robots.txt
 * Disallow already blocks well-behaved crawlers, but a page-level directive
 * is the stronger, standard signal and is what a raw (no-JS) curl is expected
 * to show. This is injected only into the app-shell.html COPY, never into the
 * shared build/index.html template that marketing pages are captured from —
 * React's head hoisting doesn't dedupe a pre-existing static <meta> against
 * one a component renders, so a static noindex in the shared template would
 * leave two robots tags in the DOM and risk the wrong one surviving into a
 * Puppeteer snapshot, silently noindexing the entire marketing site.
 */
function injectNoindex(html) {
  return html.replace('</head>', '  <meta name="robots" content="noindex, nofollow">\n  </head>');
}

function outputPathFor(route) {
  const clean = route === '/' ? '' : route.replace(/^\/+|\/+$/g, '');
  return path.join(OUT_DIR, clean, 'index.html');
}

/**
 * Every /blog/:slug and /blog path the vercel.json rewrite can route to must
 * resolve to a real file — an unconditional rewrite to a missing file is not
 * something to gamble on falling through to the SPA shell. In degraded mode
 * (blog API unreachable), no fresh render exists for any blog URL, so this
 * writes the plain app shell to every blog path the CURRENT sitemap.xml still
 * lists (kept from the last healthy build by generate-sitemap.js's own
 * fallback). Visitors and crawlers get the same client-rendered experience
 * they'd have gotten before Phase 2 shipped — not a 404, not a regression.
 * A slug published during the outage and never in that sitemap is the one gap
 * this can't close; narrow enough to accept.
 */
function fallbackBlogShell(shellHtml) {
  const sitemapPath = path.join(__dirname, '..', 'public', '_hosts', 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) return 0;

  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const slugs = [...xml.matchAll(/<loc>https:\/\/carenova\.ai\/blog\/([^<]+)<\/loc>/g)].map(m => m[1]);

  const targets = ['/blog', ...slugs.map(s => `/blog/${s}`)];
  for (const route of targets) {
    const dest = outputPathFor(route);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, shellHtml, 'utf8');
  }
  return targets.length;
}

async function run() {
  if (!fs.existsSync(path.join(BUILD_DIR, 'index.html'))) {
    throw new Error('[prerender] build/index.html missing — run react-scripts build first.');
  }
  const shellHtml = fs.readFileSync(path.join(BUILD_DIR, 'index.html'), 'utf8');

  // Vercel's build image has no Chromium system libraries (libnspr4 and
  // friends), so the Chromium puppeteer downloads will not start there.
  // @sparticuz/chromium ships a build with those linked in. Locally, plain
  // puppeteer is simpler and already has a browser.
  const onVercel = !!process.env.VERCEL;
  let puppeteer;
  let launchOptions = {
    headless: true,
    args: [`--host-resolver-rules=MAP ${APEX_HOST} 127.0.0.1`, '--no-sandbox', '--disable-dev-shm-usage'],
  };

  try {
    if (onVercel) {
      puppeteer = require('puppeteer-core');
      // Ships as ESM with a CJS interop wrapper — args/executablePath live on
      // .default, not on the module object.
      const mod = require('@sparticuz/chromium');
      const chromium = mod.default || mod;
      launchOptions = {
        headless: true,
        args: [...chromium.args, `--host-resolver-rules=MAP ${APEX_HOST} 127.0.0.1`],
        executablePath: await chromium.executablePath(),
        defaultViewport: { width: 1280, height: 900 },
      };
    } else {
      puppeteer = require('puppeteer');
    }
  } catch (err) {
    throw new Error(`[prerender] Could not load a browser (${err.message}). Run: npm i -D puppeteer puppeteer-core @sparticuz/chromium`);
  }

  assertVercelRoutesInSync();

  // Prerendering must never couple a production deploy to the blog API's
  // uptime, for the same reason generate-sitemap.js doesn't: an outage there
  // would otherwise block every deploy, including one that fixes the outage
  // response itself. If the API is down or degraded, fall back to the 9
  // static marketing pages — those need no API call — and skip blog posts for
  // this build. They keep serving the pre-existing client-rendered shell
  // (today's behaviour, not a regression) until the next healthy build
  // prerenders them. This is loud, not silent: a banner, not a warning line.
  let paths;
  let degraded = false;
  try {
    ({ paths } = await allPaths('prerender'));
  } catch (err) {
    degraded = true;
    // /blog itself needs the post list too (its readiness check requires
    // >=10 post links), so it falls back to the client shell along with the
    // individual posts — only the 8 truly static marketing pages render here.
    paths = MARKETING_ROUTES.map(r => r.path).filter(p => p !== '/blog');
    console.warn('\n[prerender] ================================================================');
    console.warn(`[prerender] BLOG API UNAVAILABLE: ${err.message}`);
    console.warn('[prerender] Prerendering marketing pages only. Blog posts will serve the');
    console.warn('[prerender] client-rendered shell (unprerendered, not broken) until the next');
    console.warn('[prerender] deploy with a healthy API. This build is NOT blocked.');
    console.warn('[prerender] ================================================================\n');
  }
  console.log(`[prerender] ${paths.length} route(s) to render${degraded ? ' (degraded mode)' : ''}.`);

  const { server, port } = await startServer();
  const browser = await puppeteer.launch(launchOptions);

  const failures = [];
  let written = 0;
  let gtmStripped = 0;
  let bannersStripped = 0;

  const apiOrigin = new URL(API_URL).origin;

  async function renderOne(route) {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1280, height: 900 });

      // The page runs on http://carenova.ai:<port>, which is not in the
      // backend's CORS allow-list, so every API call would be blocked and the
      // snapshot would capture an empty page. Fetch API requests from Node —
      // where CORS does not apply — and hand the response back to the page.
      // This also means prerendering does not depend on the backend's CORS
      // config, which is a deploy-time concern we should not be coupled to.
      await page.setRequestInterception(true);
      page.on('request', async req => {
        if (!req.url().startsWith(apiOrigin)) return req.continue().catch(() => {});
        try {
          const upstream = await fetch(req.url(), { headers: { accept: 'application/json' } });
          const body = Buffer.from(await upstream.arrayBuffer());
          await req.respond({
            status: upstream.status,
            headers: {
              'content-type': upstream.headers.get('content-type') || 'application/json',
              'access-control-allow-origin': '*',
            },
            body,
          });
        } catch {
          await req.abort().catch(() => {});
        }
      });
      // domcontentloaded, not networkidle — framer-motion keeps the page busy
      // long after the content we care about is on screen. The readiness poll
      // below is the real completion signal.
      await page.goto(`http://${APEX_HOST}:${port}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT,
      });

      const kind = route.startsWith('/blog/') ? 'post' : route === '/blog' ? 'index' : 'page';
      await page.evaluate(readinessCheck, kind, READY_TIMEOUT);

      const removed = await page.evaluate(sanitize);
      gtmStripped += removed.gtm;
      bannersStripped += removed.banner;

      const html = await page.evaluate(() => `<!DOCTYPE html>\n${document.documentElement.outerHTML}`);

      const dest = outputPathFor(route);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, html, 'utf8');
      written++;
      process.stdout.write(`\r[prerender] ${written}/${paths.length} rendered`);
    } catch (err) {
      failures.push({ route, message: err.message });
    } finally {
      await page.close();
    }
  }

  try {
    const queue = [...paths];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let route = queue.shift(); route; route = queue.shift()) {
          await renderOne(route);
        }
      }),
    );
  } finally {
    await browser.close();
    server.close();
  }

  process.stdout.write('\n');
  console.log(`[prerender] Stripped ${gtmStripped} analytics node(s) and ${bannersStripped} consent banner(s).`);

  if (failures.length) {
    console.error(`[prerender] ${failures.length} route(s) failed:`);
    failures.forEach(f => console.error(`  ${f.route} — ${f.message}`));
    throw new Error('[prerender] Build aborted. A partial prerender is worse than none: the routes that did render would go live while the rest silently fall back to the empty shell.');
  }

  if (degraded) {
    // The sitemap still lists ~59 URLs from the last healthy build — comparing
    // against it here would immediately trip on every degraded build. The
    // relevant contract in this mode is just "every marketing page rendered".
    if (written < paths.length) {
      throw new Error(`[prerender] Degraded mode rendered only ${written}/${paths.length} marketing page(s). Build aborted.`);
    }
    const shellCount = fallbackBlogShell(shellHtml);
    console.log(`[prerender] ${written} marketing route(s) rendered, ${shellCount} blog path(s) filled with the app shell (degraded mode).`);
  } else {
    // Full-coverage guard against a partial or stale prerender going
    // unnoticed. The sitemap is the contract for "which URLs exist" when the
    // API is healthy; anything short of it is a regression, not an outage.
    const sitemapPath = path.join(__dirname, '..', 'public', '_hosts', 'sitemap.xml');
    const sitemapCount = (fs.readFileSync(sitemapPath, 'utf8').match(/<loc>/g) || []).length;
    if (written < sitemapCount) {
      throw new Error(`[prerender] Rendered ${written} route(s) but the sitemap lists ${sitemapCount}. Build aborted.`);
    }
    console.log(`[prerender] ${written} route(s) written to ${path.relative(process.cwd(), OUT_DIR)} (sitemap lists ${sitemapCount}).`);
  }

  // Last: clear the root so rewrites govern every HTML path. While
  // build/index.html exists, Vercel's filesystem check answers "/" before any
  // rewrite runs, for every host — including the apex, which would then miss
  // its own marketing rewrite.
  const shellSrc  = path.join(BUILD_DIR, 'index.html');
  const shellDest = path.join(BUILD_DIR, '_hosts', 'app-shell.html');
  fs.mkdirSync(path.dirname(shellDest), { recursive: true });
  fs.writeFileSync(shellDest, injectNoindex(shellHtml), 'utf8');
  fs.unlinkSync(shellSrc);
  console.log('[prerender] Moved build/index.html to _hosts/app-shell.html (noindex injected); root is now empty.');
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});

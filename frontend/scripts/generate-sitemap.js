#!/usr/bin/env node
'use strict';

/**
 * Writes frontend/public/_hosts/sitemap.xml at build time.
 *
 * NOT public/sitemap.xml: Vercel checks the filesystem before it applies
 * rewrites, so a file at the root path is served to every host on this
 * deployment — including app.carenova.ai, where a sitemap listing another
 * host's URLs is non-authoritative dead weight. It lives under _hosts/ and a
 * host-conditional rewrite exposes it at /sitemap.xml on the apex only.
 *
 * The sitemap is a secondary SEO artifact, so it MUST NOT block a production
 * deploy: if the blog API is unreachable or returns fewer than MIN_POSTS, we
 * do NOT fail the build. We keep the existing committed sitemap (generated
 * during a previous healthy build) rather than overwriting it with a degraded
 * marketing-only one — a near-empty sitemap would signal a 9-page site to
 * Google. Only when no sitemap exists at all do we write a marketing-only
 * fallback so robots.txt still resolves.
 *
 * Route list comes from scripts/lib/routes.js, shared with prerender.js.
 */

const path = require('path');
const fs = require('fs');
const { BASE_URL, MARKETING_ROUTES, fetchBlogPosts } = require('./lib/routes');
const { urlsFor, alternatesFor } = require('./lib/locales');

const OUTPUT = path.join(__dirname, '..', 'public', '_hosts', 'sitemap.xml');

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const toDate = iso => (iso ? iso.substring(0, 10) : '');

/** Does an existing sitemap describe this site, or is it a leftover fork artifact? */
function sitemapMatchesThisSite(file) {
  const locs = [...fs.readFileSync(file, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  if (locs.length === 0) return false;
  return locs.every(loc => loc.startsWith(BASE_URL));
}

async function run() {
  let blogPosts;
  try {
    blogPosts = await fetchBlogPosts('sitemap');
    console.log(`[sitemap] Fetched ${blogPosts.length} blog post(s) from API.`);
  } catch (err) {
    // "Keep what a previous healthy build produced" is only the right call when
    // that file actually describes THIS site. The fork inherited CareDental's
    // sitemap, and because api.carenova.ai has never resolved, every build since
    // has taken this branch and preserved it — so carenova.ai/sitemap.xml has
    // been serving 59 caredental.ai URLs. A sitemap for someone else's domain is
    // strictly worse than a short one: every URL in it is a cross-domain 404.
    if (fs.existsSync(OUTPUT) && sitemapMatchesThisSite(OUTPUT)) {
      console.warn(`[sitemap] WARN: ${err.message} — keeping existing ${path.basename(OUTPUT)}; build continues.`);
      return;
    }
    if (fs.existsSync(OUTPUT)) {
      console.warn(`[sitemap] WARN: ${err.message} — existing sitemap is for a different domain, replacing it with a marketing-only one.`);
    } else {
      console.warn(`[sitemap] WARN: ${err.message} and no existing sitemap — writing marketing-only fallback.`);
    }
    blogPosts = [];
  }

  // A localized route contributes one <url> per locale, and EVERY one of them
  // lists the whole alternate set including itself — that reciprocity is what
  // Google requires before it will honour hreflang at all. Routes that exist
  // in a single language contribute one <url> and no alternates.
  const entries = MARKETING_ROUTES.flatMap(route =>
    urlsFor(route.path).map(({ path: urlPath }) => {
      const alternates = alternatesFor(route.path)
        .map(alt => `\n    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />`)
        .join('');
      return `  <url>
    <loc>${escapeXml(BASE_URL + urlPath)}</loc>${alternates}
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
    }),
  );

  for (const post of blogPosts) {
    if (!post.slug) continue;
    const lastmod = post.published_at ? `\n    <lastmod>${toDate(post.published_at)}</lastmod>` : '';
    entries.push(`  <url>
    <loc>${escapeXml(`${BASE_URL}/blog/${post.slug}`)}</loc>${lastmod}
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, xml, 'utf8');

  // prerender.js reads this back to assert it covered every sitemap URL —
  // only when it ran in full-coverage mode; see the comment there.
  console.log(`[sitemap] Wrote ${entries.length} URLs (${MARKETING_ROUTES.length} marketing route(s) expanded across locales + ${blogPosts.length} blog) to ${OUTPUT}`);
}

run().catch(err => {
  // Best-effort artifact — a sitemap problem must never block the deploy.
  console.warn('[sitemap] WARN: unexpected error, skipping sitemap update:', err.message);
});

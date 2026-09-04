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

async function run() {
  let blogPosts;
  try {
    blogPosts = await fetchBlogPosts('sitemap');
    console.log(`[sitemap] Fetched ${blogPosts.length} blog post(s) from API.`);
  } catch (err) {
    if (fs.existsSync(OUTPUT)) {
      console.warn(`[sitemap] WARN: ${err.message} — keeping existing ${path.basename(OUTPUT)}; build continues.`);
      return;
    }
    console.warn(`[sitemap] WARN: ${err.message} and no existing sitemap — writing marketing-only fallback.`);
    blogPosts = [];
  }

  const entries = MARKETING_ROUTES.map(route => `  <url>
    <loc>${escapeXml(BASE_URL + route.path)}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`);

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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, xml, 'utf8');

  // prerender.js reads this back to assert it covered every sitemap URL —
  // only when it ran in full-coverage mode; see the comment there.
  console.log(`[sitemap] Wrote ${entries.length} URLs (${MARKETING_ROUTES.length} marketing + ${blogPosts.length} blog) to ${OUTPUT}`);
}

run().catch(err => {
  // Best-effort artifact — a sitemap problem must never block the deploy.
  console.warn('[sitemap] WARN: unexpected error, skipping sitemap update:', err.message);
});

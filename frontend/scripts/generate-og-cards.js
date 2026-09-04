#!/usr/bin/env node
'use strict';

/**
 * Generates a branded 1200x630 OG card per blog post into build/og/blog/<slug>.png.
 *
 * Runs at build time (not a runtime/edge endpoint) so it fits the existing
 * prerender + Deploy Hook freshness model — a new/edited post gets a fresh
 * card the same way it gets fresh prerendered HTML, on the next deploy.
 *
 * Written to build/og/... (not build/_hosts/...): unlike index.html, a PNG at
 * a real path is not something app.carenova.ai vs carenova.ai routing
 * needs to distinguish — it's just a static file, served identically on every
 * host by Vercel's filesystem check, exactly like /static/js/*.js already is.
 * Not a customer-safety concern the way index.html was.
 *
 * Fails the whole build on any single card failure, matching prerender.js's
 * "partial output is worse than none" posture — these are static, generally-
 * stable Pexels source images, not a live third-party API whose outages are
 * routine, so no degraded-mode fallback here (see prerender.js's blog-API
 * fallback for that pattern, which fits a genuinely volatile dependency).
 */

const fs = require('fs');
const path = require('path');
const { fetchBlogPosts } = require('./lib/routes');
const { renderOgCard } = require('./lib/ogCard');

const OUT_DIR = path.join(__dirname, '..', 'build', 'og', 'blog');

/**
 * The dedup invariant this whole feature depends on: two posts sharing a
 * source image would mean two posts sharing a card's photo panel, which is
 * the exact problem the de-dup pass fixed. This must stay true forever, not
 * just at the moment of the fix — so every build re-asserts it and fails
 * loudly if it ever regresses (a new post picking a stale/reused image, a
 * manual DB edit, whatever the cause).
 */
function assertNoDuplicateImages(posts) {
  const bySource = new Map();
  for (const p of posts) {
    if (!p.image_url) continue;
    if (!bySource.has(p.image_url)) bySource.set(p.image_url, []);
    bySource.get(p.image_url).push(p.slug);
  }
  const dupes = [...bySource.entries()].filter(([, slugs]) => slugs.length > 1);
  if (dupes.length) {
    const lines = dupes.map(([url, slugs]) => `  ${url}\n    used by: ${slugs.join(', ')}`);
    throw new Error(`[og-cards] ${dupes.length} duplicate source image(s) found. Build aborted.\n${lines.join('\n')}`);
  }
}

async function run() {
  const posts = await fetchBlogPosts('og-cards');
  assertNoDuplicateImages(posts);
  console.log(`[og-cards] ${posts.length} post(s), zero duplicate source images. Generating cards...`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let written = 0;
  for (const post of posts) {
    const png = await renderOgCard({
      title: post.title,
      category: post.category,
      imageUrl: post.image_url,
    });
    fs.writeFileSync(path.join(OUT_DIR, `${post.slug}.png`), png);
    written++;
    process.stdout.write(`\r[og-cards] ${written}/${posts.length} generated`);
  }
  process.stdout.write('\n');
  console.log(`[og-cards] Wrote ${written} card(s) to ${path.relative(process.cwd(), OUT_DIR)}.`);
}

run().catch(err => {
  console.error(err.message);
  process.exit(1);
});

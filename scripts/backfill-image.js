'use strict';

try {
  require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
} catch (e) { /* rely on process.env in CI */ }

const { Pool } = require('pg');

// ── Pexels (identical to auto-blog.js) ────────────────────────────────────────

async function fetchPexelsImage(query) {
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: process.env.PEXELS_API_KEY },
    });
    if (!res.ok) throw new Error(`Pexels ${res.status}`);
    const data = await res.json();
    const photo = data.photos && data.photos[0];
    if (!photo) return { image_url: null, image_alt: null, image_credit: null };
    return {
      image_url:    photo.src.large2x || photo.src.large,
      image_alt:    query,
      image_credit: `${photo.photographer} / Pexels`,
    };
  } catch (err) {
    console.warn('[Backfill] Pexels fetch failed:', err.message);
    return { image_url: null, image_alt: null, image_credit: null };
  }
}

// ── Build a dental-contextualised search query ────────────────────────────────

function buildQuery(post) {
  const base = post.focus_keyword || post.title;
  // Keep it short (2-4 words) and append dental context so Pexels returns
  // relevant clinic/patient imagery rather than generic stock.
  const cleaned = base
    .replace(/["""'']/g, '')
    .replace(/\b(how|why|what|when|the|a|an|to|for|in|of|with|your)\b/gi, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(' ');
  return `${cleaned} dental clinic`.trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const { rows } = await pool.query(
    `SELECT id, title, focus_keyword FROM blog_posts WHERE image_url IS NULL ORDER BY published_at DESC`,
  );

  console.log(`[Backfill] Found ${rows.length} post(s) without an image.`);

  let updated = 0;
  let failed  = 0;

  for (const post of rows) {
    const query = buildQuery(post);
    console.log(`[Backfill] "${post.title}" → searching: "${query}"`);

    const image = await fetchPexelsImage(query);

    if (!image.image_url) {
      console.warn(`[Backfill]   ✗ No image found — skipping.`);
      failed++;
      continue;
    }

    await pool.query(
      `UPDATE blog_posts SET image_url = $1, image_alt = $2, image_credit = $3 WHERE id = $4`,
      [image.image_url, image.image_alt, image.image_credit, post.id],
    );

    console.log(`[Backfill]   ✓ Updated: ${image.image_url}`);
    updated++;
  }

  console.log(`\n[Backfill] Done — ${updated} updated, ${failed} skipped.`);
  await pool.end();
}

main().catch(err => {
  console.error('[Backfill] Fatal:', err);
  process.exit(1);
});

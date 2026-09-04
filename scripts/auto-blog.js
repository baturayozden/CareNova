'use strict';

try {
  require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
} catch (e) { /* no .env in CI/cron — rely on process.env */ }

// ─────────────────────────────────────────────────────────────────────────────
// scripts/auto-blog.js
// Auto-blog generation script for CareNova.
// Run via GitHub Actions cron: node scripts/auto-blog.js
//
// ENV required:
//   DATABASE_URL      — PostgreSQL (Supabase)
//   ANTHROPIC_API_KEY — Claude API
//   PEXELS_API_KEY    — Pexels image search
// ─────────────────────────────────────────────────────────────────────────────

const { Pool }    = require('pg');
const Anthropic   = require('@anthropic-ai/sdk');

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-5';

const CONTENT_PILLARS = [
  { pillar: 'Lead recovery & response time for dental clinics',                                        category: 'Lead Recovery' },
  { pillar: 'WhatsApp & multilingual patient communication',                                           category: 'Patient Communication' },
  { pillar: 'Dental practice automation & efficiency (reducing no-shows, front desk)',                 category: 'Automation' },
  { pillar: 'Converting enquiries & handling finance objections (implants, treatment plans)',           category: 'Conversion' },
  { pillar: 'Growing a private dental practice in the UK / London (patient acquisition)',              category: 'Practice Growth' },
  { pillar: 'Dental lead management software comparisons & buyer guides',                              category: 'Buyer Guides' },
];

const INTERNAL_PAGES = [
  { url: '/',        label: 'CareNova home' },
  { url: '/about',   label: 'About CareNova' },
  { url: '/contact', label: 'Contact' },
  { url: '/#cta',    label: 'Book a demo' },
];

// HTML tags that are safe to keep in generated content
const ALLOWED_TAGS = new Set([
  'p','h2','h3','h4','ul','ol','li','strong','em','blockquote','a','br',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip all HTML tags and return plain text */
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Count words in HTML content */
function wordCount(html) {
  return stripHtml(html).split(' ').filter(w => w.length > 0).length;
}

/**
 * Sanitize generated HTML:
 * - Remove <h1>, <script>, <style>, <html>, <body>, <head>
 * - Strip class= and style= attributes
 * - Remove tags not in ALLOWED_TAGS (keep their inner content)
 */
function sanitizeHtml(html) {
  // Remove dangerous/disallowed block tags entirely (including content for script/style)
  let out = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, '')
    .replace(/<\/?(?:html|body|head|header|footer|main|nav|section|article|div|span)\b[^>]*>/gi, '');

  // Strip class= and style= attributes from remaining tags
  out = out.replace(/\s(?:class|style)="[^"]*"/gi, '');
  out = out.replace(/\s(?:class|style)='[^']*'/gi, '');

  // Unwrap tags not in ALLOWED_TAGS (remove the tag but keep inner text)
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
    const lower = tag.toLowerCase();
    if (ALLOWED_TAGS.has(lower)) return match;
    // Self-closing or closing tags outside allowlist — strip silently
    return '';
  });

  return out.trim();
}

/** Pick a random element from an array */
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Build a pillar index that rotates, favouring least-recently-used based on DB categories.
 *  Returns a {pillar, category} object. */
function choosePillar(recentCategories) {
  const usedSet = new Set(recentCategories);
  // Prefer pillars whose short category label hasn't been used recently
  const unused = CONTENT_PILLARS.filter(p => !usedSet.has(p.category));
  return unused.length > 0 ? randomPick(unused) : randomPick(CONTENT_PILLARS);
}

/** Clean stray backticks/markdown fences from AI JSON response */
function cleanJsonResponse(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

// ── Pexels ────────────────────────────────────────────────────────────────────

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
    console.warn('[AutoBlog] Pexels fetch failed — continuing without image:', err.message);
    return { image_url: null, image_alt: null, image_credit: null };
  }
}

// ── AI call #1 — topic + meta ─────────────────────────────────────────────────

async function generateMeta(client, pillar, recentSlugs, attempt = 1) {
  const system =
    'You are a B2B content strategist for CareNova, an AI-powered WhatsApp lead recovery ' +
    'SaaS for UK dental clinics. Audience: dental clinic owners/managers, NOT patients.';

  const recentList = recentSlugs.slice(0, 30).join(', ') || 'none yet';

  const userPrompt =
    `Content pillar: "${pillar}"\n` +
    `Recent slugs already published (DO NOT repeat or closely duplicate): ${recentList}\n\n` +
    'Generate ONE specific, unique blog article topic for this pillar.\n' +
    'Return ONLY valid JSON — no markdown, no backticks, no preamble:\n' +
    '{\n' +
    '  "title": "...",\n' +
    '  "slug": "kebab-case-unique-slug",\n' +
    '  "focus_keyword": "primary SEO keyword phrase",\n' +
    '  "meta_description": "max 155 characters for Google SERP",\n' +
    '  "image_search_query": "2-3 English words for Pexels dental image search"\n' +
    '}';

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: userPrompt }],
    system,
  });

  const raw  = msg.content[0].text;
  const meta = JSON.parse(cleanJsonResponse(raw));

  // Retry if slug collides with a recent post
  if (recentSlugs.includes(meta.slug)) {
    if (attempt >= 3) {
      meta.slug = `${meta.slug}-${Date.now()}`;
      return meta;
    }
    console.warn(`[AutoBlog] Slug collision "${meta.slug}" — retry ${attempt}/3`);
    return generateMeta(client, pillar, recentSlugs, attempt + 1);
  }

  return meta;
}

// ── AI call #2 — full article body ───────────────────────────────────────────

async function generateArticle(client, meta, crossLinkPool, category) {
  const internalLinks = [
    ...INTERNAL_PAGES.map(p => `${p.url} ("${p.label}")`),
    ...crossLinkPool.map(p => `/blog/${p.slug} ("${p.title}")`),
  ].join('\n    ');

  const system =
    'You are a senior B2B content writer for CareNova, an AI-powered WhatsApp lead recovery ' +
    'SaaS for UK dental practices. Write for clinic owners and practice managers, not patients.\n\n' +
    'Write a complete blog article body in clean HTML. STRICT RULES:\n' +
    '- Length: 1900-2300 words. Deepen each section; every H2 has 2-3 full paragraphs.\n' +
    '- NO H1 in body (page title is the only H1). Use 7-9 H2 headings, H3 where needed.\n' +
    '- Intro: 2-3 sentence hook paragraph BEFORE the first H2.\n' +
    '- 40-word direct-answer block right after intro: a <p> that directly answers the main ' +
    'high-intent question in ~40 words (for Google AI Overviews / featured snippets).\n' +
    '- Answer-first: make 3-4 of the H2s question-form; answer in the FIRST sentence of that section.\n' +
    '- "Key Takeaways" section near top: 3-4 bullet summary (<ul>).\n' +
    '- At least one list (<ul> or <ol>). Short paragraphs (2-4 sentences).\n' +
    '- Internal links: 3-5 contextual links using ONLY these real URLs (no invented URLs):\n' +
    `    ${internalLinks}\n` +
    '- External links: 2-3 authoritative UK sources from this whitelist ONLY ' +
    '(homepage or known top-level sections — no deep invented URLs, ' +
    'rel="noopener" target="_blank"):\n' +
    '    gdc-uk.org, nhs.uk, cqc.org.uk, bda.org, ons.gov.uk, gov.uk, ico.org.uk\n' +
    '- NO fabricated statistics. No specific invented percentages or numbers. Use qualitative ' +
    'statements OR cite a real source. (E-E-A-T / trust critical.)\n' +
    '- FAQ section "Frequently Asked Questions" with 3-4 Q&A pairs.\n' +
    '- Single CTA at the very end: book a free demo, link to /#cta.\n' +
    '- Clean HTML only: <p> <h2> <h3> <ul> <li> <ol> <strong> <em> <blockquote> <a>.\n' +
    '  NO <html><body><head>, no inline styles, no class= attributes, no <h1>.\n' +
    'Return ONLY the HTML body. No markdown, no backticks, no preamble.';

  const userPrompt =
    `Title: ${meta.title}\n` +
    `Focus keyword: ${meta.focus_keyword}\n` +
    `Category: ${category}\n\n` +
    'Write the full article following all rules above.';

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4200,
    messages: [{ role: 'user', content: userPrompt }],
    system,
  });

  return msg.content[0].text.trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // ── 1. Fetch recent posts for dedup + cross-link pool ──────────────────
    const { rows: recent } = await pool.query(`
      SELECT slug, title, category
      FROM   blog_posts
      WHERE  is_published = TRUE
      ORDER  BY published_at DESC
      LIMIT  30
    `);

    const recentSlugs      = recent.map(r => r.slug);
    const recentCategories = recent.map(r => r.category).filter(Boolean);
    const crossLinkPool    = recent.slice(0, 8); // top 8 for inline links

    console.log(`[AutoBlog] Found ${recentSlugs.length} recent posts for dedup.`);

    // ── 2. Choose pillar + generate meta ──────────────────────────────────
    const selected = choosePillar(recentCategories);
    console.log(`[AutoBlog] Pillar: "${selected.pillar}" → category: "${selected.category}"`);

    const meta = await generateMeta(client, selected.pillar, recentSlugs);
    console.log(`[AutoBlog] Meta: title="${meta.title}" slug="${meta.slug}"`);

    // ── 3. Pexels image ───────────────────────────────────────────────────
    const image = await fetchPexelsImage(meta.image_search_query || 'dental clinic');
    console.log(`[AutoBlog] Image: ${image.image_url ? 'found' : 'none'}`);

    // ── 4. Generate article body (with one quality retry) ─────────────────
    let rawContent = await generateArticle(client, meta, crossLinkPool, selected.category);
    let content    = sanitizeHtml(rawContent);
    let wc         = wordCount(content);

    if (wc < 1900) {
      console.warn(`[AutoBlog] Word count too low (${wc}) — retrying article generation.`);
      rawContent = await generateArticle(client, meta, crossLinkPool, selected.category);
      content    = sanitizeHtml(rawContent);
      wc         = wordCount(content);
    }

    const isPublished = wc >= 1900;
    if (!isPublished) {
      console.warn(`[AutoBlog] Still under 1900 words (${wc}) after retry — saving as draft (is_published=false).`);
    }

    // ── 5. Final slug uniqueness check ────────────────────────────────────
    let finalSlug = meta.slug;
    const { rows: existing } = await pool.query(
      'SELECT 1 FROM blog_posts WHERE slug = $1 LIMIT 1',
      [finalSlug],
    );
    if (existing.length > 0) {
      finalSlug = `${finalSlug}-2`;
      console.warn(`[AutoBlog] Slug already in DB — using "${finalSlug}".`);
    }

    // ── 6. Derived fields ─────────────────────────────────────────────────
    const readingTime = Math.ceil(wc / 200);
    const excerpt     = meta.meta_description || stripHtml(content).slice(0, 160);

    // ── 7. Insert ─────────────────────────────────────────────────────────
    await pool.query(`
      INSERT INTO blog_posts
        (title, slug, content, excerpt, meta_description, focus_keyword,
         category, image_url, image_alt, image_credit,
         is_published, word_count, reading_time_minutes)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      meta.title,
      finalSlug,
      content,
      excerpt,
      meta.meta_description  || null,
      meta.focus_keyword     || null,
      selected.category,           // short label from pillar map — never from AI
      image.image_url,
      image.image_alt,
      image.image_credit,
      isPublished,
      wc,
      readingTime,
    ]);

    console.log('[AutoBlog] ✓ Done:', {
      title:        meta.title,
      slug:         finalSlug,
      word_count:   wc,
      reading_time: `${readingTime} min`,
      is_published: isPublished,
      image:        image.image_url ? 'yes' : 'none',
    });

    await pool.end();
    process.exit(0);

  } catch (err) {
    console.error('[AutoBlog] ✗ Fatal error:', err);
    try { await pool.end(); } catch (_) {}
    process.exit(1);
  }
}

main();

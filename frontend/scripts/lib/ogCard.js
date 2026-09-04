'use strict';

/**
 * Branded 1200x630 OG card for a blog post: navy left panel (headline, category
 * chip, wordmark) + the post's own photo on the right, split at 62/38 with a
 * gold divider. Built with Satori (JSX -> SVG) + resvg (SVG -> PNG) at build
 * time — no runtime image generation, so it fits the existing prerender +
 * Deploy Hook freshness model instead of adding an edge-function cost.
 *
 * Colors are pulled from the actual marketing site, not approximated:
 *   NAVY = #0a0f1e  -- frontend/src/index.css --navy-950 (dark theme), the
 *                      same token Footer.tsx renders with (bg-navy-950).
 *   GOLD = #c9a84c  -- hardcoded across every marketing page (BlogPage.tsx,
 *                      AboutPage.tsx, BlogPostPage.tsx `const GOLD = ...`,
 *                      HeroSection's gold radial glow rgba(201,168,76,...)).
 * NOT used: Tailwind's `gold` utility class (tailwind.config.js) resolves to
 * #2563EB — blue. That's a legacy/misnamed token for the authenticated app's
 * palette, unrelated to the marketing brand's actual gold.
 */

const fs = require('fs');
const path = require('path');
const satori = require('satori').default;
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');

const CANVAS_W = 1200;
const CANVAS_H = 630;
const LEFT_W = 744; // 62%
const RIGHT_W = CANVAS_W - LEFT_W; // 456, 38%
const DIVIDER_W = 6;

const NAVY = '#0a0f1e';
const GOLD = '#c9a84c';
const WHITE = '#ffffff';
const MUTED = 'rgba(255,255,255,0.55)';

const PAD_X = 72;
const PAD_Y = 56;

const FONT_FAMILY = 'DM Sans';

let fontCache = null;
function loadFonts() {
  if (fontCache) return fontCache;
  const dir = path.join(__dirname, '..', '..', 'node_modules', '@fontsource', 'dm-sans', 'files');
  fontCache = [
    { name: FONT_FAMILY, data: fs.readFileSync(path.join(dir, 'dm-sans-latin-400-normal.woff')), weight: 400, style: 'normal' },
    { name: FONT_FAMILY, data: fs.readFileSync(path.join(dir, 'dm-sans-latin-700-normal.woff')), weight: 700, style: 'normal' },
    { name: FONT_FAMILY, data: fs.readFileSync(path.join(dir, 'dm-sans-latin-800-normal.woff')), weight: 800, style: 'normal' },
  ];
  return fontCache;
}

const LINE_HEIGHT = 1.15;
/** Stepped down until the full title fits; ~34-36px floor per spec. */
const HEADLINE_FONT_SIZES = [54, 48, 44, 40, 36];
/** Character-width heuristic for DM Sans Bold/ExtraBold — see estimateLines. */
const AVG_CHAR_WIDTH_EM = 0.58;

/**
 * Greedy word-wrap used to ESTIMATE how many lines a headline needs at a
 * given font size — not pixel-exact, but only has to decide "does this fit
 * within N lines", and separately (truncateToLines) to compute where real
 * word boundaries fall. The common case (title fits whole) hands the raw
 * string to a width-bound Satori container and lets Satori's actual font
 * metrics do the real wrapping; this heuristic only picks the font size.
 */
function estimateLines(text, fontSize, maxWidthPx) {
  const maxChars = Math.max(1, Math.floor(maxWidthPx / (fontSize * AVG_CHAR_WIDTH_EM)));
  const words = text.split(' ');
  let lines = 1;
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > maxChars && cur) {
      lines++;
      cur = w;
    } else {
      cur = test;
    }
  }
  return { lines, maxChars };
}

function wrapAll(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Truncation is the last resort (see fitHeadline) — only reached when even
 * the floor font size can't fit the whole title in the available height.
 * Breaks are word boundaries ONLY: the ellipsis is appended after a complete
 * word, never mid-word or mid-number ("…vs Closed Reception", never "…Clo…"
 * or "£2,…"). Returns explicit pre-computed lines (not a single string) so
 * the caller can render them directly instead of asking Satori to re-wrap a
 * joined string, which could disagree with this heuristic's line breaks.
 * A small safety margin (0.92x) on maxChars guards against exactly that.
 */
function truncateToLines(text, fontSize, maxWidthPx, maxLines) {
  const safeMaxWidth = maxWidthPx * 0.92;
  const { maxChars } = estimateLines(text, fontSize, safeMaxWidth);
  const allLines = wrapAll(text, maxChars);
  if (allLines.length <= maxLines) return allLines;

  const kept = allLines.slice(0, maxLines);
  const ELLIPSIS = ' …';
  let last = kept[maxLines - 1];
  while (last.length + ELLIPSIS.length > maxChars && last.includes(' ')) {
    last = last.slice(0, last.lastIndexOf(' '));
  }
  kept[maxLines - 1] = last + ELLIPSIS;
  return kept;
}

/**
 * Shrinks the headline through HEADLINE_FONT_SIZES until the whole title
 * fits within maxWidthPx x maxHeightPx (estimated), truncating at the floor
 * size only if nothing fits — most titles fit whole once ~5 lines are
 * available at 54px and the floor goes down to 36px.
 */
function fitHeadline(text, maxWidthPx, maxHeightPx) {
  for (const fontSize of HEADLINE_FONT_SIZES) {
    const lineHeightPx = fontSize * LINE_HEIGHT;
    const maxLinesForHeight = Math.max(1, Math.floor(maxHeightPx / lineHeightPx));
    const { lines } = estimateLines(text, fontSize, maxWidthPx);
    if (lines <= maxLinesForHeight) {
      return { fontSize, lines: null, text }; // whole title — let Satori wrap it for real
    }
  }
  const floor = HEADLINE_FONT_SIZES[HEADLINE_FONT_SIZES.length - 1];
  const maxLinesForHeight = Math.max(1, Math.floor(maxHeightPx / (floor * LINE_HEIGHT)));
  return { fontSize: floor, lines: truncateToLines(text, floor, maxWidthPx, maxLinesForHeight), text: null };
}

function toSentenceCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Fetches a Pexels photo cropped to exactly the right-panel's pixel
 * dimensions and returns it as a base64 data URI Satori can embed directly —
 * Satori does not fetch remote image URLs itself at render time.
 */
async function fetchPanelImage(imageUrl) {
  if (!imageUrl) return null;
  let u;
  try {
    u = new URL(imageUrl);
  } catch {
    return null;
  }
  if (u.hostname !== 'images.pexels.com') return null;

  const cropUrl = `${u.origin}${u.pathname}?auto=compress&cs=tinysrgb&fit=crop&w=${RIGHT_W}&h=${CANVAS_H}`;
  try {
    const res = await fetch(cropUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * @param {object} post
 * @param {string} post.title       - full headline text
 * @param {string} [post.category]  - primary tag; chip omitted if absent
 * @param {string} [post.imageUrl]  - raw Pexels URL; navy full-bleed if absent/unusable
 * @returns {Promise<Buffer>} PNG bytes
 */
// Fixed block sizes around the headline, used to compute how much vertical
// room the headline actually has — kept in sync with the literal style
// values below (wordmark fontSize 30, chip fontSize 20 + 8px padding, accent
// bar 4px, domain fontSize 22) so the estimate matches what's really drawn.
const WORDMARK_H = 36;
const WORDMARK_GAP = 32;
const CHIP_H = 40;
const CHIP_GAP = 20;
const ACCENT_BAR_H = 4;
const ACCENT_BAR_GAP = 24;
const DOMAIN_H = 28;

async function renderOgCard(post) {
  const fonts = loadFonts();
  const panelImage = await fetchPanelImage(post.imageUrl);
  const hasPhoto = !!panelImage;

  const leftWidth = hasPhoto ? LEFT_W : CANVAS_W;
  const textMaxWidth = leftWidth - PAD_X * 2;

  const fixedTop =
    WORDMARK_H + WORDMARK_GAP +
    (post.category ? CHIP_H + CHIP_GAP : 0) +
    ACCENT_BAR_H + ACCENT_BAR_GAP;
  const fixedBottom = DOMAIN_H;
  const headlineMaxHeight = CANVAS_H - PAD_Y * 2 - fixedTop - fixedBottom;

  const headline = fitHeadline(post.title, textMaxWidth, headlineMaxHeight);

  const tree = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: NAVY,
        fontFamily: FONT_FAMILY,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              width: leftWidth,
              height: CANVAS_H,
              padding: `${PAD_Y}px ${PAD_X}px`,
              boxSizing: 'border-box',
            },
            children: [
              // Top, fixed: wordmark
              {
                type: 'div',
                props: {
                  style: { display: 'flex', fontSize: 30, fontWeight: 700, color: WHITE, letterSpacing: -0.5, marginBottom: WORDMARK_GAP },
                  children: 'CareNova',
                },
              },
              // Top, fixed: category chip + accent bar (stay anchored right
              // below the wordmark; only the headline below them is centered)
              ...(post.category
                ? [{
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        alignSelf: 'flex-start',
                        backgroundColor: GOLD,
                        color: NAVY,
                        fontSize: 20,
                        fontWeight: 700,
                        padding: '8px 18px',
                        borderRadius: 999,
                        marginBottom: CHIP_GAP,
                      },
                      children: toSentenceCase(post.category),
                    },
                  }]
                : []),
              {
                type: 'div',
                props: {
                  style: { display: 'flex', width: 56, height: ACCENT_BAR_H, backgroundColor: GOLD, marginBottom: ACCENT_BAR_GAP },
                },
              },
              // Flexible middle: headline, vertically centered in whatever
              // space is left between the accent bar and the domain line —
              // short titles sit centered with room around them, long
              // titles fill more of the same zone, neither top-anchored
              // with a visible gap below.
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexGrow: 1, alignItems: 'center' },
                  children: {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        width: textMaxWidth,
                        fontSize: headline.fontSize,
                        fontWeight: 800,
                        lineHeight: LINE_HEIGHT,
                        color: WHITE,
                        letterSpacing: -1,
                      },
                      // Whole-title case: a single string, Satori wraps it with
                      // real font metrics. Truncated case: explicit pre-broken
                      // lines (see truncateToLines) rendered as separate rows so
                      // Satori can't re-wrap them differently than computed.
                      children: headline.lines
                        ? headline.lines.map(line => ({ type: 'div', props: { children: line } }))
                        : headline.text,
                    },
                  },
                },
              },
              // Bottom, fixed: domain
              {
                type: 'div',
                props: {
                  style: { display: 'flex', fontSize: 22, color: MUTED, fontWeight: 400 },
                  children: 'carenova.ai',
                },
              },
            ],
          },
        },
        ...(hasPhoto
          ? [{
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  width: RIGHT_W,
                  height: CANVAS_H,
                  borderLeft: `${DIVIDER_W}px solid ${GOLD}`,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                },
                // A plain <img> with objectFit is Satori's documented, reliable
                // way to embed a bitmap — its `background-image` support is
                // comparatively limited (in testing it silently rendered blank).
                // The source is already cropped server-side to these exact
                // pixel dimensions, so objectFit here is a safety net, not the
                // primary crop mechanism.
                children: {
                  type: 'img',
                  props: {
                    src: panelImage,
                    width: RIGHT_W - DIVIDER_W,
                    height: CANVAS_H,
                    style: { objectFit: 'cover' },
                  },
                },
              },
            }]
          : []),
      ],
    },
  };

  const svg = await satori(tree, { width: CANVAS_W, height: CANVAS_H, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: CANVAS_W } });
  const rawPng = resvg.render().asPng();

  // resvg's PNG encoder is lossless-only, and a full-bleed photo panel pushes
  // that well past a reasonable share-card size (a busy photo alone hit
  // ~320KB raw). Palette quantization is visually near-identical here — most
  // of the frame is flat navy/gold/white UI — and takes the same file to
  // ~90KB.
  return sharp(rawPng).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
}

module.exports = { renderOgCard, CANVAS_W, CANVAS_H, NAVY, GOLD };

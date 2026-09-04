const PEXELS_HOST = 'images.pexels.com';
const APEX_HOST = 'carenova.ai';
const CARD_PATH_PREFIX = '/og/blog/';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * A Pexels photo URL, forced to an exact 1200x630 (1.91:1) crop so
 * WhatsApp/LinkedIn render a clean large card instead of cropping an
 * arbitrary-aspect source image at share time.
 *
 * Verified against production Pexels responses before relying on this:
 *   curl ".../pexels-photo-36700339.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=630"
 *   identify -format "%wx%h" → 1200x630 (confirmed on two distinct photo IDs)
 * Pexels genuinely honors fit=crop at the declared size — this is not an
 * assumption. If that ever changes, treat the image as non-normalizable
 * (see resolveOgImage) rather than trust a stale claim.
 *
 * dpr is deliberately omitted (Pexels defaults to dpr=1) so the declared
 * og:image:width/height match the actual delivered pixel dimensions —
 * declaring 1200x630 while dpr=2 delivers a 2400x1260 file is exactly the
 * kind of mismatch that makes scrapers reject or mis-render the image.
 */
export function normalizePexelsUrl(rawUrl: string): string {
  const u = new URL(rawUrl);
  return `${u.origin}${u.pathname}?auto=compress&cs=tinysrgb&fit=crop&w=${OG_IMAGE_WIDTH}&h=${OG_IMAGE_HEIGHT}`;
}

export interface ResolvedOgImage {
  url: string;
  /** true only when the delivered file is verified to be OG_IMAGE_WIDTH x OG_IMAGE_HEIGHT. */
  knownDimensions: boolean;
}

/**
 * Resolves the image to actually declare as og:image/twitter:image, applying
 * every safety rule a share-card image needs:
 *  - never a non-https URL (scrapers commonly reject or downgrade these)
 *  - never a custom image on the app/admin host (that host serves no
 *    marketing pages today, but this stays true even if that ever changes)
 *  - a Pexels source gets cropped to the verified 1200x630 frame
 *  - anything else keeps its own dimensions unclaimed rather than guessed
 */
export function resolveOgImage(rawUrl: string | undefined, defaultUrl: string): ResolvedOgImage {
  const isAppHost =
    typeof window !== 'undefined' &&
    [process.env.REACT_APP_APP_URL, process.env.REACT_APP_ADMIN_URL]
      .filter(Boolean)
      .some(envUrl => new URL(envUrl as string).hostname === window.location.hostname);

  if (!rawUrl || isAppHost || !rawUrl.startsWith('https://')) {
    return { url: defaultUrl, knownDimensions: true };
  }

  try {
    const u = new URL(rawUrl);
    // Build-time generated card (generate-og-cards.js) — exactly
    // OG_IMAGE_WIDTH x OG_IMAGE_HEIGHT by construction (the Satori canvas
    // size), so no cropping is needed and the dimensions are genuinely known,
    // not inferred.
    if (u.hostname === APEX_HOST && u.pathname.startsWith(CARD_PATH_PREFIX)) {
      return { url: rawUrl, knownDimensions: true };
    }
    if (u.hostname === PEXELS_HOST) {
      return { url: normalizePexelsUrl(rawUrl), knownDimensions: true };
    }
  } catch {
    return { url: defaultUrl, knownDimensions: true };
  }

  return { url: rawUrl, knownDimensions: false };
}

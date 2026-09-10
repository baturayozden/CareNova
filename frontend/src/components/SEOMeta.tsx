import React from 'react';
import { useTranslation } from 'react-i18next';
import { ORGANIZATION_SCHEMA } from '../lib/organizationSchema';
import { resolveOgImage, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '../lib/ogImage';
import { LOCALES, DEFAULT_LOCALE, alternatesFor, canonicalFor } from '../i18n/locales';

interface SEOMetaProps {
  title: string;
  description: string;
  path: string;
  ogType?: string;
  ogImage?: string;
  ogImageAlt?: string;
  structuredData?: object;
}

// Absolute URLs now come from i18n/locales.ts (canonicalFor/alternatesFor),
// which owns BASE_URL — one definition, shared with the sitemap generator.
const DEFAULT_OG_IMAGE = 'https://carenova.ai/og-image.png';
// Actual file dimensions (frontend/public/og-image.png) — must match the real
// asset or platforms that read these before fetching the image render it
// cropped or blank.
const DEFAULT_OG_IMAGE_ALT = 'CareNova — WhatsApp AI for Turkish health tourism clinics';

// React 19 hoists <title>, <meta> and <link> into <head> natively — no library.
// It does NOT hoist <script type="application/ld+json">, so that is rendered
// inline in the body, where crawlers still read it.
export default function SEOMeta({
  title,
  description,
  path,
  ogType = 'website',
  ogImage,
  ogImageAlt,
  structuredData,
}: SEOMetaProps) {
  // `path` is the BASE path (no locale prefix) — callers pass '/', '/about'…
  // The canonical is that path in the locale currently being rendered, so /en
  // canonicals to /en and never to /. Alternates come from the registry and
  // are empty for pages that exist in only one language.
  const { i18n } = useTranslation();
  const locale = LOCALES.find(l => i18n.language?.startsWith(l.code)) ?? DEFAULT_LOCALE;
  const url = canonicalFor(path, locale);
  const alternates = alternatesFor(path);
  const { url: image, knownDimensions } = resolveOgImage(ogImage, DEFAULT_OG_IMAGE);
  const imageAlt = ogImageAlt || (image === DEFAULT_OG_IMAGE ? DEFAULT_OG_IMAGE_ALT : title);

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {/* Generated from i18n/locales.json. A page that exists in one language
          only gets NO alternates at all — the previous version pointed
          hreflang="tr" and hreflang="en" at the same URL, which told Google a
          Turkish version existed for pages that are hardcoded English. */}
      {alternates.map(alt => (
        <link key={alt.hreflang} rel="alternate" hrefLang={alt.hreflang} href={alt.href} />
      ))}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={image} />
      {/* Dimensions only when actually known: the default asset (verified
          1200x630), or a Pexels source forced to that exact crop and
          verified to honor it. Anything else keeps its size unclaimed —
          declaring a wrong size is worse than omitting it. */}
      {knownDimensions && (
        <>
          <meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
          <meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
        </>
      )}
      <meta property="og:image:alt" content={imageAlt} />
      <meta property="og:site_name" content="CareNova" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }}
      />
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
    </>
  );
}

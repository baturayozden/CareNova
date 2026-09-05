import React from 'react';
import { ORGANIZATION_SCHEMA } from '../lib/organizationSchema';
import { resolveOgImage, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '../lib/ogImage';

interface SEOMetaProps {
  title: string;
  description: string;
  path: string;
  ogType?: string;
  ogImage?: string;
  ogImageAlt?: string;
  structuredData?: object;
}

const BASE_URL = 'https://carenova.ai';
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
  const url = `${BASE_URL}${path}`;
  const { url: image, knownDimensions } = resolveOgImage(ogImage, DEFAULT_OG_IMAGE);
  const imageAlt = ogImageAlt || (image === DEFAULT_OG_IMAGE ? DEFAULT_OG_IMAGE_ALT : title);

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {/* TR/EN is a client-side toggle, not separate URLs — so both alternates
          and x-default point at the same path. Honest given the architecture:
          declares language support without claiming URLs that don't exist. */}
      <link rel="alternate" hrefLang="tr" href={url} />
      <link rel="alternate" hrefLang="en" href={url} />
      <link rel="alternate" hrefLang="x-default" href={url} />
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

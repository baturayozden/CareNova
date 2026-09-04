/**
 * Sitewide Organization + WebSite JSON-LD.
 *
 * CareNova is the brand/product name; `legalName` is the Turkish entity that
 * will hold it once incorporated (CARENOVA-STRATEJI.md Bölüm 9, Model A) — see
 * businessDetails.ts for why every identifying field starts empty.
 *
 * `telephone` and the `identifier` array (tax/company + KVKK VERBİS numbers)
 * appear automatically once the values land in businessDetails.ts. Until then
 * they are OMITTED, never emitted as placeholders — a placeholder string in
 * structured data is read by crawlers as a real value.
 *
 * sameAs social links are deliberately empty until CareNova's own accounts
 * exist — do not point these at CareDental's social profiles.
 */
import { BUSINESS } from './businessDetails';

const identifiers = [
  BUSINESS.taxOrCompanyNumber && {
    '@type': 'PropertyValue',
    name: 'Tax/company registration number',
    value: BUSINESS.taxOrCompanyNumber,
  },
  BUSINESS.kvkkVerbisNumber && {
    '@type': 'PropertyValue',
    name: 'KVKK VERBİS registration number',
    value: BUSINESS.kvkkVerbisNumber,
  },
].filter(Boolean);

export const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://carenova.ai/#organization',
      name: 'CareNova',
      ...(BUSINESS.legalName ? { legalName: BUSINESS.legalName } : {}),
      alternateName: 'CareNova AI',
      url: 'https://carenova.ai',
      logo: {
        '@type': 'ImageObject',
        url: 'https://carenova.ai/logo.png',
      },
      description:
        'Türkiye sağlık turizmi klinikleri için çok dilli, WhatsApp tabanlı AI hasta güven ve dönüşüm platformu.',
      email: BUSINESS.email,
      ...(BUSINESS.phone ? { telephone: BUSINESS.phone } : {}),
      ...(BUSINESS.streetAddress ? {
        address: {
          '@type': 'PostalAddress',
          streetAddress: BUSINESS.streetAddress,
          addressLocality: BUSINESS.addressLocality,
          postalCode: BUSINESS.postalCode,
          addressCountry: BUSINESS.addressCountry,
        },
      } : {}),
      ...(identifiers.length ? { identifier: identifiers } : {}),
      areaServed: { '@type': 'Country', name: 'Turkey' },
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://carenova.ai/#website',
      url: 'https://carenova.ai',
      name: 'CareNova',
      publisher: { '@id': 'https://carenova.ai/#organization' },
      inLanguage: 'tr-TR',
    },
  ],
};

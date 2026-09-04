/**
 * Registration details for the legal entity behind the CareNova brand.
 *
 * CareNova is a Türkiye health-tourism product — it does NOT inherit
 * CareDental's UK entity (B4MIND Brand Consulting and Digital Marketing Ltd).
 * CARENOVA-STRATEJI.md Bölüm 9 recommends a standalone Turkish company (Model A)
 * specifically to avoid GDPR/KVKK cross-border-transfer friction; no entity has
 * been incorporated yet, so every field below is intentionally empty.
 *
 * An empty string means "not yet supplied". Every consumer MUST omit the field
 * entirely rather than render a placeholder — a visible broken token on a page
 * that leans on legal/registration compliance reads worse than simply not
 * stating the number. Missing information beats information that looks
 * broken, and in JSON-LD a placeholder is read by crawlers as a real value.
 *
 * Pending — scripts/check-placeholders.js fails the build while any is empty
 * (build it anyway pre-launch with ALLOW_PLACEHOLDERS=1):
 *   taxOrCompanyNumber   MERSİS / vergi no once the TR entity is incorporated.
 *   kvkkVerbisNumber     VERBİS registration (mandatory for health data, no
 *                        50-person/100M-TL exemption per CARENOVA-STRATEJI.md M7.3).
 *   phone                no TR number yet; /contact has zero tel: links.
 */
export const BUSINESS = {
  legalName: '',
  streetAddress: '',
  addressLocality: '',
  postalCode: '',
  addressCountry: 'TR',
  addressLine: '',
  email: 'hello@carenova.ai',

  taxOrCompanyNumber: '',
  kvkkVerbisNumber: '',
  phone: '',
} as const;

/** Values that must be supplied before launch. Consumed by the build guard. */
export const PENDING_BUSINESS_VALUES = (
  ['taxOrCompanyNumber', 'kvkkVerbisNumber', 'phone'] as const
).filter(k => !BUSINESS[k]);

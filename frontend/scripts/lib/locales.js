'use strict';

/**
 * Build-side view of src/i18n/locales.json — the SAME file the app reads
 * through src/i18n/locales.ts. Deliberately not a second copy of the language
 * list: the sitemap, the prerenderer and the <head> redirect snippet all have
 * to agree with what the router actually serves, and the only way to guarantee
 * that is to read one file.
 */

const registry = require('../../src/i18n/locales.json');

const BASE_URL = 'https://carenova.ai';

const LOCALES = registry.locales;
const DEFAULT_LOCALE = LOCALES.find(l => l.code === registry.defaultLocale) || LOCALES[0];
const X_DEFAULT = LOCALES.find(l => l.code === registry.xDefault) || DEFAULT_LOCALE;
const LOCALIZED_ROUTES = registry.localizedRoutes;

function isLocalizedRoute(basePath) {
  return LOCALIZED_ROUTES.includes(basePath);
}

/** Where `basePath` lives in `locale`; unprefixed when the route is single-URL. */
function localizedPath(basePath, locale) {
  if (!isLocalizedRoute(basePath) || !locale.prefix) return basePath;
  return basePath === '/' ? locale.prefix : `${locale.prefix}${basePath}`;
}

/**
 * Every URL `basePath` produces, one per locale (or just itself when the route
 * is not localized). Used by both the sitemap and the prerenderer so they
 * cannot cover different sets of URLs.
 */
function urlsFor(basePath) {
  if (!isLocalizedRoute(basePath)) return [{ locale: DEFAULT_LOCALE, path: basePath }];
  return LOCALES.map(locale => ({ locale, path: localizedPath(basePath, locale) }));
}

/** hreflang alternates for a localized route; empty for single-URL routes. */
function alternatesFor(basePath) {
  if (!isLocalizedRoute(basePath)) return [];
  const alts = LOCALES.map(locale => ({
    hreflang: locale.hreflang,
    href: `${BASE_URL}${localizedPath(basePath, locale)}`,
  }));
  alts.push({ hreflang: 'x-default', href: `${BASE_URL}${localizedPath(basePath, X_DEFAULT)}` });
  return alts;
}

module.exports = {
  BASE_URL,
  LOCALES,
  DEFAULT_LOCALE,
  X_DEFAULT,
  LOCALIZED_ROUTES,
  isLocalizedRoute,
  localizedPath,
  urlsFor,
  alternatesFor,
};

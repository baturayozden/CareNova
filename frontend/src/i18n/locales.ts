// Typed view over locales.json, plus the path<->locale helpers every consumer
// uses. The router, the language switcher, SEOMeta's hreflang tags, the
// sitemap and the <head> redirect snippet all read from here (or from
// scripts/lib/locales.js, which reads the same JSON) — none of them keeps its
// own language list.
//
// SCOPE: marketing host only. The app and admin hosts keep their existing
// localStorage-based language toggle; their language is a logged-in user's
// preference, not a URL fact.
import registry from './locales.json';

export interface Locale {
  /** i18next language code. */
  code: string;
  /** URL prefix, '' for the default locale. */
  prefix: string;
  /** Value for <link rel="alternate" hreflang="..."> */
  hreflang: string;
  /** Short label for the TR/EN switcher. */
  label: string;
  /** Human-readable name. */
  name: string;
}

export const LOCALES: Locale[] = registry.locales;
export const DEFAULT_LOCALE: Locale =
  LOCALES.find(l => l.code === registry.defaultLocale) ?? LOCALES[0];
export const X_DEFAULT: Locale =
  LOCALES.find(l => l.code === registry.xDefault) ?? DEFAULT_LOCALE;
export const LOCALE_CODES: string[] = LOCALES.map(l => l.code);

/** Marketing paths that exist in every locale — see locales.json. */
export const LOCALIZED_ROUTES: string[] = registry.localizedRoutes;

export const BASE_URL = 'https://carenova.ai';

/** localStorage key for an explicit switcher choice — see locales.json. */
export const CHOICE_STORAGE_KEY: string = registry.choiceStorageKey;

/** Content language of the single-URL marketing pages — see locales.json. */
export const UNLOCALIZED_LOCALE: Locale =
  LOCALES.find(l => l.code === registry.unlocalizedLocale) ?? DEFAULT_LOCALE;

/** Prefixed locales only, longest first so '/en-gb' can never be shadowed by '/en'. */
const PREFIXED = LOCALES.filter(l => l.prefix).sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * Which locale a pathname addresses. The URL is the ONLY input — not the
 * browser, not localStorage. `/en` is English for a Turkish visitor too.
 */
export function localeFromPathname(pathname: string): Locale {
  for (const locale of PREFIXED) {
    if (pathname === locale.prefix || pathname.startsWith(`${locale.prefix}/`)) return locale;
  }
  return DEFAULT_LOCALE;
}

/** The pathname with any locale prefix removed — always starts with '/'. */
export function stripLocale(pathname: string): string {
  const locale = localeFromPathname(pathname);
  if (!locale.prefix) return pathname || '/';
  return pathname.slice(locale.prefix.length) || '/';
}

/**
 * Where `basePath` lives in `locale`. A route that is not localized has exactly
 * one URL, so it is returned unprefixed whatever locale is asked for — that is
 * what stops the switcher inventing /en/about.
 */
export function localizedPath(basePath: string, locale: Locale): string {
  const clean = basePath.startsWith('/') ? basePath : `/${basePath}`;
  if (!isLocalizedRoute(clean) || !locale.prefix) return clean;
  return clean === '/' ? locale.prefix : `${locale.prefix}${clean}`;
}

export function isLocalizedRoute(basePath: string): boolean {
  return LOCALIZED_ROUTES.includes(basePath);
}

export interface Alternate {
  hreflang: string;
  href: string;
}

/**
 * hreflang alternates for a base path.
 *
 * A localized route lists every locale plus x-default. A single-URL route gets
 * NO alternates at all: claiming `hreflang="tr"` for a page that only exists in
 * English would tell Google two languages are available and hand Turkish
 * searchers an English page. Self-canonical, no language claim, is the honest
 * signal until the page is actually translated.
 */
export function alternatesFor(basePath: string): Alternate[] {
  if (!isLocalizedRoute(basePath)) return [];
  const alts = LOCALES.map(locale => ({
    hreflang: locale.hreflang,
    href: `${BASE_URL}${localizedPath(basePath, locale)}`,
  }));
  alts.push({ hreflang: 'x-default', href: `${BASE_URL}${localizedPath(basePath, X_DEFAULT)}` });
  return alts;
}

/**
 * The language a given pathname's CONTENT is actually in — what <html lang>
 * must say. For a localized route that is the URL's locale. For a single-URL
 * page it is UNLOCALIZED_LOCALE, not the site default: /about is an English
 * document even though the site's default locale is Turkish.
 */
export function contentLocaleFor(pathname: string): Locale {
  return isLocalizedRoute(stripLocale(pathname)) ? localeFromPathname(pathname) : UNLOCALIZED_LOCALE;
}

/** Canonical URL for a path in a given locale — every page canonicals to itself. */
export function canonicalFor(basePath: string, locale: Locale): string {
  return `${BASE_URL}${localizedPath(basePath, locale)}`;
}

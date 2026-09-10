import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LOCALES, Locale, CHOICE_STORAGE_KEY,
  localeFromPathname, stripLocale, localizedPath, isLocalizedRoute,
} from '../../i18n/locales';

interface Props {
  /** Wrapper classes — lets NavBar's desktop/mobile and Footer keep their own shells. */
  className?: string;
  /** Per-button classes, given the active state. */
  buttonClassName: (active: boolean) => string;
  onPicked?: () => void;
}

/**
 * The one language switcher for the marketing site. Buttons come from
 * i18n/locales.json, so adding a language adds a button here, in the nav, in
 * the mobile menu and in the footer at once.
 *
 * Two things happen on click, and they are deliberately separate:
 *
 *  1. The choice is stored under its OWN key. i18next also caches the active
 *     language, but that cache is written whenever the language changes —
 *     including when it changes just because someone opened /en from a search
 *     result. Treating that as a preference would pin a Turkish visitor to
 *     English forever after one click from Google. Only this button writes
 *     CHOICE_STORAGE_KEY, which is the only key the redirect snippet reads.
 *
 *  2. On a localized route we NAVIGATE to that locale's URL rather than just
 *     switching text in place, because the URL is what defines the language
 *     (KARAR 2). On an English-only page there is no other URL to go to, so we
 *     just switch the surrounding chrome — the honest behaviour until that
 *     page is actually translated.
 */
export default function LocaleSwitcher({ className, buttonClassName, onPicked }: Props) {
  const { i18n } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const basePath = stripLocale(pathname);
  const current = localeFromPathname(pathname);

  const pick = (locale: Locale) => {
    try {
      window.localStorage.setItem(CHOICE_STORAGE_KEY, locale.code);
    } catch {
      // Private mode / site data blocked: the switch still works for this
      // page load, it just will not be remembered. Never a hard failure.
    }
    if (isLocalizedRoute(basePath)) {
      navigate(localizedPath(basePath, locale));
    } else {
      i18n.changeLanguage(locale.code);
    }
    onPicked?.();
  };

  return (
    <div className={className}>
      {LOCALES.map(locale => {
        const active = isLocalizedRoute(basePath)
          ? current.code === locale.code
          : !!i18n.language?.startsWith(locale.code);
        return (
          <button
            key={locale.code}
            type="button"
            lang={locale.code}
            aria-current={active ? 'true' : undefined}
            onClick={() => pick(locale)}
            className={buttonClassName(active)}
          >
            {locale.label}
          </button>
        );
      })}
    </div>
  );
}

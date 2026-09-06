import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import trCommon   from './locales/tr/common.json';
import trAuth     from './locales/tr/auth.json';
import trNav      from './locales/tr/nav.json';
import trLanding  from './locales/tr/landing.json';
import trCases    from './locales/tr/cases.json';
import trPatients from './locales/tr/patients.json';
import trSettings from './locales/tr/settings.json';
import trBilling  from './locales/tr/billing.json';
import trAdmin    from './locales/tr/admin.json';

import enCommon   from './locales/en/common.json';
import enAuth     from './locales/en/auth.json';
import enNav      from './locales/en/nav.json';
import enLanding  from './locales/en/landing.json';
import enCases    from './locales/en/cases.json';
import enPatients from './locales/en/patients.json';
import enSettings from './locales/en/settings.json';
import enBilling  from './locales/en/billing.json';
import enAdmin    from './locales/en/admin.json';

export const defaultNS = 'common';

// Detection order: explicit user/localStorage preference → 'tr'. GECE-3-BRIEFI.md
// Bölüm A.1: 'navigator' used to sit between those two, so any visitor whose
// OS/browser reported a supported language (most commonly 'en') opened the
// app in that language — 'fallbackLng' never even got a chance to run,
// because i18next only falls back when the detected language ISN'T in
// supportedLngs, and 'en' always is. CareNova's default audience is Turkish
// clinics; the browser's language is not a signal we want to auto-follow
// here (unlike a general-audience SaaS), so it's dropped from automatic
// detection entirely. A visitor's explicit choice (the language toggle,
// which calls i18n.changeLanguage() and gets cached below) still sticks
// across visits — this only changes what a BLANK profile opens to.
// The `user.locale` DB column (users table) is applied by AuthContext after
// login, overriding this via i18n.changeLanguage().
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { common: trCommon, auth: trAuth, nav: trNav, landing: trLanding, cases: trCases, patients: trPatients, settings: trSettings, billing: trBilling, admin: trAdmin },
      en: { common: enCommon, auth: enAuth, nav: enNav, landing: enLanding, cases: enCases, patients: enPatients, settings: enSettings, billing: enBilling, admin: enAdmin },
    },
    fallbackLng: 'tr',
    supportedLngs: ['tr', 'en'],
    defaultNS,
    ns: ['common', 'auth', 'nav', 'landing', 'cases', 'patients', 'settings', 'billing', 'admin'],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'carenova_language',
      caches: ['localStorage'],
    },
  });

// Keep <html lang> in sync so screen readers and search engines see the
// active language — i18next only swaps React-rendered text by itself.
const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng;
};
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;

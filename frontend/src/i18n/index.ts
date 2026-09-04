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

import enCommon   from './locales/en/common.json';
import enAuth     from './locales/en/auth.json';
import enNav      from './locales/en/nav.json';
import enLanding  from './locales/en/landing.json';
import enCases    from './locales/en/cases.json';
import enPatients from './locales/en/patients.json';
import enSettings from './locales/en/settings.json';
import enBilling  from './locales/en/billing.json';

export const defaultNS = 'common';

// Detection order: explicit user/localStorage preference → browser language →
// 'tr' fallback (CareNova's default UI language). The `user.locale` DB column
// (users table) is applied by AuthContext after login, overriding this via
// i18n.changeLanguage() — localStorage stays the source of truth between visits.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { common: trCommon, auth: trAuth, nav: trNav, landing: trLanding, cases: trCases, patients: trPatients, settings: trSettings, billing: trBilling },
      en: { common: enCommon, auth: enAuth, nav: enNav, landing: enLanding, cases: enCases, patients: enPatients, settings: enSettings, billing: enBilling },
    },
    fallbackLng: 'tr',
    supportedLngs: ['tr', 'en'],
    defaultNS,
    ns: ['common', 'auth', 'nav', 'landing', 'cases', 'patients', 'settings', 'billing'],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'carenova_language',
      caches: ['localStorage'],
    },
  });

export default i18n;

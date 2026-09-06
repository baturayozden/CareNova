import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { navLinks, navCta, navLogin } from '../../data/landingContent';
import { useTheme } from '../../context/ThemeContext';
import { urlFor } from '../../config/hosts';
import carenovaLogoDark from '../../assets/carenova-logo-transparent-dark.svg';
import carenovaLogoLight from '../../assets/carenova-logo-transparent-light.svg';

const loginUrl = urlFor('app', '/login');

export default function NavBar() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const links = navLinks(i18n.language);
  // The landing page normally stays on the light theme, but [data-theme] is
  // a global attribute — a visitor who toggled dark mode in the dashboard
  // and then lands here would otherwise get a dark-on-transparent logo
  // rendered on a (now dark) nav background. Same variant-by-theme pattern
  // Sidebar.tsx already uses for the app shell's logo.
  const logoSrc = theme === 'dark' ? carenovaLogoDark : carenovaLogoLight;

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-line bg-surface/85 backdrop-blur-md">
      <nav aria-label={i18n.language?.startsWith('tr') ? 'Ana menü' : 'Main navigation'} className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="shrink-0 flex items-center">
          <img src={logoSrc} alt="CareNova" className="h-9 w-auto" />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-ink-muted hover:text-ink transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-line p-0.5">
            {(['tr', 'en'] as const).map(lng => (
              <button
                key={lng}
                onClick={() => i18n.changeLanguage(lng)}
                className={`px-2 py-1 rounded-md text-xs font-semibold uppercase transition-colors ${
                  i18n.language?.startsWith(lng) ? 'bg-accent text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {lng}
              </button>
            ))}
          </div>
          <a
            href={loginUrl}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-sunken transition-colors"
          >
            {navLogin(i18n.language)}
          </a>
          <a href="#cta" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors">
            {navCta(i18n.language)}
          </a>
        </div>

        <button
          onClick={() => setOpen(v => !v)}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-ink"
          aria-label={i18n.language?.startsWith('tr') ? (open ? 'Menüyü kapat' : 'Menüyü aç') : (open ? 'Close menu' : 'Open menu')}
          aria-expanded={open}
        >
          {open ? <X size={22} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={22} strokeWidth={1.5} aria-hidden="true" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden border-t border-line bg-surface"
          >
            <div className="flex flex-col gap-4 px-6 py-5">
              {links.map(l => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-sm font-medium text-ink-muted">
                  {l.label}
                </a>
              ))}
              <div className="flex items-center gap-2">
                {(['tr', 'en'] as const).map(lng => (
                  <button
                    key={lng}
                    onClick={() => i18n.changeLanguage(lng)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase ${
                      i18n.language?.startsWith(lng) ? 'bg-accent text-white' : 'text-ink-muted border border-line'
                    }`}
                  >
                    {lng}
                  </button>
                ))}
              </div>
              <a
                href={loginUrl}
                onClick={() => setOpen(false)}
                className="rounded-xl border border-line px-5 py-2.5 text-center text-sm font-semibold text-ink"
              >
                {navLogin(i18n.language)}
              </a>
              <a href="#cta" onClick={() => setOpen(false)} className="rounded-xl bg-accent px-5 py-2.5 text-center text-sm font-semibold text-white">
                {navCta(i18n.language)}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { navLinks, navCta } from '../../data/landingContent';

export default function NavBar() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const links = navLinks(i18n.language);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-brand-900/10 bg-surface/85 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-display text-xl text-ink shrink-0">
          Care<span className="text-accent-500">Nova</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-ink-muted hover:text-ink transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-brand-900/15 p-0.5">
            {(['tr', 'en'] as const).map(lng => (
              <button
                key={lng}
                onClick={() => i18n.changeLanguage(lng)}
                className={`px-2 py-1 rounded-md text-xs font-semibold uppercase transition-colors ${
                  i18n.language?.startsWith(lng) ? 'bg-brand-500 text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {lng}
              </button>
            ))}
          </div>
          <a href="#cta" className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors">
            {navCta(i18n.language)}
          </a>
        </div>

        <button
          onClick={() => setOpen(v => !v)}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-ink"
          aria-label="Menu"
        >
          {open ? '✕' : '☰'}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden border-t border-brand-900/10 bg-surface"
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
                      i18n.language?.startsWith(lng) ? 'bg-brand-500 text-white' : 'text-ink-muted border border-brand-900/15'
                    }`}
                  >
                    {lng}
                  </button>
                ))}
              </div>
              <a href="#cta" onClick={() => setOpen(false)} className="rounded-xl bg-brand-500 px-5 py-2.5 text-center text-sm font-semibold text-white">
                {navCta(i18n.language)}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

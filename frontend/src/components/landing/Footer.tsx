import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { footerLinks } from '../../data/landingContent';

export default function Footer() {
  const { i18n } = useTranslation();
  const links = footerLinks(i18n.language);

  return (
    <footer className="border-t border-brand-900/10 bg-surface text-ink-muted">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="font-display text-lg text-ink">
          Care<span className="text-accent-500">Nova</span>
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          <Link to="/legal/privacy" className="hover:text-ink transition-colors">{links.privacy}</Link>
          <Link to="/legal/terms" className="hover:text-ink transition-colors">{links.terms}</Link>
          <Link to="/legal/gdpr" className="hover:text-ink transition-colors">{links.kvkk}</Link>
          <Link to="/legal/cookies" className="hover:text-ink transition-colors">{links.cookies}</Link>
          <Link to="/contact" className="hover:text-ink transition-colors">{links.contact}</Link>
        </div>
        <span className="text-xs">© {new Date().getFullYear()} CareNova</span>
      </div>
    </footer>
  );
}

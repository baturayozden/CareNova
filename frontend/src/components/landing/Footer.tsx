import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { footerColumns, footerBlurb } from '../../data/landingContent';
import { BUSINESS } from '../../lib/businessDetails';
import { useTheme } from '../../context/ThemeContext';
import carenovaLogoDark from '../../assets/carenova-logo-transparent-dark.svg';
import carenovaLogoLight from '../../assets/carenova-logo-transparent-light.svg';

function isExternal(href: string) {
  return href.startsWith('#') || href.startsWith('http');
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const className = 'text-sm text-ink-muted hover:text-ink transition-colors';
  return isExternal(href)
    ? <a href={href} className={className}>{children}</a>
    : <Link to={href} className={className}>{children}</Link>;
}

export default function Footer() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const columns = footerColumns(i18n.language);
  const logoSrc = theme === 'dark' ? carenovaLogoDark : carenovaLogoLight;

  return (
    <footer className="border-t border-line bg-surface-page">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-1">
            <img src={logoSrc} alt="CareNova" className="h-7 w-auto mb-3" />
            <p className="text-ink-muted text-sm leading-relaxed">{footerBlurb(i18n.language)}</p>
          </div>

          {Object.values(columns).map(col => (
            <nav key={col.heading} aria-label={col.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-subtle mb-4">{col.heading}</h3>
              <ul className="space-y-2.5 list-none p-0">
                {col.links.map(l => (
                  <li key={l.label}><FooterLink href={l.href}>{l.label}</FooterLink></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-ink-subtle">
            © {new Date().getFullYear()} CareNova{BUSINESS.legalName ? ` — ${BUSINESS.legalName}` : ''}
          </span>
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
        </div>
      </div>
    </footer>
  );
}

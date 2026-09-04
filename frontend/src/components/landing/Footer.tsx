import React from 'react';
import { Link } from 'react-router-dom';

// Minimal site-wide footer shared by public pages. The full CareNova footer
// is built in PAKET 4 — see GECE-CALISMA-BRIEFI.md.
export default function Footer() {
  return (
    <footer className="border-t border-brand-900/20 bg-surface text-ink-muted">
      <div className="mx-auto max-w-6xl px-6 py-8 text-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <span>© {new Date().getFullYear()} CareNova</span>
        <div className="flex gap-4">
          <Link to="/legal/privacy" className="hover:text-ink">Gizlilik</Link>
          <Link to="/legal/terms" className="hover:text-ink">Koşullar</Link>
          <Link to="/contact" className="hover:text-ink">İletişim</Link>
        </div>
      </div>
    </footer>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';

// Minimal site-wide nav shared by public pages (landing, blog, legal, contact,
// careers). The full CareNova nav (logo, platform/pricing/faq links, language
// switcher, demo CTA) is built in PAKET 4 — see GECE-CALISMA-BRIEFI.md.
export default function NavBar() {
  return (
    <header className="border-b border-brand-900/20 bg-surface/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-display text-xl text-ink">
          Care<span className="text-accent-500">Nova</span>
        </Link>
      </nav>
    </header>
  );
}

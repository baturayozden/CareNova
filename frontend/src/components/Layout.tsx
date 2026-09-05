import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import AppMeta from './AppMeta';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { t } = useTranslation('nav');

  return (
    <div className="flex h-screen bg-surface-page">
      <AppMeta title="CareNova" />
      {/* ── Mobile top-bar (hidden on md+) ───────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-surface border-b border-line flex items-center px-4 gap-3 shrink-0">
        {/* eslint-disable i18next/no-literal-string -- ☰ is a symbol; "CareNova" is the brand name, not translatable */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-surface-sunken transition-colors text-xl"
          aria-label={t('openMenu')}
        >
          ☰
        </button>
        <span className="text-white font-semibold text-sm tracking-tight">
          Care<span className="text-accent">Nova</span> AI
        </span>
        {/* eslint-enable i18next/no-literal-string */}
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* ── Main content — top padding on mobile for fixed top-bar ────────── */}
      <main className="flex-1 overflow-y-auto bg-surface-page pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}

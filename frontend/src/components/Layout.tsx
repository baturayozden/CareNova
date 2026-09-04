import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AppMeta from './AppMeta';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-navy-950">
      <AppMeta title="CareNova" />
      {/* ── Mobile top-bar (hidden on md+) ───────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-navy-900 border-b border-navy-600 flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-navy-700 transition-colors text-xl"
          aria-label="Open menu"
        >
          ☰
        </button>
        <span className="text-white font-semibold text-sm tracking-tight">
          Care<span className="text-gold">Dental</span> AI
        </span>
      </div>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* ── Main content — top padding on mobile for fixed top-bar ────────── */}
      <main className="flex-1 overflow-y-auto bg-navy-950 pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}

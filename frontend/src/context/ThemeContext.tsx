import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'light', toggleTheme: () => {} });

// Landing production domain — always force light
const isLandingHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'carenova.ai' || h === 'www.carenova.ai';
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Landing host → always light, skip localStorage
    if (isLandingHost()) {
      document.documentElement.setAttribute('data-theme', 'light');
      return 'light';
    }
    // App/admin subdomains → read stored preference, default light
    const saved = localStorage.getItem('cd-theme');
    const initial: Theme = saved === 'light' || saved === 'dark' ? saved : 'light';
    document.documentElement.setAttribute('data-theme', initial);
    return initial;
  });

  useEffect(() => {
    // Landing host → always light, never touch localStorage
    const effective = isLandingHost() ? 'light' : theme;
    document.documentElement.setAttribute('data-theme', effective);
    if (!isLandingHost()) {
      localStorage.setItem('cd-theme', theme);
    }
  }, [theme]);

  function toggleTheme() {
    // No-op on landing host (toggle button not shown there anyway)
    if (isLandingHost()) return;
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

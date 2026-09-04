/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          // RGB channel values → supports bg-navy-900/40 opacity modifiers
          // Retained for the existing dashboard UI (Leads/Settings/Cases/etc),
          // which is out of scope for the CareNova rebrand tonight.
          950: 'rgb(var(--navy-950) / <alpha-value>)',
          900: 'rgb(var(--navy-900) / <alpha-value>)',
          800: 'rgb(var(--navy-800) / <alpha-value>)',
          700: 'rgb(var(--navy-700) / <alpha-value>)',
          600: 'rgb(var(--navy-600) / <alpha-value>)',
        },
        gold: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          dark: '#1D4ED8',
        },
        // ── CareNova brand tokens (Bölüm 4 / KOMUT 2) — used by the landing
        // page and new CareNova-specific UI. Never hardcode the hex values below.
        brand: {
          // Deep petrol/teal — #0E4F52 family
          DEFAULT: '#0E4F52',
          50:  '#E6EEEE',
          100: '#CCDDDD',
          300: '#5F9295',
          500: '#0E4F52',
          700: '#0A3A3C',
          900: '#062526',
        },
        accent: {
          // Warm amber — #D99A2B family
          DEFAULT: '#D99A2B',
          50:  '#FBF3E4',
          100: '#F6E7C9',
          300: '#E7BC6E',
          500: '#D99A2B',
          700: '#A97418',
          900: '#6E4B0F',
        },
        surface: {
          // Light theme: bone white · Dark theme: near-black petrol
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised:  'rgb(var(--surface-raised) / <alpha-value>)',
        },
        ink: {
          // Body text — dark ink on light theme, off-white on dark theme
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted:   'rgb(var(--ink-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        serif: ['Instrument Serif', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
        // CareNova brand typefaces (Bölüm 4) — headings/body for landing + new UI
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Hanken Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

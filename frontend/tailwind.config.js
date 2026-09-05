/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── "Clinical White" unified token system ─────────────────────────
        // Replaces the old navy/gold (dashboard) + brand/accent (landing)
        // split. One system, light-first, dark as the secondary theme.
        surface: {
          DEFAULT: 'rgb(var(--surface-0) / <alpha-value>)', // card / panel / sidebar
          page:    'rgb(var(--surface-1) / <alpha-value>)', // page background
          sunken:  'rgb(var(--surface-2) / <alpha-value>)', // input / hover / sunken row
        },
        line: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          strong:  'rgb(var(--border-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted:   'rgb(var(--ink-muted) / <alpha-value>)',
          subtle:  'rgb(var(--ink-subtle) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover:   'rgb(var(--accent-hover) / <alpha-value>)',
          soft:    'rgb(var(--accent-soft) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          soft:    'rgb(var(--success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          soft:    'rgb(var(--warning-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft:    'rgb(var(--danger-soft) / <alpha-value>)',
        },
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        serif: ['Instrument Serif', 'serif'],
        sans: ['Hanken Grotesk', 'DM Sans', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Hanken Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

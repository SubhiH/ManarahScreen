/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        arabic: ['Amiri', 'serif'],
      },
      colors: {
        masjid: {
          gold: '#d4af37',
          teal: '#0f766e',
          deep: '#0b1220',
        },
        theme: {
          bg: 'rgb(var(--t-bg-rgb) / <alpha-value>)',
          surface: 'rgb(var(--t-surface-rgb) / <alpha-value>)',
          border: 'rgb(var(--t-border-rgb) / <alpha-value>)',
          text: 'rgb(var(--t-text-rgb) / <alpha-value>)',
          'text-dim': 'rgb(var(--t-text-dim-rgb) / <alpha-value>)',
          accent: 'rgb(var(--t-accent-rgb) / <alpha-value>)',
          'accent-contrast': 'rgb(var(--t-accent-contrast-rgb) / <alpha-value>)',
          next: 'rgb(var(--t-next-rgb) / <alpha-value>)',
        },
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--t-accent-rgb) / 0.6)' },
          '50%': { boxShadow: '0 0 40px 12px rgb(var(--t-accent-rgb) / 0.25)' },
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

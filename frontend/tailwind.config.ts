import type { Config } from 'tailwindcss'

/**
 * Claude-style design tokens.
 * Warm ivory canvas, terracotta/clay accent, soft borders, generous radii.
 * Colors are exposed as CSS variables (see index.css) so light/dark swap
 * with a single `.dark` class toggle driven by the Telegram color scheme.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-sunken': 'rgb(var(--c-surface-sunken) / <alpha-value>)',
        border: 'rgb(var(--c-border) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--c-accent-hover) / <alpha-value>)',
        'accent-soft': 'rgb(var(--c-accent-soft) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        'chart-cpu': 'rgb(var(--c-chart-cpu) / <alpha-value>)',
        'chart-ram': 'rgb(var(--c-chart-ram) / <alpha-value>)',
        'chart-net': 'rgb(var(--c-chart-net) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'ui-serif', 'serif'],
        sans: [
          'Hanken Grotesk',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
      },
      boxShadow: {
        // Flat — Claude relies on hairline borders, not shadow.
        card: 'none',
        btn: '0 1px 2px rgb(120 70 50 / 0.16)',
        sheet: '0 -8px 40px rgb(0 0 0 / 0.18)',
        pop: '0 10px 34px rgb(60 40 30 / 0.16)',
      },
      keyframes: {
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'drawer-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'push-in': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'toast-in': {
          from: { transform: 'translateY(-16px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'sheet-up': 'sheet-up 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        'drawer-in': 'drawer-in 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        'push-in': 'push-in 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        'toast-in': 'toast-in 0.24s cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config

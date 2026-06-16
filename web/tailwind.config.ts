import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-elevated': 'var(--bg-elevated)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        hover: 'var(--hover)',
        accent: 'var(--accent)',
        'accent-dim': 'var(--accent-dim)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-on-violet': 'var(--text-on-violet)',
        positive: 'var(--positive)',
        negative: 'var(--negative)',
        neutral: 'var(--neutral-color)',
        warning: 'var(--warning)',
        violet: {
          50:  'var(--violet-50)',
          100: 'var(--violet-100)',
          200: 'var(--violet-200)',
          300: 'var(--violet-300)',
          400: 'var(--violet-400)',
          500: 'var(--violet-500)',
          600: 'var(--violet-600)',
          700: 'var(--violet-700)',
          900: 'var(--violet-900)',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'aurora-drift-1': {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
          '33%':       { transform: 'translate(5%, -8%) scale(1.05)' },
          '66%':       { transform: 'translate(-4%, 6%) scale(0.97)' },
        },
        'aurora-drift-2': {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1.1)' },
          '50%':      { transform: 'translate(-6%, 10%) scale(1)' },
        },
        'aurora-drift-3': {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
          '40%':      { transform: 'translate(8%, -5%) scale(1.08)' },
          '80%':      { transform: 'translate(-3%, 3%) scale(0.95)' },
        },
      },
      animation: {
        'aurora-1': 'aurora-drift-1 60s ease-in-out infinite',
        'aurora-2': 'aurora-drift-2 80s ease-in-out infinite',
        'aurora-3': 'aurora-drift-3 70s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config

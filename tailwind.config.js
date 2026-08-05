/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        background: { DEFAULT: 'var(--background)' },
        foreground: { DEFAULT: 'var(--foreground)' },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          light: 'var(--primary-light)',
          dark: 'var(--primary-dark)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
          light: 'var(--accent-light)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        border: { DEFAULT: 'var(--border)' },
        input: { DEFAULT: 'var(--input)' },
        ring: { DEFAULT: 'var(--ring)' },
        pastel: {
          blue: 'var(--pastel-blue)',
          lavender: 'var(--pastel-lavender)',
          gold: 'var(--pastel-gold)',
          pink: 'var(--pastel-pink)',
          mint: 'var(--pastel-mint)',
        },
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'calc(var(--radius) - 4px)',
        lg: 'calc(var(--radius) + 4px)',
        xl: 'calc(var(--radius) + 8px)',
        '2xl': 'calc(var(--radius) + 12px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
      },
      boxShadow: {
        'mystic': '0 4px 24px 0 rgba(124, 110, 170, 0.10)',
        'mystic-lg': '0 8px 32px 0 rgba(124, 110, 170, 0.18)',
        'mystic-xl': '0 16px 48px 0 rgba(124, 110, 170, 0.24)',
      },
      backgroundImage: {
        'gradient-mystic': 'var(--gradient-mystic)',
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-hero': 'var(--gradient-hero)',
        'gradient-card': 'var(--gradient-card)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
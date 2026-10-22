/**
 * NOAN Studio design system.
 *
 * `amber` is remapped to the NOAN brand orange (logo chick) and `slate` to a
 * crisp neutral scale, so every existing page that uses these utilities picks
 * up the new visual language from one place.
 */
const brand = {
  50: '#FFF7ED',
  100: '#FFEDD5',
  200: '#FED7AA',
  300: '#FDBA74',
  400: '#FB923C',
  500: '#CC490A',
  600: '#C2410C',
  700: '#9A3412',
  800: '#9A3412',
  900: '#7C2D12',
  950: '#431407',
}

const neutral = {
  50: '#FAFAFA',
  100: '#F4F4F5',
  200: '#E4E4E7',
  300: '#D4D4D8',
  400: '#A1A1AA',
  500: '#71717A',
  600: '#52525B',
  700: '#3F3F46',
  800: '#27272A',
  900: '#18181B',
  950: '#0F0F11',
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      boxShadow: {
        '2xs': '0 1px 1px 0 rgb(0 0 0 / 0.03)',
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        card: '0 1px 2px 0 rgb(16 16 20 / 0.04), 0 1px 3px 0 rgb(16 16 20 / 0.03)',
        pop: '0 12px 32px -8px rgb(16 16 20 / 0.18), 0 2px 6px -2px rgb(16 16 20 / 0.08)',
      },
      colors: {
        brand,
        amber: brand,
        slate: neutral,
        zinc: neutral,
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Mogu brand palette (chuẩn design)
        mogu: {
          yellow: '#FACC15',
          'yellow-dark': '#EAB308',
          'yellow-light': '#FEF9C3',
          dark: '#1A1A1A',
          cream: '#FFFDF5',
        },
        ok: {
          green: '#22C55E',
          'green-bg': '#F0FDF4',
        },
        warn: {
          orange: '#F97316',
          'orange-bg': '#FFF7ED',
          'orange-border': '#FFEDD5',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'spin-slow': 'spin-slow 1s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

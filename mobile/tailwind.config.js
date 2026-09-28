const { hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: '#E9DEC9',
        input: '#E9DEC9',
        ring: '#E6AC00',
        background: '#FFF9EE',
        foreground: '#2A1A10',
        primary: {
          DEFAULT: '#FFC928',
          foreground: '#2A1A10',
        },
        secondary: {
          DEFAULT: '#FFF7E8',
          foreground: '#2A1A10',
        },
        destructive: {
          DEFAULT: '#E5484D',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F7F2E9',
          foreground: '#6B625B',
        },
        accent: {
          DEFAULT: '#FF725E',
          foreground: '#2A1A10',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#2A1A10',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#2A1A10',
        },
        success: {
          DEFAULT: '#2E9D63',
          foreground: '#FFFFFF',
        },
        info: {
          DEFAULT: '#3B82F6',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#B98500',
          foreground: '#FFFFFF',
        },
        // NOAN brand — prefer semantic utilities above for new screens.
        noan: {
          background: '#FFF9EE',
          surface: '#FFFFFF',
          cream: '#FFF7E8',
          yellow: '#FFC928',
          'yellow-light': '#FFF1B8',
          'yellow-pressed': '#E6AC00',
          ink: '#2A1A10',
          cocoa: '#6B4A32',
          coral: '#FF725E',
          muted: '#91877F',
          border: '#E9DEC9',
          success: '#2E9D63',
          info: '#3B82F6',
          danger: '#E5484D',
        },
        // Compatibility namespace for existing className values.
        mogu: {
          cream: '#FFF7E8',
          yellow: '#FFC928',
          'yellow-light': '#FFF1B8',
          ink: '#2A1A10',
          coral: '#FF725E',
          muted: '#91877F',
        },
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      borderRadius: {
        '4xl': '2rem',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};

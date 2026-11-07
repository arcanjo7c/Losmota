import type { Config } from 'tailwindcss'

// Paleta extraída das artes oficiais da Los Motta (amarelo do logotipo,
// marrom-bronze do texto e dos botões) sobre base preta.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#000000', 900: '#0E0D0B', 800: '#1A1814', 700: '#2A261F' },
        motta: { DEFAULT: '#FDC51A', soft: '#FFD95A', deep: '#E5A91A' },
        bronze: { 300: '#D9A25A', 500: '#B26A14', 700: '#7A3B10', 900: '#4A2208' },
        bone: '#F4EEE2',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gold-sheen': 'linear-gradient(135deg,#FFD95A 0%,#FDC51A 45%,#E5A91A 100%)',
        'bronze-sheen': 'linear-gradient(135deg,#7A3B10 0%,#B26A14 55%,#D9A25A 100%)',
      },
      boxShadow: {
        glow: '0 10px 40px -12px rgba(253,197,26,.45)',
      },
    },
  },
  plugins: [],
} satisfies Config

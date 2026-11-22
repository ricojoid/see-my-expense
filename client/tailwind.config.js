/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#07080c',
        surface: { DEFAULT: '#12141b', 2: '#1a1d26', 3: '#232734' },
        line: 'rgba(255,255,255,0.08)',
        ink: { DEFAULT: '#f4f5f7', 2: '#a1a6b4', 3: '#6b7080' },
        accent: { DEFAULT: '#c6f432', soft: 'rgba(198,244,50,0.12)', ink: '#0b0d10' },
        cyan: { brand: '#22d3ee' },
        income: { DEFAULT: '#34d399', soft: 'rgba(52,211,153,0.12)' },
        expense: { DEFAULT: '#fb7185', soft: 'rgba(251,113,133,0.12)' },
        transfer: { DEFAULT: '#a78bfa', soft: 'rgba(167,139,250,0.12)' },
        // Chart series, validated for CVD separation on the surface colour.
        chart: { income: '#3987e5', expense: '#d95926' },
        status: { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.6)',
        glow: '0 10px 40px -10px rgba(198,244,50,0.45)',
      },
      keyframes: {
        drift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(6%, -4%) scale(1.08)' },
          '66%': { transform: 'translate(-5%, 5%) scale(0.95)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        drift: 'drift 22s ease-in-out infinite',
        'drift-slow': 'drift 34s ease-in-out infinite reverse',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};

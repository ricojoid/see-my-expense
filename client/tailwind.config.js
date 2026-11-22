/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        term: {
          bg: '#0a0e0a',
          panel: '#0d1410',
          border: '#1f3a26',
          green: '#39ff14',
          dim: '#0fa958',
          amber: '#ffb000',
          red: '#ff3b3b',
        },
      },
      fontFamily: {
        mono: ['"Fira Code"', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 8px rgba(57, 255, 20, 0.55)',
        glowSm: '0 0 4px rgba(57, 255, 20, 0.4)',
      },
      keyframes: {
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        blink: 'blink 1s step-start infinite',
        scan: 'scan 6s linear infinite',
      },
    },
  },
  plugins: [],
};

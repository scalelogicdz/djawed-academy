/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#080C14',
        surface: '#0F1723',
        surface2: '#141E2E',
        gold: '#D4B15E',
        goldSoft: '#C9A84C',
        goldDim: '#6B5A2E',
        text: '#F6F5F1',
        muted: '#8B93A3',
        muted2: '#5B6478',
        success: '#3FCB82',
        border: '#1C2534',
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        body: ['IBM Plex Sans Arabic', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        xl2: '16px',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0A0D14',
        surface: '#161F2E',
        surface2: '#1B2536',
        gold: '#D4B15E',
        goldSoft: '#C9A84C',
        goldDim: '#6B5A2E',
        text: '#F6F5F1',
        muted: '#99A2B5',
        muted2: '#5B6478',
        success: '#3FCB82',
        border: '#26324A',
        track: '#3A3220',
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        heading: ['El Messiri', 'Cairo', 'sans-serif'],
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

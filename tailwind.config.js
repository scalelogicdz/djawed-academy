/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#080B12',
        surface: '#111827',
        surface2: '#182234',
        gold: '#0866FF',
        goldSoft: '#075EDC',
        goldDim: '#075EDC',
        text: '#F7F7F4',
        muted: '#A6AEBD',
        muted2: '#6E788A',
        success: '#3FCB82',
        border: '#27334A',
        track: '#172C50',
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

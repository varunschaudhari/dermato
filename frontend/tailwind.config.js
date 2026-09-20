/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Teal-tinted neutral scale replacing Tailwind's stock gray — every
        // existing gray-* utility picks this up, giving the whole app a subtle
        // warmth that matches the brand without touching individual classes.
        gray: {
          50: '#f8fafa',
          100: '#f0f4f4',
          200: '#dfe7e7',
          300: '#c3cfcf',
          400: '#93a4a5',
          500: '#64797b',
          600: '#4c5e60',
          700: '#3d4d4f',
          800: '#263335',
          900: '#162325',
          950: '#0b1415',
        },
        // Medical teal — primary brand color across buttons, nav, links, charts
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f5e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Data/instrument-readout face: dates, scores, tags, session codes —
        // anything that reads like a lab measurement rather than prose.
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
}

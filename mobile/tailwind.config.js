/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: '#050505',
        vesper: {
          bg: '#050505',
          card: '#0a0a0a',
          border: 'rgba(255, 255, 255, 0.1)',
          muted: 'rgba(255, 255, 255, 0.4)',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        rose: {
          500: '#f43f5e',
        },
        amber: {
          400: '#fbbf24',
        },
        violet: {
          500: '#8b5cf6',
          600: '#7c3aed',
        },
      },
    },
  },
  plugins: [],
}

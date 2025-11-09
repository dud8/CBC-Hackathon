/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bluepeak-blue': '#0066CC',
        'bluepeak-dark': '#003D7A',
        'bluepeak-light': '#E6F2FF',
      }
    },
  },
  plugins: [],
}

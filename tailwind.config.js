/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/renderer/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // UN SDG brand blue
        sdg: {
          blue: '#009edb',
          dark: '#004C97',
        }
      }
    },
  },
  plugins: [],
}

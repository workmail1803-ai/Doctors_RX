/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0ea5e9', // Sky 500
        secondary: '#64748b', // Slate 500
        accent: '#f43f5e', // Rose 500
      }
    },
  },
  plugins: [],
}

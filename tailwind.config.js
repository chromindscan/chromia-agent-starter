/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./ui/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'neon-blue': '#00FFFF',
        'neon-purple': '#A020F0',
        'dark-bg': '#0D0D0D',
      },
    },
  },
  plugins: [],
};
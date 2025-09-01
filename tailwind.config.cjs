/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { purple: "#9b8cff", blue: "#3b82f6" }
      }
    }
  },
  plugins: []
};

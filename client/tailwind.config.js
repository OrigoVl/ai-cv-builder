/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          500: "#3d63dd",
          600: "#2f4fc0",
          700: "#273f99",
        },
      },
    },
  },
  plugins: [],
};

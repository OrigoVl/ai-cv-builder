/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#F4F2FE",
          100: "#E9E5FD",
          200: "#CFC8FB",
          300: "#AFA3F7",
          400: "#8F7EF3",
          500: "#6D5EF0",
          600: "#5B4FD9",
          700: "#4A40B3",
          800: "#39318A",
          900: "#2A2466",
        },
        accent: {
          400: "#FFC861",
          500: "#F6A623",
          600: "#DB8C12",
        },
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 2px 8px -2px rgb(0 0 0 / 0.06)",
        card: "0 1px 2px 0 rgb(16 24 40 / 0.04), 0 4px 16px -4px rgb(16 24 40 / 0.08)",
        popover: "0 12px 32px -8px rgb(16 24 40 / 0.18)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0, transform: "translateY(4px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

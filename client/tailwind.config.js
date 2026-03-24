/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Outfit", "system-ui", "sans-serif"],
      },
      colors: {
        court: {
          50: "#f0fdf4",
          100: "#dcfce7",
          600: "#16a34a",
          800: "#166534",
          950: "#052e16",
        },
      },
    },
  },
  plugins: [],
};

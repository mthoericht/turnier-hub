/** @type {import('tailwindcss').Config} */
import { colorTokens, fontFamilyTokens } from "./src/theme/designTokens.js";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: fontFamilyTokens,
      colors: colorTokens,
    },
  },
  plugins: [],
};

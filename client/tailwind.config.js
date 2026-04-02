/** @type {import('tailwindcss').Config} */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { colorTokens, fontFamilyTokens } from "./src/theme/designTokens.js";

const clientDir = path.dirname(fileURLToPath(import.meta.url));

export default {
  content: [
    path.join(clientDir, "index.html"),
    path.join(clientDir, "src/**/*.{vue,js,ts,jsx,tsx}"),
    // Storybook-Stories liegen im Repo unter tests/; sonst fehlen JIT-Klassen im Canvas.
    path.join(clientDir, "../tests/client/storybook/stories/**/*.{ts,tsx,vue}"),
    path.join(clientDir, "../tests/client/storybook/**/*.ts"),
  ],
  theme: {
    extend: {
      fontFamily: fontFamilyTokens,
      colors: colorTokens,
    },
  },
  plugins: [],
};

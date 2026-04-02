import { defineConfig } from "vite";
import { clientPlugins, clientAlias } from "./vite.shared";

export default defineConfig({
  plugins: clientPlugins(),
  resolve: {
    alias: clientAlias,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});

import { defineConfig } from "vite";
import { clientPlugins, clientAlias } from "./vite.shared";
import { VitePWA } from "vite-plugin-pwa";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = path.dirname(fileURLToPath(import.meta.url));

function resolveDevHttps()
{
  const wantHttps =
    process.env.DEV_SCHEME === "https" || process.env.VITE_HTTPS === "true";

  if (!wantHttps) return undefined;

  const keyPath =
    process.env.VITE_HTTPS_KEY_PATH ??
    path.resolve(clientRoot, ".certs/dev-key.pem");
  const certPath =
    process.env.VITE_HTTPS_CERT_PATH ??
    path.resolve(clientRoot, ".certs/dev-cert.pem");

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) return undefined;

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

export default defineConfig({
  plugins: [
    ...clientPlugins(),
    VitePWA({
      // Use Vite PWA capabilities (workbox SW + manifest wiring).
      strategies: "generateSW",
      registerType: "autoUpdate",
      injectRegister: "auto",
      // We already ship a hand-tuned manifest in `client/public`.
      manifest: false,
      devOptions: {
        enabled: true,
        type: "classic",
        suppressWarnings: true,
      },
      workbox: {
        // Conservative: only precache the app shell + static assets.
        globPatterns: [
          "**/index.html",
          "**/assets/**",
          "**/favicon*.*",
          "**/apple-touch-icon.png",
          "**/android-chrome-192x192.png",
          "**/icon-512x512.png",
        ],
        runtimeCaching: [],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        // Avoid routing API requests to the SPA fallback.
        navigateFallbackAllowlist: [/^\/(?!api\/).*/],
      },
    }),
  ],
  resolve: {
    alias: clientAlias,
  },
  server: {
    port: 5173,
    https: resolveDevHttps(),
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});

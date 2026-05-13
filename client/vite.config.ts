import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { clientPlugins, clientAlias } from "./vite.shared";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEnvDir = path.resolve(here, "../server");

export default defineConfig(({ mode }) =>
{
  const serverEnv = loadEnv(mode, serverEnvDir, "");
  const apiProxyTarget =
    serverEnv.VITE_API_PROXY_TARGET || `http://127.0.0.1:${serverEnv.PORT || "3000"}`;

  return {
    plugins: clientPlugins(),
    resolve: {
      alias: clientAlias,
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});

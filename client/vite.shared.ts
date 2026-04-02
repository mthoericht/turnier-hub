import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const clientRoot = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

export const clientSrc = path.resolve(clientRoot, "src");

export const clientAlias = { "@": clientSrc };

export const clientPlugins = () => [vue()];

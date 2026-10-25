import "dotenv/config";
import { defineConfig, env } from "prisma/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Preserve Prisma 6's schema-relative SQLite paths for manual API sandboxes.
// Build/test configs use explicitly absolute fresh temporary database URLs.
const url = env("DATABASE_URL");
const file = url.startsWith("file:") ? url.slice(5) : "";
const databaseUrl = file && !path.isAbsolute(file) && file !== ":memory:"
  ? `file:${path.resolve(fileURLToPath(new URL("./prisma/", import.meta.url)), file)}`
  : url;

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: databaseUrl },
});

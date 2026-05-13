import "dotenv/config";
import { defineConfig } from "prisma/config";

function buildDatabaseUrlFromParts(): string | undefined
{
  const host = process.env.DB_HOST?.trim();
  const port = process.env.DB_PORT?.trim();
  const username = process.env.DB_USERNAME?.trim();
  const password = process.env.DB_PASSWORD?.trim();
  const database = process.env.DB_NAME?.trim();

  if (!host || !port || !username || !password || !database)
  {
    return undefined;
  }

  return `mysql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

process.env.DATABASE_URL = process.env.DATABASE_URL?.trim() || buildDatabaseUrlFromParts();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx scripts/seed.ts",
  },
});

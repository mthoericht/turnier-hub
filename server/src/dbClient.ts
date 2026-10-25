import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Preserve the former schema-relative URL semantics for API-only development. */
function databaseUrl(url: string): string
{
  if (!url.startsWith("file:")) return url;
  const file = url.slice(5);
  if (path.isAbsolute(file) || file === ":memory:") return url;
  const schemaDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../prisma");
  return `file:${path.resolve(schemaDir, file)}`;
}

/** Shared by HTTP lifecycle and local maintenance; never exposed as a LAN route. */
export function createDatabaseClient(url: string): PrismaClient
{
  if (!url) throw new Error("DATABASE_URL is required");
  const adapter = new PrismaBetterSqlite3(
    { url: databaseUrl(url) },
    // Prisma 6's native SQLite engine stores DateTime as integer milliseconds.
    // Retain that format for existing databases, timer values and backup files.
    { timestampFormat: "unixepoch-ms" },
  );
  return new PrismaClient({ adapter });
}

import crypto from "node:crypto";

/**
 * Connection URLs moved from schema.prisma to Prisma Config in Prisma 7.
 * Normalize only that exact tooling block to its historical representation so
 * existing v1 settings/backups retain their identity. Model/enum/provider changes
 * still produce a different fingerprint and are refused by the storage guard.
 */
export function storageSchemaId(schema)
{
  const canonical = schema.replace(
    /datasource db \{\n  provider = "sqlite"\n(?:  url      = env\("DATABASE_URL"\)\n)?\}/,
    'datasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}',
  );
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

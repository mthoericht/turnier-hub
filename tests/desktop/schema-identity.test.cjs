const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const v1 = "1ef88f16376a0505a35a11ce2b254ddeef575792e402742f9f59055c801f3262";

test("Prisma connection-config relocation retains v1 identity; model/provider changes do not", async () =>
{
  const { storageSchemaId } = await import("../../desktop/schema-identity.mjs");
  const schema = await fs.readFile(path.join(__dirname, "../../server/prisma/schema.prisma"), "utf8");
  assert.equal(storageSchemaId(schema), v1);
  const legacy = schema.replace('  provider = "sqlite"\n', '  provider = "sqlite"\n  url      = env("DATABASE_URL")\n');
  assert.equal(storageSchemaId(legacy), v1);
  assert.notEqual(storageSchemaId(schema.replace("firstName", "differentField")), v1);
  assert.notEqual(storageSchemaId(schema.replace('provider = "sqlite"', 'provider = "postgresql"')), v1);
});

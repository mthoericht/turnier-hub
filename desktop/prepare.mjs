import { build } from "esbuild";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const requireServer = createRequire(path.join(root, "server/package.json"));
const runtimeDir = path.join(root, "desktop/runtime");
const schemaPath = path.join(root, "server/prisma/schema.prisma");
const schema = await readFile(schemaPath, "utf8");

// Build on the target OS/architecture: the copied Prisma engine is host-native.
const expectedPlatform = process.argv[2];
if (expectedPlatform && expectedPlatform !== process.platform)
{
  throw new Error(`Prepare on ${expectedPlatform}; this host is ${process.platform}. Cross-packaging Prisma engines is not supported by the prototype.`);
}
await rm(runtimeDir, { recursive: true, force: true });
await mkdir(runtimeDir, { recursive: true });
const bundle = await build({
  entryPoints: [path.join(root, "server/src/runtime.ts")],
  outfile: path.join(runtimeDir, "server.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["@prisma/client"],
  metafile: true,
  // Express's default static path is unused by Desktop; preserve import.meta.url
  // for its dirname and config module without ESM-only runtime constructs.
  define: { "import.meta.url": "desktopImportMetaUrl" },
  banner: { js: "const desktopImportMetaUrl = require('node:url').pathToFileURL(__filename).href;" },
});
const prismaClientDir = path.dirname(requireServer.resolve("@prisma/client/package.json"));
const generatedClientDir = path.dirname(requireServer.resolve(".prisma/client/package.json"));
await cp(prismaClientDir, path.join(runtimeDir, "node_modules/@prisma/client"), { recursive: true });
await cp(generatedClientDir, path.join(runtimeDir, "node_modules/.prisma/client"), { recursive: true });
await writeFile(path.join(runtimeDir, "schema.sha256"), crypto.createHash("sha256").update(schema).digest("hex"));

// Keep notices for bundled server dependencies and locally shipped font files.
const packageDirs = new Set([prismaClientDir]);
for (const input of Object.keys(bundle.metafile.inputs))
{
  const fullPath = path.resolve(root, input);
  const parts = fullPath.split(`${path.sep}node_modules${path.sep}`);
  if (parts.length < 2) continue;
  const tail = parts.pop().split(path.sep);
  const packageName = tail[0].startsWith("@") ? tail.slice(0, 2).join(path.sep) : tail[0];
  packageDirs.add(`${parts.join(`${path.sep}node_modules${path.sep}`)}${path.sep}node_modules${path.sep}${packageName}`);
}
const requireClient = createRequire(path.join(root, "client/package.json"));
for (const font of ["@fontsource/dm-sans", "@fontsource/outfit"])
{
  packageDirs.add(path.dirname(requireClient.resolve(`${font}/package.json`)));
}
for (const dir of packageDirs)
{
  const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
  const destination = path.join(runtimeDir, "licenses", pkg.name.replaceAll("/", "__"));
  await mkdir(destination, { recursive: true });
  for (const file of await readdir(dir))
  {
    if (/^(licen[cs]e|copying|notice)(\.|$)/i.test(file)) await cp(path.join(dir, file), path.join(destination, file), { recursive: true });
  }
}

// Create an empty template at BUILD time only. No Prisma CLI/downloads at runtime.
const temporary = await mkdtemp(path.join(os.tmpdir(), "turnier-hub-template-"));
try
{
  const temporarySchema = path.join(temporary, "schema.prisma");
  const temporaryDb = path.join(temporary, "empty.db");
  await writeFile(temporarySchema, schema);
  await writeFile(temporaryDb, "", { flag: "wx" });
  const result = spawnSync(process.execPath, [requireServer.resolve("prisma/build/index.js"), "db", "push", "--schema", temporarySchema, "--skip-generate"], {
    cwd: temporary,
    env: { ...process.env, DATABASE_URL: `file:${temporaryDb.replaceAll("\\", "/")}` },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Empty database template creation failed (${result.status}).`);
  await cp(temporaryDb, path.join(runtimeDir, "empty.db"));
}
finally
{
  await rm(temporary, { recursive: true, force: true });
}
console.log(`Desktop resources prepared for ${process.platform}/${process.arch}.`);

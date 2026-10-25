import { build } from "esbuild";
import { rebuild } from "@electron/rebuild";
import runtimePackages from "./runtime-packages.cjs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { storageSchemaId } from "./schema-identity.mjs";
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
  external: ["@prisma/client", "better-sqlite3"],
  metafile: true,
  // Express's default static path is unused by Desktop; preserve import.meta.url
  // for its dirname and config module without ESM-only runtime constructs.
  define: { "import.meta.url": "desktopImportMetaUrl" },
  banner: { js: "const desktopImportMetaUrl = require('node:url').pathToFileURL(__filename).href;" },
});
const packageDirs = new Set();
const adapterRequire = createRequire(requireServer.resolve("@prisma/adapter-better-sqlite3"));
const nativeRequire = createRequire(adapterRequire.resolve("better-sqlite3"));
const runtimeDependencies = {};
async function packageDir(resolver, name)
{
  try { return path.dirname(resolver.resolve(`${name}/package.json`)); }
  catch (error)
  {
    if (error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
    let dir = path.dirname(resolver.resolve(name));
    while (dir !== path.dirname(dir))
    {
      try
      {
        const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
        if (pkg.name === name) return dir;
      }
      catch (failure) { if (failure.code !== "ENOENT") throw failure; }
      dir = path.dirname(dir);
    }
    throw new Error(`Cannot locate runtime package ${name}`);
  }
}
for (const name of runtimePackages)
{
  const resolver = ["better-sqlite3", "bindings", "file-uri-to-path"].includes(name) ? nativeRequire : requireServer;
  const dir = await packageDir(resolver, name);
  await cp(dir, path.join(runtimeDir, "node_modules", name), { recursive: true });
  packageDirs.add(dir);
  if (!name.startsWith(".prisma")) runtimeDependencies[name] = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8")).version;
}
await writeFile(path.join(runtimeDir, "package.json"), JSON.stringify({ private: true, dependencies: runtimeDependencies }, null, 2));
const electronVersion = JSON.parse(await readFile(path.join(root, "node_modules/electron/package.json"), "utf8")).version;
// Rebuild only the staged copy; API tests retain the build-Node ABI in root deps.
await rebuild({ buildPath: runtimeDir, electronVersion, arch: process.arch, onlyModules: ["better-sqlite3"], force: true });
await writeFile(path.join(runtimeDir, "schema.sha256"), storageSchemaId(schema));

// Keep notices for bundled server dependencies, copied runtime packages and fonts.
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
for (const font of ["@fontsource/dm-sans", "@fontsource/outfit", "xlsx"])
{
  packageDirs.add(await packageDir(requireClient, font));
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
  await writeFile(path.join(temporary, "prisma.config.mjs"), `export default ${JSON.stringify({ schema: temporarySchema, datasource: { url: `file:${temporaryDb.replaceAll("\\", "/")}` } })};`);
  const result = spawnSync(process.execPath, [requireServer.resolve("prisma/build/index.js"), "db", "push", "--config", path.join(temporary, "prisma.config.mjs")], {
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

import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const root = fileURLToPath(new URL("../", import.meta.url));
const requireServer = createRequire(path.join(root, "server/package.json"));
const temporary = await mkdtemp(path.join(os.tmpdir(), "turnier-hub-isolated-tests-"));
const env = {
  ...process.env, NODE_ENV: "test", TURNIER_HUB_DESKTOP: "0", TURNIER_HUB_ISOLATED_TEST: "1",
  CORS_ALLOWED_ORIGINS: "http://127.0.0.1:3220,http://localhost:3220", TRUST_PROXY: "false",
  DATABASE_URL: `file:${path.join(temporary, "test.db")}`,
};

function run(command, args, cwd = root)
{
  return new Promise((resolve, reject) =>
  {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Test command failed (${code}).`)));
  });
}

try
{
  await writeFile(path.join(temporary, "schema.prisma"), await readFile(path.join(root, "server/prisma/schema.prisma")));
  await writeFile(path.join(temporary, "test.db"), "");
  await run(process.execPath, [requireServer.resolve("prisma/build/index.js"), "db", "push", "--schema", path.join(temporary, "schema.prisma"), "--skip-generate"], temporary);
  if (process.argv[2] === "integration") await run("npm", ["run", "test:integration", "-w", "client"]);
  else
  {
    await run("npm", ["run", "test", "-w", "server"]);
    await run("npm", ["run", "test", "-w", "client"]);
  }
}
catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await rm(temporary, { recursive: true, force: true }); }

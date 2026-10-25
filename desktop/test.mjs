import { spawn } from "node:child_process";
import { readdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import electron from "electron";
import os from "node:os";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = (await readdir(path.join(root, "tests/desktop")))
  .filter((file) => file.endsWith(".test.cjs"))
  .sort().map((file) => path.join(root, "tests/desktop", file));
const temporary = await mkdtemp(path.join(os.tmpdir(), "turnier-hub-desktop-tests-"));
const child = spawn(electron, ["--test", ...files], {
  cwd: root, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", TURNIER_HUB_DESKTOP: "1", DATABASE_URL: `file:${path.join(temporary, "bootstrap.db")}` }, stdio: "inherit",
});
child.once("error", (error) => { console.error(error); process.exitCode = 1; });
child.once("exit", async (code) => { await rm(temporary, { recursive: true, force: true }); process.exitCode = code ?? 1; });

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const env = {
  ...process.env,
  TURNIER_HUB_DESKTOP_DEV: "1",
  TURNIER_HUB_PROTOTYPE_DATA_DIR: process.env.TURNIER_HUB_PROTOTYPE_DATA_DIR || path.join(root, ".local", "desktop-dev"),
  TURNIER_HUB_PROTOTYPE_PORT: process.env.TURNIER_HUB_PROTOTYPE_PORT || "3220",
};
delete env.ELECTRON_RUN_AS_NODE;
let child;
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"])
{
  process.on(signal, () => { interrupted = true; child?.kill(signal); });
}

function run(command, args)
{
  return new Promise((resolve, reject) =>
  {
    child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
    {
      if (interrupted) resolve();
      else if (code === 0) resolve();
      else reject(new Error(`Host-Start fehlgeschlagen (${code ?? signal}).`));
    });
  });
}

try
{
  await run("npm", ["run", "desktop:prepare"]);
  if (!interrupted) await run(require("electron"), [path.join(root, "desktop/app")]);
}
catch (error) { console.error(error.message); process.exitCode = 1; }

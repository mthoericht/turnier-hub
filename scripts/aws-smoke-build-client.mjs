#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { collectSmokeOutputs, formatEnvFile } from "./aws-smoke-lib.mjs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

try
{
  const info = collectSmokeOutputs();
  const envPath = join(process.cwd(), "client", ".env.production.local");
  writeFileSync(envPath, formatEnvFile(info.viteEnv), "utf8");
  console.log(`Wrote ${envPath}`);
  console.log(`Building client for ${info.appBaseUrl} ...`);

  const build = spawnSync("npm", ["run", "build", "-w", "client"], {
    stdio: "inherit",
    encoding: "utf8",
  });
  process.exit(build.status ?? 1);
}
catch (error)
{
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = process.env.SERVER_ENV_FILE || (process.env.NODE_ENV === "test" ? ".env.test" : ".env");

config({ path: path.join(serverRoot, envFile) });

function buildDatabaseUrlFromParts()
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

if (!process.env.DATABASE_URL)
{
  console.error("DATABASE_URL or DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME must be set.");
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);

if (!command)
{
  console.error("Usage: node scripts/withDatabaseUrl.mjs <command> [...args]");
  process.exit(1);
}

const child = spawn(command, args, {
  cwd: serverRoot,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) =>
{
  if (signal)
  {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

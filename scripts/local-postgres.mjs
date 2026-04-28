import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const dataDir = path.join(repoRoot, "data");
const postgresDataDir = path.join(dataDir, "postgres");
const postgresLogFile = path.join(dataDir, "postgres.log");

const action = process.argv[2];

function resolveBinary(name)
{
  const localBin = process.env.PG_BIN;

  if (localBin && localBin.trim())
  {
    return path.join(localBin.trim(), name);
  }

  return name;
}

function runOrThrow(command, args, options = {})
{
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.error)
  {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0)
  {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function runCapture(command, args)
{
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.error)
  {
    throw result.error;
  }

  return result;
}

function ensureDataRoot()
{
  fs.mkdirSync(dataDir, { recursive: true });
}

function ensurePostgresCluster()
{
  ensureDataRoot();

  if (fs.existsSync(path.join(postgresDataDir, "PG_VERSION")))
  {
    console.log(`Postgres cluster already initialized: ${postgresDataDir}`);
    return;
  }

  fs.mkdirSync(postgresDataDir, { recursive: true });
  runOrThrow(resolveBinary("initdb"), ["-D", postgresDataDir]);
  console.log(`Initialized Postgres cluster in ${postgresDataDir}`);
}

function ensureDatabases()
{
  const dbsResult = runCapture(resolveBinary("psql"), ["-lqt"]);
  const dbList = (dbsResult.stdout ?? "").toString();

  if (!dbList.includes("turnier_dev"))
  {
    runOrThrow(resolveBinary("createdb"), ["turnier_dev"]);
    console.log("Created database: turnier_dev");
  }

  if (!dbList.includes("turnier_test"))
  {
    runOrThrow(resolveBinary("createdb"), ["turnier_test"]);
    console.log("Created database: turnier_test");
  }
}

function init()
{
  ensurePostgresCluster();
  console.log("Init complete. Next: npm run db:start");
}

function start()
{
  ensurePostgresCluster();
  runOrThrow(resolveBinary("pg_ctl"), ["-D", postgresDataDir, "-l", postgresLogFile, "start"]);
  ensureDatabases();
  console.log("Postgres started on localhost:5432");
}

function stop()
{
  if (!fs.existsSync(path.join(postgresDataDir, "PG_VERSION")))
  {
    console.log("No local Postgres cluster found, nothing to stop.");
    return;
  }

  runOrThrow(resolveBinary("pg_ctl"), ["-D", postgresDataDir, "stop"]);
  console.log("Postgres stopped.");
}

function status()
{
  if (!fs.existsSync(path.join(postgresDataDir, "PG_VERSION")))
  {
    console.log("Local Postgres cluster is not initialized.");
    process.exit(1);
  }

  const statusResult = runCapture(resolveBinary("pg_ctl"), ["-D", postgresDataDir, "status"]);

  if (statusResult.status === 0)
  {
    process.stdout.write(statusResult.stdout ?? "");
    return;
  }

  process.stdout.write(statusResult.stdout ?? "");
  process.stderr.write(statusResult.stderr ?? "");
  process.exit(statusResult.status ?? 1);
}

try
{
  switch (action)
  {
    case "init":
      init();
      break;
    case "start":
      start();
      break;
    case "stop":
      stop();
      break;
    case "status":
      status();
      break;
    default:
      console.error("Usage: node scripts/local-postgres.mjs <init|start|stop|status>");
      process.exit(1);
  }
}
catch (error)
{
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  if (message.includes("spawn") && message.includes("ENOENT"))
  {
    console.error("Postgres binaries not found. Install PostgreSQL and/or set PG_BIN=/path/to/postgres/bin.");
  }
  process.exit(1);
}

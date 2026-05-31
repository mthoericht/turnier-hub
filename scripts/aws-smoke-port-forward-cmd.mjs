#!/usr/bin/env node
import { collectSmokeOutputs } from "./aws-smoke-lib.mjs";

const instanceId = readArg("--instance-id");
const localPort = process.env.LOCAL_PORT?.trim() || readArg("--local-port") || "15432";

function readArg(flag)
{
  const index = process.argv.indexOf(flag);
  if (index < 0)
  {
    return null;
  }
  return process.argv[index + 1] ?? null;
}

try
{
  const info = collectSmokeOutputs();
  if (!info.dbProxyEndpoint)
  {
    throw new Error("DbProxyEndpoint output missing. Redeploy the data stack first.");
  }

  if (!instanceId)
  {
    console.error("Usage: npm run smoke:port-forward-cmd -- --instance-id i-0123456789abcdef0");
    console.error("Optional: --local-port 15432  (default 15432)");
    console.error("");
    console.error("Requires a one-time SSM jump host in the VPC (see infra/README.md §3).");
    process.exit(1);
  }

  const parameters = JSON.stringify({
    host: [info.dbProxyEndpoint],
    portNumber: ["5432"],
    localPortNumber: [localPort],
  });

  console.log("# SSM port-forward to RDS Proxy (run in a dedicated terminal; blocks until Ctrl+C)");
  console.log(`# Proxy: ${info.dbProxyEndpoint}  →  localhost:${localPort}`);
  console.log("");
  console.log(
    `aws ssm start-session \\\n`
    + `  --target ${instanceId} \\\n`
    + `  --document-name AWS-StartPortForwardingSessionToRemoteHost \\\n`
    + `  --parameters '${parameters}'`,
  );
  console.log("");
  console.log("# In another terminal (while the session above is open):");
  console.log("npm run smoke:database-url");
  console.log(
    "# Replace the proxy host in DATABASE_URL with 127.0.0.1 and the local port, then:",
  );
  console.log(
    `DATABASE_URL="postgresql://USER:PASS@127.0.0.1:${localPort}/turnier?schema=public&sslmode=require" npm run db:deploy`,
  );
  console.log("");
  console.log("# Admin promotion uses the same tunnel:");
  console.log("npm run db:promote-admin -- --email 'you@example.com' --yes");
}
catch (error)
{
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

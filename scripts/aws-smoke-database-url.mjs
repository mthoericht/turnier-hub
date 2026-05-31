#!/usr/bin/env node
import {
  buildDatabaseUrl,
  collectSmokeOutputs,
  readDatabaseSecret,
} from "./aws-smoke-lib.mjs";

try
{
  const info = collectSmokeOutputs();
  if (!info.databaseSecretArn || !info.dbProxyEndpoint)
  {
    throw new Error(
      "Missing DbProxyEndpoint or DatabaseSecretArn outputs on the data stack. "
      + "Redeploy with the latest CDK (data-stack outputs) or set them manually.",
    );
  }

  const secret = readDatabaseSecret(info.databaseSecretArn);
  const databaseUrl = buildDatabaseUrl(secret, info.dbProxyEndpoint);

  console.log("RDS proxy endpoint:", info.dbProxyEndpoint);
  console.log("Database secret:", info.databaseSecretArn);
  console.log("");
  console.log("DATABASE_URL (requires VPC/network reachability to the proxy):");
  console.log(databaseUrl);
  console.log("");
  console.log("Apply schema once reachable:");
  console.log(`  DATABASE_URL="${databaseUrl}" npm run db:deploy`);
}
catch (error)
{
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

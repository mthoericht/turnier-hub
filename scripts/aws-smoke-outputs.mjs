#!/usr/bin/env node
import { collectSmokeOutputs, formatEnvFile } from "./aws-smoke-lib.mjs";

const jsonMode = process.argv.includes("--json");
const writeEnv = process.argv.includes("--write-env");

try
{
  const info = collectSmokeOutputs();

  if (jsonMode)
  {
    console.log(JSON.stringify(info, null, 2));
    process.exit(0);
  }

  console.log(`Stage: ${info.stage}`);
  console.log(`App URL: ${info.appBaseUrl}`);
  console.log("");
  console.log("Cognito:");
  console.log(`  UserPoolId:       ${info.userPoolId}`);
  console.log(`  UserPoolClientId: ${info.userPoolClientId}`);
  console.log("");
  console.log("Edge:");
  console.log(`  CloudFront:       ${info.cloudFrontDomain}`);
  console.log(`  S3 bucket:        ${info.siteBucketName}`);
  if (info.distributionId)
  {
    console.log(`  DistributionId:   ${info.distributionId}`);
  }
  console.log("");
  console.log("Lambda (optional direct checks):");
  console.log(`  API URL:          ${info.apiFunctionUrl ?? "(missing)"}`);
  console.log(`  SSE URL:          ${info.sseFunctionUrl ?? "(missing)"}`);
  if (info.dbProxyEndpoint)
  {
    console.log("");
    console.log("RDS:");
    console.log(`  Proxy endpoint:   ${info.dbProxyEndpoint}`);
    console.log(`  DB secret ARN:    ${info.databaseSecretArn ?? "(missing)"}`);
  }
  console.log("");
  console.log("SPA build env (copy/paste or use --write-env):");
  console.log(formatEnvFile(info.viteEnv));
  console.log("Build:");
  console.log("  npm run smoke:build-spa");
  console.log("Deploy:");
  console.log("  npm run smoke:deploy-spa -- --yes");

  if (writeEnv)
  {
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const target = join(process.cwd(), "client", ".env.production.local");
    writeFileSync(target, formatEnvFile(info.viteEnv), "utf8");
    console.log(`Wrote ${target}`);
  }
}
catch (error)
{
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

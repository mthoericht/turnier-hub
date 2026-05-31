#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  awsRegion,
  collectSmokeOutputs,
  inviteCodeSecretName,
  readInviteCodeValue,
  stackExists,
  stackName,
} from "./aws-smoke-lib.mjs";

const probe = process.argv.includes("--probe");

function logCheck(ok, label, detail = "")
{
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`[${ok ? "OK" : "ERR"}] ${label}${suffix}`);
}

let hasError = false;

const preflight = spawnSync("node", ["./scripts/cdk-preflight.mjs"], {
  stdio: "inherit",
  encoding: "utf8",
});
if (preflight.status !== 0)
{
  process.exit(preflight.status ?? 1);
}

console.log("");
console.log("Smoke stack checks:");

for (const layer of ["network", "data", "cognito", "lambda", "edge"])
{
  const ok = stackExists(layer);
  logCheck(ok, `CloudFormation stack ${stackName(layer)}`, ok ? "present" : "missing");
  if (!ok)
  {
    hasError = true;
  }
}

let smokeInfo;
try
{
  smokeInfo = collectSmokeOutputs();
  logCheck(true, "Required outputs", smokeInfo.appBaseUrl);
}
catch (error)
{
  logCheck(false, "Required outputs", error instanceof Error ? error.message : String(error));
  hasError = true;
}

try
{
  readInviteCodeValue();
  logCheck(true, "Invite code secret", inviteCodeSecretName());
}
catch (error)
{
  logCheck(false, "Invite code secret", error instanceof Error ? error.message : String(error));
  hasError = true;
}

if (probe && smokeInfo)
{
  console.log("");
  console.log("HTTP probes:");
  try
  {
    const spaRes = await fetch(smokeInfo.appBaseUrl, { redirect: "follow" });
    logCheck(spaRes.ok, "SPA index", `GET ${smokeInfo.appBaseUrl} → ${spaRes.status}`);
    if (!spaRes.ok)
    {
      hasError = true;
    }
  }
  catch (error)
  {
    logCheck(false, "SPA index", error instanceof Error ? error.message : String(error));
    hasError = true;
  }

  try
  {
    const schoolsUrl = `${smokeInfo.appBaseUrl}/api/auth/schools`;
    const apiRes = await fetch(schoolsUrl);
    logCheck(apiRes.ok, "Public API", `GET /api/auth/schools → ${apiRes.status}`);
    if (!apiRes.ok)
    {
      hasError = true;
    }
  }
  catch (error)
  {
    logCheck(false, "Public API", error instanceof Error ? error.message : String(error));
    hasError = true;
  }
}

console.log("");
console.log("Next steps:");
console.log(`  npm run smoke:outputs -- --write-env   # write client/.env.production.local`);
console.log("  npm run smoke:invite                   # show signup invite code");
console.log("  npm run smoke:database-url             # print DATABASE_URL (needs VPC reachability for db push)");
console.log("  npm run smoke:build-spa                # build client for CloudFront");
console.log("  npm run smoke:deploy-spa -- --yes      # sync dist/ to S3 + invalidate CloudFront");
console.log(`  Region: ${awsRegion()}`);

if (hasError)
{
  process.exit(1);
}

#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { awsBaseArgs, collectSmokeOutputs } from "./aws-smoke-lib.mjs";

const confirmed = process.argv.includes("--yes") || process.argv.includes("-y");
const skipInvalidate = process.argv.includes("--no-invalidate");

if (!confirmed)
{
  console.log("Aborted. Re-run with --yes to sync client/dist to S3 and invalidate CloudFront.");
  process.exit(0);
}

const distDir = join(process.cwd(), "client", "dist");
if (!existsSync(distDir))
{
  console.error("client/dist missing. Run `npm run smoke:build-spa` first.");
  process.exit(1);
}

try
{
  const info = collectSmokeOutputs();
  console.log(`Syncing to s3://${info.siteBucketName} ...`);

  const sync = spawnSync(
    "aws",
    [
      "s3", "sync", distDir, `s3://${info.siteBucketName}`,
      "--delete",
      "--cache-control", "public,max-age=31536000,immutable",
      "--exclude", "index.html",
      ...awsBaseArgs(),
    ],
    { stdio: "inherit", encoding: "utf8" },
  );
  if (sync.status !== 0)
  {
    process.exit(sync.status ?? 1);
  }

  const indexCopy = spawnSync(
    "aws",
    [
      "s3", "cp",
      join(distDir, "index.html"),
      `s3://${info.siteBucketName}/index.html`,
      "--cache-control", "public,max-age=60",
      ...awsBaseArgs(),
    ],
    { stdio: "inherit", encoding: "utf8" },
  );
  if (indexCopy.status !== 0)
  {
    process.exit(indexCopy.status ?? 1);
  }

  if (!skipInvalidate && info.distributionId)
  {
    console.log(`Invalidating CloudFront ${info.distributionId} ...`);
    const invalidate = spawnSync(
      "aws",
      [
        "cloudfront", "create-invalidation",
        "--distribution-id", info.distributionId,
        "--paths", "/*",
        ...awsBaseArgs(),
      ],
      { stdio: "inherit", encoding: "utf8" },
    );
    if (invalidate.status !== 0)
    {
      process.exit(invalidate.status ?? 1);
    }
  }
  else if (!skipInvalidate && !info.distributionId)
  {
    console.warn("CloudFrontDistributionId output missing — skip invalidation or redeploy edge stack.");
  }

  console.log(`Deploy complete. Open ${info.appBaseUrl}`);
}
catch (error)
{
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

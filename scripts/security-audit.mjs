#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const FAIL_ON = new Set(["critical", "high"]);

function runAuditJson()
{
  try
  {
    return execFileSync(
      "npm",
      ["audit", "--json", "--include-workspace-root", "--workspaces"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
  }
  catch (error)
  {
    const stdout = error && typeof error === "object" && "stdout" in error
      ? String(error.stdout ?? "")
      : "";
    if (!stdout.trim())
    {
      throw error;
    }
    return stdout;
  }
}

function main()
{
  const raw = runAuditJson();
  const report = JSON.parse(raw);
  if (report.error || !report.vulnerabilities || !report.metadata?.vulnerabilities)
  {
    throw new Error("Security audit did not return a valid vulnerability report.");
  }
  const vulnerabilities = report.vulnerabilities;

  const blocking = [];

  for (const [pkg, details] of Object.entries(vulnerabilities))
  {
    const severity = String(details?.severity ?? "unknown");
    if (!FAIL_ON.has(severity))
    {
      continue;
    }

    blocking.push({ pkg, severity });
  }

  if (blocking.length > 0)
  {
    console.error("Blocking vulnerabilities detected:");
    for (const item of blocking)
    {
      console.error(`- ${item.pkg} (${item.severity})`);
    }
    process.exit(1);
  }

  console.log("Security audit passed: no high/critical findings reported.");
}

main();

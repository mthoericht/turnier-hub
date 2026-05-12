#!/usr/bin/env node

import { execFileSync } from "node:child_process";

/** Known high/critical allowlist — document why when adding entries. */
const ALLOWLIST = new Set(["xlsx"]);

function npmAuditJson()
{
  try
  {
    return execFileSync("npm", ["audit", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
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

const { vulnerabilities = {} } = JSON.parse(npmAuditJson());
const allowlisted = [];
const blocking = [];

for (const [pkg, row] of Object.entries(vulnerabilities))
{
  const severity = String(row?.severity ?? "");
  if (severity !== "high" && severity !== "critical")
  {
    continue;
  }
  (ALLOWLIST.has(pkg) ? allowlisted : blocking).push(`${pkg} (${severity})`);
}

if (allowlisted.length > 0)
{
  console.log(`Allowlisted:\n${allowlisted.map((l) => `- ${l}`).join("\n")}`);
}
if (blocking.length > 0)
{
  console.error(`Blocking:\n${blocking.map((l) => `- ${l}`).join("\n")}`);
  process.exit(1);
}

console.log("Security audit passed.");

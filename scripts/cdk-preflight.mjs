import { spawnSync } from "node:child_process";

function run(command, args)
{
  return spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
  });
}

function hasValue(value)
{
  return typeof value === "string" && value.trim().length > 0;
}

function logCheck(ok, label, detail = "")
{
  const icon = ok ? "OK" : "ERR";
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`[${icon}] ${label}${suffix}`);
}

function outputText(result)
{
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  return (stdout || stderr).trim();
}

let hasError = false;

const nodeResult = run("node", ["--version"]);
const npmResult = run("npm", ["--version"]);
const awsResult = run("aws", ["--version"]);
const cdkResult = run("npx", ["cdk", "--version"]);

logCheck(nodeResult.status === 0, "node available", outputText(nodeResult));
logCheck(npmResult.status === 0, "npm available", outputText(npmResult));
logCheck(awsResult.status === 0, "aws cli available", outputText(awsResult));
logCheck(cdkResult.status === 0, "cdk cli available", outputText(cdkResult));

if (nodeResult.status !== 0 || npmResult.status !== 0 || awsResult.status !== 0 || cdkResult.status !== 0)
{
  hasError = true;
}

const awsProfile = process.env.AWS_PROFILE;
const cdkAccount = process.env.CDK_DEFAULT_ACCOUNT;
const cdkRegion = process.env.CDK_DEFAULT_REGION;
const awsRegion = process.env.AWS_REGION;
const stage = process.env.TURNIER_HUB_STAGE;

logCheck(hasValue(stage), "TURNIER_HUB_STAGE", stage || "missing");
if (!hasValue(stage))
{
  hasError = true;
}

const hasAwsContext = hasValue(awsProfile) || (hasValue(cdkAccount) && (hasValue(cdkRegion) || hasValue(awsRegion)));
logCheck(
  hasAwsContext,
  "AWS account context",
  hasValue(awsProfile)
    ? `AWS_PROFILE=${awsProfile}`
    : `CDK_DEFAULT_ACCOUNT=${cdkAccount || "missing"}, region=${cdkRegion || awsRegion || "missing"}`
);
if (!hasAwsContext)
{
  hasError = true;
}

const stsArgs = hasValue(awsProfile)
  ? ["sts", "get-caller-identity", "--profile", awsProfile]
  : ["sts", "get-caller-identity"];
const stsResult = run("aws", stsArgs);
const stsOk = stsResult.status === 0;
logCheck(stsOk, "aws sts get-caller-identity", stsOk ? "credentials valid" : outputText(stsResult));
if (!stsOk)
{
  hasError = true;
}

const regionHint = cdkRegion || awsRegion || "eu-central-1";
console.log("");
console.log("Next commands:");
console.log(`  export TURNIER_HUB_STAGE=${stage || "dev"}`);
if (hasValue(awsProfile))
{
  console.log(`  export AWS_PROFILE=${awsProfile}`);
}
console.log(`  export CDK_DEFAULT_REGION=${regionHint}`);
console.log("  npm run cdk:synth");
console.log("  npm run cdk:diff");
console.log("  npm run cdk:deploy");

if (hasError)
{
  process.exit(1);
}

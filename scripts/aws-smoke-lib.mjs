import { spawnSync } from "node:child_process";

export function readStage()
{
  return process.env.TURNIER_HUB_STAGE?.trim() || "dev";
}

export function readProject()
{
  return process.env.TURNIER_HUB_PROJECT?.trim() || "turnier-hub";
}

export function namePrefix()
{
  return `${readProject()}-${readStage()}`;
}

export function stackName(layer)
{
  return `${namePrefix()}-${layer}`;
}

export function awsRegion()
{
  return process.env.CDK_DEFAULT_REGION?.trim()
    || process.env.AWS_REGION?.trim()
    || "eu-central-1";
}

export function awsBaseArgs()
{
  const args = ["--region", awsRegion()];
  const profile = process.env.AWS_PROFILE?.trim();
  if (profile)
  {
    args.push("--profile", profile);
  }
  return args;
}

export function inviteCodeSecretName()
{
  return process.env.TURNIER_HUB_INVITE_CODE_SECRET_NAME?.trim()
    || `/${readProject()}/${readStage()}/invite-code`;
}

function runAws(args)
{
  return spawnSync("aws", [...args, ...awsBaseArgs()], {
    stdio: "pipe",
    encoding: "utf8",
  });
}

export function awsJson(args)
{
  const result = runAws([...args, "--output", "json"]);
  const stderr = (result.stderr || "").trim();
  const stdout = (result.stdout || "").trim();
  if (result.status !== 0)
  {
    throw new Error(stderr || stdout || `aws ${args.join(" ")} failed`);
  }
  return JSON.parse(stdout);
}

export function getCallerAccountId()
{
  const identity = awsJson(["sts", "get-caller-identity"]);
  return identity.Account;
}

export function getStackOutputs(layer)
{
  const stack = stackName(layer);
  const data = awsJson(["cloudformation", "describe-stacks", "--stack-name", stack]);
  const outputs = {};
  for (const entry of data.Stacks?.[0]?.Outputs ?? [])
  {
    outputs[entry.OutputKey] = entry.OutputValue;
  }
  return { stack, outputs };
}

export function stackExists(layer)
{
  try
  {
    getStackOutputs(layer);
    return true;
  }
  catch
  {
    return false;
  }
}

export function readInviteCodeValue()
{
  const result = spawnSync(
    "aws",
    [
      "secretsmanager",
      "get-secret-value",
      "--secret-id",
      inviteCodeSecretName(),
      "--query",
      "SecretString",
      "--output",
      "text",
      ...awsBaseArgs(),
    ],
    { stdio: "pipe", encoding: "utf8" },
  );
  if (result.status !== 0)
  {
    throw new Error((result.stderr || result.stdout || "").trim());
  }
  const secretString = result.stdout.trim();
  try
  {
    const parsed = JSON.parse(secretString);
    if (parsed && typeof parsed.value === "string")
    {
      return parsed.value;
    }
  }
  catch
  {
    // plain string secret
  }
  return secretString;
}

export function readDatabaseSecret(databaseSecretArn)
{
  const result = runAws([
    "secretsmanager",
    "get-secret-value",
    "--secret-id",
    databaseSecretArn,
    "--query",
    "SecretString",
    "--output",
    "text",
  ]);
  if (result.status !== 0)
  {
    throw new Error((result.stderr || result.stdout || "").trim());
  }
  return JSON.parse(result.stdout.trim());
}

export function buildDatabaseUrl(secret, proxyEndpoint)
{
  const host = proxyEndpoint || secret.host;
  if (!host)
  {
    throw new Error("Cannot build DATABASE_URL: missing proxy endpoint and secret host");
  }
  const port = secret.port ?? 5432;
  const dbname = process.env.DATABASE_NAME?.trim() || secret.dbname || "turnier";
  const user = encodeURIComponent(secret.username);
  const pass = encodeURIComponent(secret.password);
  return `postgresql://${user}:${pass}@${host}:${port}/${dbname}`
    + "?schema=public&sslmode=require&connection_limit=1";
}

export function collectSmokeOutputs()
{
  const accountId = getCallerAccountId();
  const prefix = namePrefix();

  const cognito = getStackOutputs("cognito");
  const edge = getStackOutputs("edge");
  const lambda = getStackOutputs("lambda");

  let data = { stack: stackName("data"), outputs: {} };
  try
  {
    data = getStackOutputs("data");
  }
  catch
  {
    // data stack optional for SPA-only checks
  }

  const userPoolId = cognito.outputs.UserPoolIdOutput;
  const userPoolClientId = cognito.outputs.UserPoolClientIdOutput;
  const cloudFrontDomain = edge.outputs.CloudFrontDomain;
  const siteBucketName = edge.outputs.SiteBucketName || `${prefix}-site-${accountId}`;
  const distributionId = edge.outputs.CloudFrontDistributionId;
  const apiFunctionUrl = lambda.outputs.ApiFunctionUrlOutput;
  const sseFunctionUrl = lambda.outputs.SseFunctionUrlOutput;
  const dbProxyEndpoint = data.outputs.DbProxyEndpoint;
  const databaseSecretArn = data.outputs.DatabaseSecretArn;

  if (!userPoolId || !userPoolClientId || !cloudFrontDomain)
  {
    throw new Error(
      "Missing required stack outputs (UserPoolId, UserPoolClientId, CloudFrontDomain). "
      + "Run `npm run cdk:deploy` first.",
    );
  }

  const appBaseUrl = `https://${cloudFrontDomain}`;

  return {
    stage: readStage(),
    project: readProject(),
    namePrefix: prefix,
    accountId,
    userPoolId,
    userPoolClientId,
    cloudFrontDomain,
    appBaseUrl,
    siteBucketName,
    distributionId,
    apiFunctionUrl,
    sseFunctionUrl,
    dbProxyEndpoint,
    databaseSecretArn,
    inviteCodeSecretName: inviteCodeSecretName(),
    viteEnv: {
      VITE_AUTH_PROVIDER: "cognito",
      VITE_COGNITO_USER_POOL_ID: userPoolId,
      VITE_COGNITO_CLIENT_ID: userPoolClientId,
      VITE_API_BASE_URL: appBaseUrl,
    },
  };
}

export function formatEnvFile(viteEnv)
{
  return [
    "# Generated by scripts/aws-smoke-*.mjs — do not commit",
    `VITE_AUTH_PROVIDER="${viteEnv.VITE_AUTH_PROVIDER}"`,
    `VITE_COGNITO_USER_POOL_ID="${viteEnv.VITE_COGNITO_USER_POOL_ID}"`,
    `VITE_COGNITO_CLIENT_ID="${viteEnv.VITE_COGNITO_CLIENT_ID}"`,
    `VITE_API_BASE_URL="${viteEnv.VITE_API_BASE_URL}"`,
    "",
  ].join("\n");
}

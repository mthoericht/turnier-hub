import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

/**
 * Secret → environment bootstrap for the AWS Lambda runtime (Phase 5).
 *
 * In the cloud, sensitive configuration lives in AWS Secrets Manager rather than
 * in plain Lambda environment variables. The CDK stacks expose only the secret
 * *ARNs* (`DATABASE_SECRET_ARN`, `INVITE_CODE_SECRET_ARN`, `JWT_SECRET_ARN`) plus
 * the RDS Proxy endpoint (`DB_PROXY_ENDPOINT`). This module resolves those
 * secrets at cold start and writes the values the application actually reads
 * (`DATABASE_URL`, `INVITE_CODE`, `JWT_SECRET`) into `process.env`.
 *
 * Entry modules MUST `await bootstrapSecretsIntoEnv()` **before** importing
 * `config.ts` / `db.ts` (both read `process.env` at module-evaluation time).
 * Locally and in tests the plain env vars are already set, so this is a no-op
 * and the AWS SDK is never instantiated (no network, no credentials needed).
 */

let client: SecretsManagerClient | null = null;

function getClient(): SecretsManagerClient
{
  if (!client)
  {
    client = new SecretsManagerClient({});
  }
  return client;
}

const stringCache = new Map<string, string>();

/**
 * Fetches a secret's raw `SecretString`, cached per ARN for the container's
 * lifetime so warm invocations never re-hit Secrets Manager.
 */
export async function getSecretString(secretId: string): Promise<string>
{
  const cached = stringCache.get(secretId);
  if (cached !== undefined)
  {
    return cached;
  }

  const response = await getClient().send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );
  const value = response.SecretString;
  if (value === undefined)
  {
    throw new Error(`Secret ${secretId} has no string value`);
  }

  stringCache.set(secretId, value);
  return value;
}

/**
 * CDK stores `JWT_SECRET` / `INVITE_CODE` as JSON `{ "value": "<generated>" }`.
 * Falls back to the raw string for plain (non-JSON) secrets.
 */
function readValueSecret(raw: string): string
{
  try
  {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed
      && typeof parsed === "object"
      && typeof (parsed as { value?: unknown }).value === "string"
    )
    {
      return (parsed as { value: string }).value;
    }
  }
  catch
  {
    // Not JSON — treat as a plain string secret.
  }
  return raw;
}

type RdsSecret = {
  username: string;
  password: string;
  host?: string;
  port?: number;
  dbname?: string;
};

/**
 * Builds a Prisma-compatible Postgres connection string from the RDS-managed
 * secret, routed through the RDS Proxy endpoint. The proxy enforces TLS
 * (`requireTLS: true`), and a per-Lambda `connection_limit=1` keeps the proxy's
 * connection pool from being exhausted by concurrent containers.
 */
function buildDatabaseUrl(secret: RdsSecret): string
{
  const host = process.env.DB_PROXY_ENDPOINT ?? secret.host;
  if (!host)
  {
    throw new Error("Cannot build DATABASE_URL: no DB_PROXY_ENDPOINT and no host in secret");
  }
  const port = secret.port ?? 5432;
  const dbname = process.env.DATABASE_NAME ?? secret.dbname ?? "turnier";
  const user = encodeURIComponent(secret.username);
  const pass = encodeURIComponent(secret.password);
  return `postgresql://${user}:${pass}@${host}:${port}/${dbname}`
    + "?schema=public&sslmode=require&connection_limit=1";
}

let bootstrapPromise: Promise<void> | null = null;

async function runBootstrap(): Promise<void>
{
  if (!process.env.DATABASE_URL && process.env.DATABASE_SECRET_ARN)
  {
    const raw = await getSecretString(process.env.DATABASE_SECRET_ARN);
    process.env.DATABASE_URL = buildDatabaseUrl(JSON.parse(raw) as RdsSecret);
  }

  if (!process.env.INVITE_CODE && process.env.INVITE_CODE_SECRET_ARN)
  {
    process.env.INVITE_CODE = readValueSecret(
      await getSecretString(process.env.INVITE_CODE_SECRET_ARN),
    );
  }

  if (!process.env.JWT_SECRET && process.env.JWT_SECRET_ARN)
  {
    process.env.JWT_SECRET = readValueSecret(
      await getSecretString(process.env.JWT_SECRET_ARN),
    );
  }
}

/**
 * Idempotently resolves Secrets Manager values into `process.env`. Safe to call
 * from multiple entry modules; the underlying work runs at most once per
 * container. Returns immediately when the target env vars are already present
 * (local dev, tests, legacy single-VM), so no AWS call is made.
 */
export function bootstrapSecretsIntoEnv(): Promise<void>
{
  if (!bootstrapPromise)
  {
    bootstrapPromise = runBootstrap();
  }
  return bootstrapPromise;
}

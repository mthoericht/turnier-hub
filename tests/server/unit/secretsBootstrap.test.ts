import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Captures every `GetSecretValueCommand` so tests can return a per-ARN
 * `SecretString` and assert the number of Secrets Manager calls.
 */
const sendMock = vi.fn();

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: vi.fn().mockImplementation(() => ({
    send: (...args: unknown[]) => sendMock(...args),
  })),
  GetSecretValueCommand: vi.fn().mockImplementation((input: { SecretId: string }) => ({ input })),
}));

type Command = { input: { SecretId: string } };

/** Loads a fresh `secrets.ts` so the idempotent bootstrap promise resets. */
async function importSecretsFresh()
{
  vi.resetModules();
  return import("../../../server/src/runtime/secrets.js");
}

describe("secrets bootstrap (Secrets Manager → process.env)", () =>
{
  beforeEach(() =>
  {
    sendMock.mockReset();
  });

  afterEach(() =>
  {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("builds DATABASE_URL via the proxy endpoint and parses {value} secrets", async () =>
  {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("INVITE_CODE", undefined);
    vi.stubEnv("JWT_SECRET", undefined);
    vi.stubEnv("DATABASE_SECRET_ARN", "arn:db");
    vi.stubEnv("INVITE_CODE_SECRET_ARN", "arn:invite");
    vi.stubEnv("JWT_SECRET_ARN", "arn:jwt");
    vi.stubEnv("DB_PROXY_ENDPOINT", "proxy.internal.aws");

    sendMock.mockImplementation((command: Command) =>
    {
      switch (command.input.SecretId)
      {
        case "arn:db":
          return Promise.resolve({
            SecretString: JSON.stringify({
              username: "tu rnier",
              password: "p@ss/word",
              host: "ignored-direct-host",
              port: 5432,
              dbname: "turnier",
            }),
          });
        case "arn:invite":
          return Promise.resolve({ SecretString: JSON.stringify({ value: "INVITE123" }) });
        case "arn:jwt":
          return Promise.resolve({ SecretString: JSON.stringify({ value: "jwt-secret-value" }) });
        default:
          return Promise.reject(new Error(`unexpected secret ${command.input.SecretId}`));
      }
    });

    const { bootstrapSecretsIntoEnv } = await importSecretsFresh();
    await bootstrapSecretsIntoEnv();

    expect(process.env.DATABASE_URL).toBe(
      "postgresql://tu%20rnier:p%40ss%2Fword@proxy.internal.aws:5432/turnier"
      + "?schema=public&sslmode=require&connection_limit=1"
    );
    expect(process.env.INVITE_CODE).toBe("INVITE123");
    expect(process.env.JWT_SECRET).toBe("jwt-secret-value");
  });

  it("is a no-op when the target env vars are already set", async () =>
  {
    vi.stubEnv("DATABASE_URL", "postgresql://already/set");
    vi.stubEnv("INVITE_CODE", "already-code");
    vi.stubEnv("JWT_SECRET", "already-secret");
    vi.stubEnv("DATABASE_SECRET_ARN", "arn:db");
    vi.stubEnv("INVITE_CODE_SECRET_ARN", "arn:invite");
    vi.stubEnv("JWT_SECRET_ARN", "arn:jwt");

    const { bootstrapSecretsIntoEnv } = await importSecretsFresh();
    await bootstrapSecretsIntoEnv();

    expect(sendMock).not.toHaveBeenCalled();
    expect(process.env.DATABASE_URL).toBe("postgresql://already/set");
  });

  it("falls back to the raw string for non-JSON secrets", async () =>
  {
    vi.stubEnv("INVITE_CODE", undefined);
    vi.stubEnv("DATABASE_URL", "postgresql://already/set");
    vi.stubEnv("JWT_SECRET", "already-secret");
    vi.stubEnv("DATABASE_SECRET_ARN", undefined);
    vi.stubEnv("JWT_SECRET_ARN", undefined);
    vi.stubEnv("INVITE_CODE_SECRET_ARN", "arn:invite");

    sendMock.mockResolvedValue({ SecretString: "PLAIN-CODE" });

    const { bootstrapSecretsIntoEnv } = await importSecretsFresh();
    await bootstrapSecretsIntoEnv();

    expect(process.env.INVITE_CODE).toBe("PLAIN-CODE");
  });

  it("runs at most once and caches per-ARN reads", async () =>
  {
    vi.stubEnv("INVITE_CODE", undefined);
    vi.stubEnv("DATABASE_URL", "postgresql://already/set");
    vi.stubEnv("JWT_SECRET", "already-secret");
    vi.stubEnv("DATABASE_SECRET_ARN", undefined);
    vi.stubEnv("JWT_SECRET_ARN", undefined);
    vi.stubEnv("INVITE_CODE_SECRET_ARN", "arn:invite");

    sendMock.mockResolvedValue({ SecretString: JSON.stringify({ value: "X" }) });

    const { bootstrapSecretsIntoEnv } = await importSecretsFresh();
    await bootstrapSecretsIntoEnv();
    await bootstrapSecretsIntoEnv();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(process.env.INVITE_CODE).toBe("X");
  });
});

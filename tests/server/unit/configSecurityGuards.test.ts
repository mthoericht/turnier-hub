import { afterEach, describe, expect, it, vi } from "vitest";

async function importConfigFresh()
{
  vi.resetModules();
  return import("../../../server/src/config.js");
}

describe("config production security guards", () =>
{
  afterEach(() =>
  {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("rejects wildcard CORS allowlist in production", async () =>
  {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a".repeat(40));
    vi.stubEnv("INVITE_CODE", "b".repeat(16));
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "*");
    vi.stubEnv("TRUST_PROXY", "1");

    await expect(importConfigFresh())
      .rejects
      .toThrow("CORS_ALLOWED_ORIGINS must be a non-wildcard allowlist in production");
  });

  it("rejects too-short JWT secret in production", async () =>
  {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "short-secret");
    vi.stubEnv("INVITE_CODE", "b".repeat(16));
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://app.example.com");
    vi.stubEnv("TRUST_PROXY", "1");

    await expect(importConfigFresh())
      .rejects
      .toThrow("JWT_SECRET must be at least 32 characters in production");
  });

  it("rejects too-short invite code in production", async () =>
  {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a".repeat(40));
    vi.stubEnv("INVITE_CODE", "short-code");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://app.example.com");
    vi.stubEnv("TRUST_PROXY", "1");

    await expect(importConfigFresh())
      .rejects
      .toThrow("INVITE_CODE should be at least 12 characters in production");
  });
});

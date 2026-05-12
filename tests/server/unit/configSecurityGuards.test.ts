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
    vi.stubEnv("DEFAULT_SCHOOL_ID", "sch_123");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "*");
    vi.stubEnv("TRUST_PROXY", "1");

    await expect(importConfigFresh())
      .rejects
      .toThrow("CORS_ALLOWED_ORIGINS must be a non-wildcard allowlist in production");
  });

  it("requires DEFAULT_SCHOOL_ID in production", async () =>
  {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://app.example.com");
    vi.stubEnv("TRUST_PROXY", "1");

    await expect(importConfigFresh())
      .rejects
      .toThrow("DEFAULT_SCHOOL_ID must be set in production");
  });
});

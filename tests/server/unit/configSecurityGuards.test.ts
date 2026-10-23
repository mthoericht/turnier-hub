import { afterEach, describe, expect, it, vi } from "vitest";

async function importConfigFresh()
{
  vi.resetModules();
  return import("../../../server/src/config.js");
}

describe("account-free production configuration", () =>
{
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("rejects a wildcard browser origin in production", async () =>
  {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "*");
    vi.stubEnv("TRUST_PROXY", "false");
    await expect(importConfigFresh()).rejects.toThrow("non-wildcard allowlist");
  });

  it("requires explicit browser origins in production", async () =>
  {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "");
    await expect(importConfigFresh()).rejects.toThrow("CORS_ALLOWED_ORIGINS must be set");
  });

  it("starts without obsolete account secrets", async () =>
  {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://127.0.0.1:3220");
    vi.stubEnv("TRUST_PROXY", "false");
    await expect(importConfigFresh()).resolves.toMatchObject({ TRUST_PROXY: false });
  });
});

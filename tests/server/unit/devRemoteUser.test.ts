import { afterEach, describe, expect, it, vi } from "vitest";

describe("devRemoteUserFallback", () =>
{
  afterEach(() =>
  {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns empty in production even when DEV_REMOTE_USER is set", async () =>
  {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_REMOTE_USER", "hacker");
    const { devRemoteUserFallback } = await import("../../../server/src/lib/devRemoteUser.js");
    expect(devRemoteUserFallback()).toBe("");
  });

  it("returns trimmed DEV_REMOTE_USER when not production", async () =>
  {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_REMOTE_USER", "  alice  ");
    const { devRemoteUserFallback } = await import("../../../server/src/lib/devRemoteUser.js");
    expect(devRemoteUserFallback()).toBe("alice");
  });
});

describe("devRemoteGroupsFallback", () =>
{
  afterEach(() =>
  {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns empty in production even when DEV_REMOTE_GROUPS is set", async () =>
  {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_REMOTE_GROUPS", "admins");
    const { devRemoteGroupsFallback } = await import("../../../server/src/lib/devRemoteUser.js");
    expect(devRemoteGroupsFallback()).toBe("");
  });

  it("returns trimmed DEV_REMOTE_GROUPS when not production", async () =>
  {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_REMOTE_GROUPS", " editors, admins ");
    const { devRemoteGroupsFallback } = await import("../../../server/src/lib/devRemoteUser.js");
    expect(devRemoteGroupsFallback()).toBe("editors, admins");
  });

  it("returns empty when unset", async () =>
  {
    vi.stubEnv("NODE_ENV", "development");
    const { devRemoteGroupsFallback } = await import("../../../server/src/lib/devRemoteUser.js");
    expect(devRemoteGroupsFallback()).toBe("");
  });
});

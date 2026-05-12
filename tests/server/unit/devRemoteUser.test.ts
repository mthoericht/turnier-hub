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

describe("devRemoteAdminEnabled", () =>
{
  afterEach(() =>
  {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is false in production even when DEV_REMOTE_ADMIN=1", async () =>
  {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_REMOTE_ADMIN", "1");
    const { devRemoteAdminEnabled } = await import("../../../server/src/lib/devRemoteUser.js");
    expect(devRemoteAdminEnabled()).toBe(false);
  });

  it("is true for 1 / true / yes when not production", async () =>
  {
    vi.stubEnv("NODE_ENV", "development");
    const { devRemoteAdminEnabled } = await import("../../../server/src/lib/devRemoteUser.js");
    vi.stubEnv("DEV_REMOTE_ADMIN", "1");
    expect(devRemoteAdminEnabled()).toBe(true);
    vi.stubEnv("DEV_REMOTE_ADMIN", "TRUE");
    expect(devRemoteAdminEnabled()).toBe(true);
    vi.stubEnv("DEV_REMOTE_ADMIN", "yes");
    expect(devRemoteAdminEnabled()).toBe(true);
  });

  it("is false when unset or not a truthy token", async () =>
  {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_REMOTE_ADMIN", "");
    const { devRemoteAdminEnabled } = await import("../../../server/src/lib/devRemoteUser.js");
    expect(devRemoteAdminEnabled()).toBe(false);
    vi.stubEnv("DEV_REMOTE_ADMIN", "0");
    expect(devRemoteAdminEnabled()).toBe(false);
  });
});

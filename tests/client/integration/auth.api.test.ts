import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server/src/app.js";
import { prisma } from "../../../server/src/db.js";
import {
  AUTH_IDENTIFIER_MAX_REQUESTS,
  AUTH_LOGIN_MAX_REQUESTS,
  AUTH_SIGNUP_MAX_REQUESTS,
  INVITE_CODE,
  LOGIN_LOCKOUT_START_AFTER_FAILURES,
} from "../../../server/src/config.js";
import { resetAuthRateLimitForTests } from "../../../server/src/middleware/authRateLimit.js";
import {
  fetchAuthSchools,
  fetchAuthMe,
  postAuthLogin,
  postAuthSignup,
} from "../../../client/src/api/authApi";
import { setToken } from "../../../client/src/api/http";
import { resetDatabase } from "../../server/helpers/db.js";

import type { Server } from "node:http";

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

function installLocalStorageMock(): void
{
  const map = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
}

describe("auth API integration (via client API)", () =>
{
  async function getFirstSchoolId(): Promise<string>
  {
    const schools = await fetchAuthSchools();
    if (schools.length === 0)
    {
      throw new Error("Expected at least one school option");
    }
    return schools[0]!.id;
  }

  const app = createApp();
  let server: Server | null = null;
  let apiBaseUrl = "";
  const originalFetch = globalThis.fetch;

  beforeAll(async () =>
  {
    installLocalStorageMock();
    await new Promise<void>((resolve) =>
    {
      server = app.listen(0, () => resolve());
    });

    const address = server!.address();
    if (!address || typeof address === "string")
    {
      throw new Error("Could not determine test server port");
    }

    apiBaseUrl = `http://127.0.0.1:${address.port}`;

    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    {
      if (typeof input === "string" && input.startsWith("/"))
      {
        return originalFetch(`${apiBaseUrl}${input}`, init);
      }
      if (input instanceof URL && input.pathname.startsWith("/"))
      {
        return originalFetch(
          new URL(`${apiBaseUrl}${input.pathname}${input.search}`),
          init
        );
      }
      return originalFetch(input as RequestInfo, init);
    }) as typeof fetch;
  });

  beforeEach(async () =>
  {
    resetAuthRateLimitForTests();
    await resetDatabase();
    setToken(null);
  });

  afterAll(async () =>
  {
    globalThis.fetch = originalFetch;
    if (server)
    {
      await new Promise<void>((resolve, reject) =>
      {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await prisma.$disconnect();
  });

  it("rejects signup with invalid invite code", async () =>
  {
    const schoolId = await getFirstSchoolId();
    await expect(
      postAuthSignup({
        username: "User_InvalidInvite",
        email: "invalid-invite@example.com",
        password: "password123",
        inviteCode: "wrong",
        schoolId,
      })
    ).rejects.toThrow("Ungültiger Einladungscode");
  });

  it("signups, returns a token and /me works", async () =>
  {
    const schoolId = await getFirstSchoolId();
    const auth = await postAuthSignup({
      username: "User_One",
      email: "user.one.int@example.com",
      password: "password123",
      inviteCode: INVITE_CODE,
      schoolId,
    });

    expect(typeof auth.token).toBe("string");

    setToken(auth.token);
    const me = await fetchAuthMe();
    expect(me.email).toBe("user.one.int@example.com");
  });

  it("rejects duplicate signup email", async () =>
  {
    const schoolId = await getFirstSchoolId();
    await postAuthSignup({
      username: "User_Dup_1",
      email: "dup@example.com",
      password: "password123",
      inviteCode: INVITE_CODE,
      schoolId,
    });

    await expect(
      postAuthSignup({
        username: "User_Dup_2",
        email: "dup@example.com",
        password: "password123",
        inviteCode: INVITE_CODE,
        schoolId,
      })
    ).rejects.toThrow("E-Mail ist bereits registriert");
  });

  it("logs in with correct credentials", async () =>
  {
    const schoolId = await getFirstSchoolId();
    await postAuthSignup({
      username: "User_Login",
      email: "login@example.com",
      password: "password123",
      inviteCode: INVITE_CODE,
      schoolId,
    });

    const auth = await postAuthLogin("login@example.com", "password123");
    expect(typeof auth.token).toBe("string");
    expect(auth.user.email).toBe("login@example.com");
  });

  it("rejects login with wrong password", async () =>
  {
    const schoolId = await getFirstSchoolId();
    await postAuthSignup({
      username: "User_Login_Wrong",
      email: "wrongpw@example.com",
      password: "password123",
      inviteCode: INVITE_CODE,
      schoolId,
    });

    await expect(
      postAuthLogin("wrongpw@example.com", "not-the-password")
    ).rejects.toThrow("E-Mail oder Passwort falsch");
  });

  it("rejects /me without token", async () =>
  {
    setToken(null);
    await expect(fetchAuthMe()).rejects.toThrow("Nicht angemeldet");
  });

  it("revokes previous sessions via token version bump", async () =>
  {
    const schoolId = await getFirstSchoolId();
    const auth = await postAuthSignup({
      username: "User_Revoke",
      email: "revoke@example.com",
      password: "password123",
      inviteCode: INVITE_CODE,
      schoolId,
    });

    const oldToken = auth.token;
    setToken(oldToken);

    const revokeResponse = await fetch(`${apiBaseUrl}/api/auth/revoke-sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oldToken}`,
      },
    });
    expect(revokeResponse.status).toBe(200);
    const revokeData = await revokeResponse.json() as { token: string };
    expect(typeof revokeData.token).toBe("string");
    expect(revokeData.token).not.toBe(oldToken);

    const staleTokenMe = await fetch(`${apiBaseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${oldToken}`,
      },
    });
    expect(staleTokenMe.status).toBe(401);
  });

  it("rate-limits repeated login attempts", async () =>
  {
    const acceptedByRequestLimit = Math.min(
      AUTH_LOGIN_MAX_REQUESTS,
      AUTH_IDENTIFIER_MAX_REQUESTS
    );
    const acceptedAttempts = Math.min(
      acceptedByRequestLimit,
      LOGIN_LOCKOUT_START_AFTER_FAILURES
    );
    for (let attempt = 0; attempt < acceptedAttempts; attempt += 1)
    {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "unknown-rate-limit@example.com",
          password: "invalid-password",
        }),
      });
      expect(response.status).toBe(401);
    }

    const blocked = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "unknown-rate-limit@example.com",
        password: "invalid-password",
      }),
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("applies temporary login lockout after repeated failed attempts", async () =>
  {
    const attemptsBeforeLockout = LOGIN_LOCKOUT_START_AFTER_FAILURES;
    for (let attempt = 0; attempt < attemptsBeforeLockout; attempt += 1)
    {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "unknown-lockout@example.com",
          password: "invalid-password",
        }),
      });
      expect(response.status).toBe(401);
    }

    const locked = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "unknown-lockout@example.com",
        password: "invalid-password",
      }),
    });
    expect(locked.status).toBe(429);
    const retryAfter = Number(locked.headers.get("retry-after"));
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
  });

  it("rate-limits repeated signup attempts", async () =>
  {
    const schoolId = await getFirstSchoolId();

    for (let attempt = 0; attempt < AUTH_SIGNUP_MAX_REQUESTS; attempt += 1)
    {
      const response = await fetch(`${apiBaseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "User_Ddos_Test",
          email: `ddos-signup-${attempt}@example.com`,
          password: "password123",
          inviteCode: "wrong",
          schoolId,
        }),
      });
      expect(response.status).toBe(403);
    }

    const blocked = await fetch(`${apiBaseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "User_Ddos_Test",
        email: "ddos-signup-final@example.com",
        password: "password123",
        inviteCode: "wrong",
        schoolId,
      }),
    });
    expect(blocked.status).toBe(429);
  });
});


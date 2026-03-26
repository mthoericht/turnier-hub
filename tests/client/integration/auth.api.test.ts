import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server/src/app.js";
import { prisma } from "../../../server/src/db.js";
import { INVITE_CODE } from "../../../server/src/config.js";
import {
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
    await expect(
      postAuthSignup({
        username: "User_InvalidInvite",
        email: "invalid-invite@example.com",
        password: "password123",
        inviteCode: "wrong",
      })
    ).rejects.toThrow("Ungültiger Einladungscode");
  });

  it("signups, returns a token and /me works", async () =>
  {
    const auth = await postAuthSignup({
      username: "User_One",
      email: "user.one.int@example.com",
      password: "password123",
      inviteCode: INVITE_CODE,
    });

    expect(typeof auth.token).toBe("string");

    setToken(auth.token);
    const me = await fetchAuthMe();
    expect(me.email).toBe("user.one.int@example.com");
  });

  it("rejects duplicate signup email", async () =>
  {
    await postAuthSignup({
      username: "User_Dup_1",
      email: "dup@example.com",
      password: "password123",
      inviteCode: INVITE_CODE,
    });

    await expect(
      postAuthSignup({
        username: "User_Dup_2",
        email: "dup@example.com",
        password: "password123",
        inviteCode: INVITE_CODE,
      })
    ).rejects.toThrow("E-Mail ist bereits registriert");
  });

  it("logs in with correct credentials", async () =>
  {
    await postAuthSignup({
      username: "User_Login",
      email: "login@example.com",
      password: "password123",
      inviteCode: INVITE_CODE,
    });

    const auth = await postAuthLogin("login@example.com", "password123");
    expect(typeof auth.token).toBe("string");
    expect(auth.user.email).toBe("login@example.com");
  });

  it("rejects login with wrong password", async () =>
  {
    await postAuthSignup({
      username: "User_Login_Wrong",
      email: "wrongpw@example.com",
      password: "password123",
      inviteCode: INVITE_CODE,
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
});


import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { createApp } from "../../../server/src/app.js";
import { prisma } from "../../../server/src/db.js";
import { postAuthLogin } from "../../../client/src/api/authApi";
import {
  deleteAdminSchool,
  fetchAdminSchools,
  fetchAdminAuditLogs,
  fetchAdminUsers,
  patchAdminUserRole,
  patchAdminUserSchool,
} from "../../../client/src/api/adminApi";
import { setToken } from "../../../client/src/api/http";
import { resetDatabase } from "../../server/helpers/db.js";

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

type SeededUsers = {
  admin: { email: string; password: string; id: string };
  user: { email: string; password: string; id: string };
  schoolIds: { first: string; second: string };
};

async function seedAdminFixture(): Promise<SeededUsers>
{
  const school1 = await prisma.school.create({ data: { name: "School One" } });
  const school2 = await prisma.school.create({ data: { name: "School Two" } });
  const password = "password123";
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@example.com",
      username: "adminuser",
      passwordHash,
      role: "ADMIN",
      schoolId: school1.id,
    },
  });
  const user = await prisma.user.create({
    data: {
      email: "user@example.com",
      username: "normaluser",
      passwordHash,
      role: "USER",
      schoolId: school1.id,
    },
  });

  return {
    admin: { email: admin.email, password, id: admin.id },
    user: { email: user.email, password, id: user.id },
    schoolIds: { first: school1.id, second: school2.id },
  };
}

describe("admin API integration (via client API)", () =>
{
  const app = createApp();
  let server: Server | null = null;
  let apiBaseUrl = "";
  const originalFetch = globalThis.fetch;
  let fixture: SeededUsers;

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
    fixture = await seedAdminFixture();
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

  it("rejects admin endpoints for non-admin users", async () =>
  {
    const auth = await postAuthLogin(fixture.user.email, fixture.user.password);
    setToken(auth.token);

    await expect(fetchAdminUsers()).rejects.toThrow("Admin-Rechte erforderlich");
  });

  it("allows admins to reassign school and role for another user", async () =>
  {
    const auth = await postAuthLogin(fixture.admin.email, fixture.admin.password);
    setToken(auth.token);

    const updatedSchool = await patchAdminUserSchool(
      fixture.user.id,
      fixture.schoolIds.second
    );
    expect(updatedSchool.school.id).toBe(fixture.schoolIds.second);

    const updatedRole = await patchAdminUserRole(fixture.user.id, "admin");
    expect(updatedRole.role).toBe("admin");

    const logs = await fetchAdminAuditLogs();
    expect(logs.some((log) => log.action === "user.school.update")).toBe(true);
    expect(logs.some((log) => log.action === "user.role.update")).toBe(true);
  });

  it("prevents demoting the last remaining admin", async () =>
  {
    await prisma.user.delete({ where: { id: fixture.user.id } });
    const auth = await postAuthLogin(fixture.admin.email, fixture.admin.password);
    setToken(auth.token);

    await expect(
      patchAdminUserRole(fixture.admin.id, "user")
    ).rejects.toThrow("Mindestens ein Admin muss erhalten bleiben");

    const secondPasswordHash = await bcrypt.hash("password123", 10);
    const secondAdmin = await prisma.user.create({
      data: {
        email: "second-admin@example.com",
        username: "secondadmin",
        passwordHash: secondPasswordHash,
        role: "ADMIN",
        schoolId: fixture.schoolIds.first,
      },
    });
    await patchAdminUserRole(secondAdmin.id, "user");

    const users = await fetchAdminUsers();
    const remainingAdmins = users.filter((user) => user.role === "admin");
    expect(remainingAdmins).toHaveLength(1);
    expect(remainingAdmins[0]!.id).toBe(fixture.admin.id);
  });

  it("blocks deleting schools that still have users and allows delete when empty", async () =>
  {
    const auth = await postAuthLogin(fixture.admin.email, fixture.admin.password);
    setToken(auth.token);

    await expect(deleteAdminSchool(fixture.schoolIds.first)).rejects.toThrow(
      "Schule hat noch Benutzer und kann nicht gelöscht werden"
    );

    await patchAdminUserSchool(fixture.user.id, fixture.schoolIds.second);
    await patchAdminUserSchool(fixture.admin.id, fixture.schoolIds.second);
    await expect(deleteAdminSchool(fixture.schoolIds.first)).resolves.toBeUndefined();

    const schools = await fetchAdminSchools();
    expect(schools.some((school) => school.id === fixture.schoolIds.first)).toBe(false);
  });
});

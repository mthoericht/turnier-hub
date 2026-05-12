import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server/src/app.js";
import { prisma } from "../../../server/src/db.js";
import {
  deleteAdminSchool,
  fetchAdminSchools,
} from "../../../client/src/api/adminApi";
import { resetDatabase } from "../../server/helpers/db.js";
import { wrapFetchForTestApi } from "../helpers/remoteUserFetch.js";

const ADMIN_SUBJECT = "admin-subject";
const USER_SUBJECT = "normal-subject";

describe("admin API integration (via client API)", () =>
{
  const app = createApp();
  let server: Server | null = null;
  let apiBaseUrl = "";
  const originalFetch = globalThis.fetch;

  beforeAll(async () =>
  {
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
  });

  beforeEach(async () =>
  {
    await resetDatabase();
    delete process.env.DEV_REMOTE_ADMIN;
    process.env.ADMIN_REMOTE_USERS = ADMIN_SUBJECT;
  });

  afterAll(async () =>
  {
    delete process.env.ADMIN_REMOTE_USERS;
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

  it("grants admin when Remote-Groups contains the configured admin group", async () =>
  {
    delete process.env.ADMIN_REMOTE_USERS;
    delete process.env.ADMIN_REMOTE_GROUP;
    globalThis.fetch = wrapFetchForTestApi(originalFetch, apiBaseUrl, USER_SUBJECT, {
      "Remote-Groups": "editors,admins",
    });
    const schools = await fetchAdminSchools();
    expect(Array.isArray(schools)).toBe(true);
    expect(schools.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects admin endpoints for non-admin subjects", async () =>
  {
    globalThis.fetch = wrapFetchForTestApi(originalFetch, apiBaseUrl, USER_SUBJECT);
    await expect(fetchAdminSchools()).rejects.toThrow("Admin-Rechte erforderlich");
  });

  it("allows admins to delete an empty school", async () =>
  {
    globalThis.fetch = wrapFetchForTestApi(originalFetch, apiBaseUrl, ADMIN_SUBJECT);
    const schools = await fetchAdminSchools();
    const empty = schools.find((s) => s.catalogCount === 0);
    expect(empty).toBeDefined();
    await expect(deleteAdminSchool(empty!.id)).resolves.toBeUndefined();
    const after = await fetchAdminSchools();
    expect(after.some((s) => s.id === empty!.id)).toBe(false);
  });

  it("blocks deleting schools that still have catalog data", async () =>
  {
    globalThis.fetch = wrapFetchForTestApi(originalFetch, apiBaseUrl, ADMIN_SUBJECT);
    const school = await prisma.school.findFirstOrThrow({ where: { name: "defaultSchool" } });
    await prisma.schoolClass.create({
      data: { name: "7a", createdBySubject: "x", schoolId: school.id },
    });
    await expect(deleteAdminSchool(school.id)).rejects.toThrow(
      "Schule enthält noch Katalogdaten",
    );
  });
});

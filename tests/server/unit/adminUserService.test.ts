import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminUserServiceError,
  promoteUserToAdminByEmail,
} from "../../../server/src/services/adminUserService.js";

const prismaMock = {
  user: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

describe("adminUserService", () =>
{
  beforeEach(() =>
  {
    vi.clearAllMocks();
  });

  afterEach(() =>
  {
    vi.restoreAllMocks();
  });

  it("promotes a USER to ADMIN by e-mail (case-insensitive lookup)", async () =>
  {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
      role: "USER",
    });
    prismaMock.user.update.mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
      role: "ADMIN",
    });

    const result = await promoteUserToAdminByEmail(prismaMock as never, "Admin@Example.com");

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "Admin@Example.com", mode: "insensitive" } },
      select: { id: true, email: true, role: true },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { role: "ADMIN" },
      select: { id: true, email: true, role: true },
    });
    expect(result).toEqual({
      id: "u1",
      email: "admin@example.com",
      role: "ADMIN",
      alreadyAdmin: false,
    });
  });

  it("returns alreadyAdmin when the user is already ADMIN", async () =>
  {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "u1",
      email: "admin@example.com",
      role: "ADMIN",
    });

    const result = await promoteUserToAdminByEmail(prismaMock as never, "admin@example.com");

    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(result.alreadyAdmin).toBe(true);
  });

  it("throws NOT_FOUND when no user matches the e-mail", async () =>
  {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      promoteUserToAdminByEmail(prismaMock as never, "missing@example.com"),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    } satisfies Partial<AdminUserServiceError>);
  });
});

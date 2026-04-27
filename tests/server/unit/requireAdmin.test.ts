import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { requireAdmin } from "../../../server/src/middleware/requireAdmin.js";

function createResponseMock(): Response
{
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe("requireAdmin middleware", () =>
{
  it("allows requests with ADMIN role", () =>
  {
    const req = { userRole: "ADMIN" } as Request;
    const res = createResponseMock();
    const next = vi.fn() as NextFunction;

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((res.status as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("rejects requests without ADMIN role", () =>
  {
    const req = { userRole: "USER" } as Request;
    const res = createResponseMock();
    const next = vi.fn() as NextFunction;

    requireAdmin(req, res, next);

    const statusSpy = res.status as unknown as ReturnType<typeof vi.fn>;
    const jsonSpy = res.json as unknown as ReturnType<typeof vi.fn>;
    expect(statusSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({ error: "Admin-Rechte erforderlich" });
    expect(next).not.toHaveBeenCalled();
  });
});

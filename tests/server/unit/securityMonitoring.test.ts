import { afterEach, describe, expect, it, vi } from "vitest";
import { recordHttpSecurityStatus } from "../../../server/src/security/monitoring.js";

describe("security monitoring", () =>
{
  afterEach(() =>
  {
    vi.restoreAllMocks();
  });

  it("emits a structured warn log for tracked HTTP statuses", () =>
  {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    recordHttpSecurityStatus(401);
    recordHttpSecurityStatus(403);
    recordHttpSecurityStatus(429);

    expect(warnSpy).toHaveBeenCalledTimes(3);

    for (const call of warnSpy.mock.calls)
    {
      const [arg] = call;
      const payload = JSON.parse(String(arg)) as Record<string, unknown>;
      expect(payload.category).toBe("security");
      expect(payload.level).toBe("warn");
      expect(payload.type).toBe("http_auth_status");
    }

    const statuses = warnSpy.mock.calls.map((call) =>
    {
      const payload = JSON.parse(String(call[0])) as { details: { status: number } };
      return payload.details.status;
    });
    expect(statuses).toEqual([401, 403, 429]);
  });

  it("ignores non-tracked HTTP status codes", () =>
  {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    recordHttpSecurityStatus(200);
    recordHttpSecurityStatus(404);
    recordHttpSecurityStatus(500);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});

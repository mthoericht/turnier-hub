import { describe, expect, it } from "vitest";
import { remoteGroupsHeaderGrantsAdmin } from "../../../server/src/lib/remoteAdminGroups.js";

describe("remoteGroupsHeaderGrantsAdmin", () =>
{
  it("defaults to group name admins (case-insensitive)", () =>
  {
    expect(remoteGroupsHeaderGrantsAdmin("Admins", undefined)).toBe(true);
    expect(remoteGroupsHeaderGrantsAdmin("users, admins", undefined)).toBe(true);
    expect(remoteGroupsHeaderGrantsAdmin("user", undefined)).toBe(false);
  });

  it("uses ADMIN_REMOTE_GROUP when set", () =>
  {
    expect(remoteGroupsHeaderGrantsAdmin("foo,bar", "bar")).toBe(true);
    expect(remoteGroupsHeaderGrantsAdmin("foo", "bar")).toBe(false);
  });

  it("disables group check when ADMIN_REMOTE_GROUP is empty string", () =>
  {
    expect(remoteGroupsHeaderGrantsAdmin("admins", "")).toBe(false);
  });

  it("reads first header value when header is an array", () =>
  {
    expect(remoteGroupsHeaderGrantsAdmin(["admins", "other"], undefined)).toBe(true);
  });
});

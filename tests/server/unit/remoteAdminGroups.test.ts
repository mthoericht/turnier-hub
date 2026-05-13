import { describe, expect, it } from "vitest";
import { remoteGroupsHeaderGrantsAdmin } from "../../../server/src/lib/remoteAdminGroups.js";

describe("remoteGroupsHeaderGrantsAdmin", () =>
{
  it("defaults to group name admins (case-insensitive)", () =>
  {
    expect(remoteGroupsHeaderGrantsAdmin("Admins")).toBe(true);
    expect(remoteGroupsHeaderGrantsAdmin("users, admins")).toBe(true);
    expect(remoteGroupsHeaderGrantsAdmin("user")).toBe(false);
  });

  it("reads first header value when header is an array", () =>
  {
    expect(remoteGroupsHeaderGrantsAdmin(["admins", "other"])).toBe(true);
  });
});

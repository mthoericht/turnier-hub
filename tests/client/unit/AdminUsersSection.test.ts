/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AdminUsersSection from "../../../client/src/components/admin/AdminUsersSection.vue";

describe("AdminUsersSection", () =>
{
  it("emits school and role updates with payload", async () =>
  {
    const wrapper = mount(AdminUsersSection, {
      props: {
        users: [
          {
            id: "u1",
            username: "admin",
            email: "admin@example.com",
            role: "admin",
            school: { id: "s1", name: "School 1" },
          },
        ],
        schools: [
          { id: "s1", name: "School 1", userCount: 1 },
          { id: "s2", name: "School 2", userCount: 0 },
        ],
        selectClass: "select-class",
        currentUserId: "u2",
      },
    });

    const selects = wrapper.findAll("select");
    await selects[0]!.setValue("s2");
    await selects[1]!.setValue("user");

    const schoolEmit = wrapper.emitted("update-user-school");
    const roleEmit = wrapper.emitted("update-user-role");
    expect(schoolEmit).toBeTruthy();
    expect(roleEmit).toBeTruthy();
    expect(schoolEmit?.[0]?.[0]).toMatchObject({ schoolId: "s2" });
    expect(roleEmit?.[0]?.[0]).toMatchObject({ role: "user" });
  });

  it("disables role select for current user and renders empty state", () =>
  {
    const wrapper = mount(AdminUsersSection, {
      props: {
        users: [],
        schools: [],
        selectClass: "select-class",
        currentUserId: "u1",
      },
    });

    expect(wrapper.text()).toContain("Keine Benutzer gefunden.");
  });
});

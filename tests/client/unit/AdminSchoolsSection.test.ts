/* @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AdminSchoolsSection from "../../../client/src/components/admin/AdminSchoolsSection.vue";

describe("AdminSchoolsSection", () =>
{
  it("emits create, edit and remove events", async () =>
  {
    const school = { id: "s1", name: "School 1", catalogCount: 2 };
    const wrapper = mount(AdminSchoolsSection, {
      props: {
        schools: [school],
      },
    });

    const buttons = wrapper.findAll("button");
    await buttons[0]!.trigger("click");
    await buttons[1]!.trigger("click");
    await buttons[2]!.trigger("click");

    expect(wrapper.emitted("create-school")).toBeTruthy();
    expect(wrapper.emitted("edit-school")?.[0]?.[0]).toEqual(school);
    expect(wrapper.emitted("remove-school")?.[0]?.[0]).toEqual(school);
  });

  it("renders empty state when no schools are provided", () =>
  {
    const wrapper = mount(AdminSchoolsSection, {
      props: {
        schools: [],
      },
    });

    expect(wrapper.text()).toContain("Noch keine Schulen vorhanden.");
  });
});

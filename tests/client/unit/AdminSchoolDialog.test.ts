/* @vitest-environment jsdom */
import { defineComponent } from "vue";
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AdminSchoolDialog from "../../../client/src/components/admin/AdminSchoolDialog.vue";

const EntityDialogStub = defineComponent({
  name: "EntityDialog",
  props: {
    open: { type: Boolean, required: true },
    title: { type: String, required: true },
    description: { type: String, required: false, default: "" },
    submitLabel: { type: String, required: true },
  },
  emits: ["close", "submit"],
  template: `
    <div data-testid="entity-dialog">
      <h2 data-testid="title">{{ title }}</h2>
      <p data-testid="description">{{ description }}</p>
      <button data-testid="close" @click="$emit('close')">close</button>
      <button data-testid="submit" @click="$emit('submit')">submit</button>
      <slot />
    </div>
  `,
});

describe("AdminSchoolDialog", () =>
{
  it("renders create mode and emits model updates", async () =>
  {
    const wrapper = mount(AdminSchoolDialog, {
      props: {
        open: true,
        editingId: null,
        modelValue: "",
        inputClass: "input-class",
      },
      global: {
        stubs: {
          EntityDialog: EntityDialogStub,
        },
      },
    });

    expect(wrapper.get("[data-testid='title']").text()).toBe("Schule anlegen");
    await wrapper.get("input#school-name").setValue("New School");
    expect(wrapper.emitted("update:modelValue")?.[0]?.[0]).toBe("New School");
  });

  it("renders edit mode and forwards close/submit events", async () =>
  {
    const wrapper = mount(AdminSchoolDialog, {
      props: {
        open: true,
        editingId: "s1",
        modelValue: "School 1",
        inputClass: "input-class",
      },
      global: {
        stubs: {
          EntityDialog: EntityDialogStub,
        },
      },
    });

    expect(wrapper.get("[data-testid='title']").text()).toBe("Schule bearbeiten");
    await wrapper.get("[data-testid='close']").trigger("click");
    await wrapper.get("[data-testid='submit']").trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
    expect(wrapper.emitted("submit")).toBeTruthy();
  });
});

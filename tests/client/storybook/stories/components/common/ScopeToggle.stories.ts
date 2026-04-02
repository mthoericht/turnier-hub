import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { ref } from "vue";
import ScopeToggle from "@/components/common/ScopeToggle.vue";

const meta: Meta<typeof ScopeToggle> = {
  title: "Components/Common/ScopeToggle",
  component: ScopeToggle,
};

export default meta;

type Story = StoryObj<typeof ScopeToggle>;

export const AllSelected: Story = {
  render: () => ({
    components: { ScopeToggle },
    setup()
    {
      const modelValue = ref<"all" | "own">("all");
      return { modelValue };
    },
    template: "<ScopeToggle v-model=\"modelValue\" />",
  }),
};

export const OwnSelected: Story = {
  render: () => ({
    components: { ScopeToggle },
    setup()
    {
      const modelValue = ref<"all" | "own">("own");
      return { modelValue };
    },
    template: "<ScopeToggle v-model=\"modelValue\" />",
  }),
};

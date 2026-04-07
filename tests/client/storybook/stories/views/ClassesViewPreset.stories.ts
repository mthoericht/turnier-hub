import type { Meta, StoryObj } from "@storybook/vue3-vite";
import ClassesViewPreset from "@/views/ClassesViewPreset.vue";

const meta: Meta<typeof ClassesViewPreset> = {
  title: "Views/ClassesViewPreset",
  component: ClassesViewPreset,
};

export default meta;

type Story = StoryObj<typeof ClassesViewPreset>;

export const Default: Story = {
  parameters: {
    route: "/classes",
  },
};


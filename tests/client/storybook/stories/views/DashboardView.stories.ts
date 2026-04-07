import type { Meta, StoryObj } from "@storybook/vue3-vite";
import DashboardView from "@/views/DashboardView.vue";

const meta: Meta<typeof DashboardView> = {
  title: "Views/DashboardView",
  component: DashboardView,
};

export default meta;

type Story = StoryObj<typeof DashboardView>;

export const Default: Story = {
  parameters: {
    route: "/",
  },
};

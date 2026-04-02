import type { Meta, StoryObj } from "@storybook/vue3-vite";
import HomeView from "@/views/HomeView.vue";

const meta: Meta<typeof HomeView> = {
  title: "Views/HomeView",
  component: HomeView,
};

export default meta;

type Story = StoryObj<typeof HomeView>;

export const Default: Story = {};

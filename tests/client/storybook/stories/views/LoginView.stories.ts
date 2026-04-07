import type { Meta, StoryObj } from "@storybook/vue3-vite";
import LoginView from "@/views/LoginView.vue";

const meta: Meta<typeof LoginView> = {
  title: "Views/LoginView",
  component: LoginView,
};

export default meta;

type Story = StoryObj<typeof LoginView>;

export const Default: Story = {
  parameters: {
    route: "/login",
  },
};


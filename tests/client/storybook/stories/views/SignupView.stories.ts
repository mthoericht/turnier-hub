import type { Meta, StoryObj } from "@storybook/vue3-vite";
import SignupView from "@/views/SignupView.vue";

const meta: Meta<typeof SignupView> = {
  title: "Views/SignupView",
  component: SignupView,
};

export default meta;

type Story = StoryObj<typeof SignupView>;

export const Default: Story = {
  parameters: {
    route: "/signup",
  },
};


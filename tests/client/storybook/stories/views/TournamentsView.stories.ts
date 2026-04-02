import type { Meta, StoryObj } from "@storybook/vue3-vite";
import TournamentsView from "@/views/TournamentsView.vue";

const meta: Meta<typeof TournamentsView> = {
  title: "Views/TournamentsView",
  component: TournamentsView,
};

export default meta;

type Story = StoryObj<typeof TournamentsView>;

export const Default: Story = {};


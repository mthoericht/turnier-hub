import type { Meta, StoryObj } from "@storybook/vue3-vite";
import PlayersViewPreset from "@/views/PlayersViewPreset.vue";

const meta: Meta<typeof PlayersViewPreset> = {
  title: "Views/PlayersViewPreset",
  component: PlayersViewPreset,
};

export default meta;

type Story = StoryObj<typeof PlayersViewPreset>;

export const Default: Story = {
  parameters: {
    route: "/players",
  },
};


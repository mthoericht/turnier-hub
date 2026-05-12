import type { Meta, StoryObj } from "@storybook/vue3-vite";
import TournamentsList from "@/components/tournaments/TournamentsList.vue";

const meta: Meta<typeof TournamentsList> = {
  title: "Components/Tournaments/TournamentsList",
  component: TournamentsList,
  args: {
    loading: false,
    list: [
      {
        id: "t1",
        name: "Sommerturnier 7a",
        sport: "Fußball",
        mode: "GROUP_KO",
        phase: "GROUP",
        createdBy: {
          subject: "demo",
        },
        _count: { teams: 6, matches: 10 },
      },
    ],
    remove: async (_id: string) => {},
  },
};

export default meta;

type Story = StoryObj<typeof TournamentsList>;

export const Default: Story = {
  parameters: {
    route: "/tournaments",
  },
};


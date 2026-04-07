import type { Meta, StoryObj } from "@storybook/vue3-vite";
import TournamentsListItem from "@/components/tournaments/TournamentsListItem.vue";

const tournament = {
  id: "t1",
  name: "Sommerturnier 7a",
  sport: "Fußball",
  mode: "GROUP_KO",
  phase: "GROUP",
  createdBy: { id: "u1", username: "demo", email: "demo@example.com" },
  _count: { teams: 6, matches: 10 },
};

const meta: Meta<typeof TournamentsListItem> = {
  title: "Components/Tournaments/TournamentsListItem",
  component: TournamentsListItem,
  args: {
    t: tournament as any,
    remove: async (_id: string) => {},
  },
};

export default meta;

type Story = StoryObj<typeof TournamentsListItem>;

export const Default: Story = {
  parameters: {
    route: "/tournaments",
  },
  render: (args) => ({
    components: { TournamentsListItem },
    setup()
    {
      return { args };
    },
    template: `
      <ul class="m-0 list-none space-y-2 p-0">
        <TournamentsListItem v-bind="args" />
      </ul>
    `,
  }),
};


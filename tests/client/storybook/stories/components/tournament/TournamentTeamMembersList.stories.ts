import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { fn } from "storybook/test";
import TournamentTeamMembersList from "@/components/tournament/TournamentTeamMembersList.vue";
import { demoTeamEmpty, demoTeamWithMembers } from "../../fixtures/rosterStoryHelpers";

const onRemoveMember = fn();

const meta: Meta<typeof TournamentTeamMembersList> = {
  title: "Components/Tournament/TournamentTeamMembersList",
  component: TournamentTeamMembersList,
};

export default meta;

type Story = StoryObj<typeof TournamentTeamMembersList>;

export const MitSpielern: Story = {
  args: {
    team: demoTeamWithMembers,
    canEdit: true,
    showCreator: false,
  },
  render: (args) => ({
    components: { TournamentTeamMembersList },
    setup()
    {
      return { args, onRemoveMember };
    },
    template: `
      <div class="max-w-md rounded-lg border border-slate-200 p-4">
        <TournamentTeamMembersList
          v-bind="args"
          @remove-member="onRemoveMember"
        />
      </div>
    `,
  }),
};

export const Leer: Story = {
  args: {
    team: demoTeamEmpty,
    canEdit: true,
  },
  render: (args) => ({
    components: { TournamentTeamMembersList },
    setup()
    {
      return { args, onRemoveMember };
    },
    template: `
      <div class="max-w-md rounded-lg border border-slate-200 p-4">
        <TournamentTeamMembersList v-bind="args" @remove-member="onRemoveMember" />
      </div>
    `,
  }),
};

export const NurLesen: Story = {
  args: {
    team: demoTeamWithMembers,
    canEdit: false,
  },
  render: (args) => ({
    components: { TournamentTeamMembersList },
    setup()
    {
      return { args, onRemoveMember };
    },
    template: `
      <div class="max-w-md rounded-lg border border-slate-200 p-4">
        <TournamentTeamMembersList v-bind="args" @remove-member="onRemoveMember" />
      </div>
    `,
  }),
};

import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { fn } from "storybook/test";
import { ref } from "vue";
import TournamentAddMemberSection from "@/components/tournament/TournamentAddMemberSection.vue";
import { demoPlayers, demoTeamWithMembers } from "../../fixtures/rosterStoryHelpers";

const fieldClass = "ui-input w-full max-w-md";

const meta: Meta<typeof TournamentAddMemberSection> = {
  title: "Tournament/TournamentAddMemberSection",
  component: TournamentAddMemberSection,
  args: {
    mode: "participant",
    availablePlayers: demoPlayers,
    hasGroups: false,
    groupOptions: [],
    selectableTeams: [],
    fieldClass,
    onAdd: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof TournamentAddMemberSection>;

export const TeilnehmerModus: Story = {
  render: (args) => ({
    components: { TournamentAddMemberSection },
    setup()
    {
      const selectedClassId = ref("");
      const selectedGroupLabel = ref("");
      const selectedTeamId = ref("");
      const selectedPlayerId = ref("");
      return { args, selectedClassId, selectedGroupLabel, selectedTeamId, selectedPlayerId };
    },
    template: `
      <div class="max-w-lg p-4">
        <TournamentAddMemberSection
          v-bind="args"
          v-model:selected-class-id="selectedClassId"
          v-model:selected-group-label="selectedGroupLabel"
          v-model:selected-team-id="selectedTeamId"
          v-model:selected-player-id="selectedPlayerId"
          @add="args.onAdd"
        />
      </div>
    `,
  }),
};

export const KaderModusMitGruppen: Story = {
  args: {
    mode: "member",
    hasGroups: true,
    groupOptions: ["A", "B"],
    selectableTeams: [demoTeamWithMembers],
  },
  render: (args) => ({
    components: { TournamentAddMemberSection },
    setup()
    {
      const selectedClassId = ref("");
      const selectedGroupLabel = ref("A");
      const selectedTeamId = ref(demoTeamWithMembers.id);
      const selectedPlayerId = ref("");
      return { args, selectedClassId, selectedGroupLabel, selectedTeamId, selectedPlayerId };
    },
    template: `
      <div class="max-w-lg p-4">
        <TournamentAddMemberSection
          v-bind="args"
          v-model:selected-class-id="selectedClassId"
          v-model:selected-group-label="selectedGroupLabel"
          v-model:selected-team-id="selectedTeamId"
          v-model:selected-player-id="selectedPlayerId"
          @add="args.onAdd"
        />
      </div>
    `,
  }),
};

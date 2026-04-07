import type { Meta, StoryObj } from "@storybook/vue3-vite";
import TournamentPhaseStepper from "@/components/tournament/TournamentPhaseStepper.vue";
import { formatPhaseLabel } from "@/tournament/tournamentFormat";
import {
  phaseFlowForMode,
  phaseStepState,
} from "@/tournament/tournamentPhaseFlow";

const meta: Meta<typeof TournamentPhaseStepper> = {
  title: "Components/Tournament/TournamentPhaseStepper",
  component: TournamentPhaseStepper,
};

export default meta;

type Story = StoryObj<typeof TournamentPhaseStepper>;

export const GroupKoInGruppenphase: Story = {
  parameters: {
    route: { name: "tournament-matches-setup", params: { id: "demo-tournament" } },
  },
  render: () => ({
    components: { TournamentPhaseStepper },
    setup()
    {
      const mode = "GROUP_KO" as const;
      const phaseFlow = phaseFlowForMode(mode);
      const currentIdx = 0;
      return {
        phaseFlow,
        stepState: (i: number) => phaseStepState(i, currentIdx),
        tournamentId: "demo-tournament",
        tournamentPhase: "GROUP",
        mode,
        canEdit: true,
        cardClass: "ui-card p-4 max-w-3xl",
        formatPhaseLabel,
      };
    },
    template: `
      <div class="p-4">
        <TournamentPhaseStepper
          :phase-flow="phaseFlow"
          :step-state="stepState"
          :tournament-id="tournamentId"
          :tournament-phase="tournamentPhase"
          :mode="mode"
          :can-edit="canEdit"
          :card-class="cardClass"
          :format-phase-label="formatPhaseLabel"
        />
      </div>
    `,
  }),
};

export const GroupKoKnockoutAktiv: Story = {
  parameters: {
    route: { name: "tournament-matches-setup", params: { id: "demo-tournament" } },
  },
  render: () => ({
    components: { TournamentPhaseStepper },
    setup()
    {
      const mode = "GROUP_KO" as const;
      const phaseFlow = phaseFlowForMode(mode);
      const currentIdx = 1;
      return {
        phaseFlow,
        stepState: (i: number) => phaseStepState(i, currentIdx),
        tournamentId: "demo-tournament",
        tournamentPhase: "QUARTER",
        mode,
        canEdit: true,
        cardClass: "ui-card p-4 max-w-3xl",
        formatPhaseLabel,
      };
    },
    template: `
      <div class="p-4">
        <TournamentPhaseStepper
          :phase-flow="phaseFlow"
          :step-state="stepState"
          :tournament-id="tournamentId"
          :tournament-phase="tournamentPhase"
          :mode="mode"
          :can-edit="canEdit"
          :card-class="cardClass"
          :format-phase-label="formatPhaseLabel"
        />
      </div>
    `,
  }),
};

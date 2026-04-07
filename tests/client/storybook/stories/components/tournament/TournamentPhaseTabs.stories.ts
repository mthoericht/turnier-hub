import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { ref } from "vue";
import TournamentPhaseTabs from "@/components/tournament/TournamentPhaseTabs.vue";
import { formatPhaseLabel } from "@/tournament/tournamentFormat";

const meta: Meta<typeof TournamentPhaseTabs> = {
  title: "Components/Tournament/TournamentPhaseTabs",
  component: TournamentPhaseTabs,
  args: {
    mode: "GROUP_KO",
    hasGroupMatches: true,
    hasR16Matches: true,
    hasQuarterMatches: true,
    hasSemiMatches: true,
    hasFinalMatches: true,
    formatPhaseLabel,
  },
};

export default meta;

type Story = StoryObj<typeof TournamentPhaseTabs>;

export const GroupKnockout: Story = {
  parameters: {
    route: { name: "tournament-matches-setup", params: { id: "demo-tournament" } },
  },
  render: (args) => ({
    components: { TournamentPhaseTabs },
    setup()
    {
      const modelValue = ref<"overview" | "group" | "r16" | "quarter" | "semi" | "final">(
        "group",
      );
      return { args, modelValue };
    },
    template: `
      <div class="p-4">
        <TournamentPhaseTabs v-bind="args" v-model="modelValue" />
        <p class="mt-2 text-xs text-slate-500">Aktiv: {{ modelValue }}</p>
      </div>
    `,
  }),
};

export const RoundRobin: Story = {
  parameters: {
    route: { name: "tournament-matches-setup", params: { id: "demo-tournament" } },
  },
  args: {
    mode: "ROUND_ROBIN",
    hasR16Matches: false,
    hasQuarterMatches: false,
    hasSemiMatches: false,
    hasFinalMatches: false,
  },
  render: (args) => ({
    components: { TournamentPhaseTabs },
    setup()
    {
      const modelValue = ref<"overview" | "group" | "r16" | "quarter" | "semi" | "final">(
        "group",
      );
      return { args, modelValue };
    },
    template: `
      <div class="p-4">
        <TournamentPhaseTabs v-bind="args" v-model="modelValue" />
      </div>
    `,
  }),
};

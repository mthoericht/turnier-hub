import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { fn } from "storybook/test";
import KnockoutStageActionList from "@/components/tournament/KnockoutStageActionList.vue";

const meta: Meta<typeof KnockoutStageActionList> = {
  title: "Components/Tournament/KnockoutStageActionList",
  component: KnockoutStageActionList,
  args: {
    canCreateR16: true,
    canCreateQuarter: true,
    canCreateSemi: true,
    canCreateFinal: true,
    hasR16Matches: false,
    isR16Current: false,
    r16HasScores: false,
    hasQuarterMatches: false,
    isQuarterCurrent: false,
    quarterHasScores: false,
    hasSemiMatches: false,
    isSemiCurrent: false,
    semiHasScores: false,
    hasFinalMatches: false,
    isFinalCurrent: false,
    finalHasScores: false,
    onAdvance: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof KnockoutStageActionList>;

export const AlleAktionenSichtbar: Story = {
  render: (args) => ({
    components: { KnockoutStageActionList },
    setup()
    {
      return { args };
    },
    template: `
      <div class="max-w-3xl p-4">
        <KnockoutStageActionList v-bind="args" @advance="args.onAdvance" />
      </div>
    `,
  }),
};

export const ViertelfinaleMitErgebnissen: Story = {
  args: {
    canCreateR16: false,
    canCreateQuarter: false,
    canCreateSemi: true,
    hasR16Matches: true,
    isR16Current: false,
    r16HasScores: true,
    hasQuarterMatches: true,
    isQuarterCurrent: true,
    quarterHasScores: true,
    hasSemiMatches: false,
    isSemiCurrent: false,
    semiHasScores: false,
    hasFinalMatches: false,
    isFinalCurrent: false,
    finalHasScores: false,
  },
  render: (args) => ({
    components: { KnockoutStageActionList },
    setup()
    {
      return { args };
    },
    template: `
      <div class="max-w-3xl p-4">
        <KnockoutStageActionList v-bind="args" @advance="args.onAdvance" />
      </div>
    `,
  }),
};

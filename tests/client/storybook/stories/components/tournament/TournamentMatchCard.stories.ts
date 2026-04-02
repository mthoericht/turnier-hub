import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { fn } from "storybook/test";
import TournamentMatchCard from "@/components/tournament/TournamentMatchCard.vue";
import {
  baseScheduledMatch,
  storyFormatMatchStatusLabel,
  storyFormatMs,
} from "../../fixtures/matchStoryHelpers";

const meta: Meta<typeof TournamentMatchCard> = {
  title: "Components/Tournament/TournamentMatchCard",
  component: TournamentMatchCard,
  args: {
    match: baseScheduledMatch,
    canEdit: true,
    draftHome: "0",
    draftAway: "0",
    matchCardClass: "ui-card p-4 max-w-xl",
    timerBtnClass:
      "rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100",
    fieldSmClass:
      "w-14 rounded border border-slate-300 px-2 py-1 text-center text-sm",
    formatMs: storyFormatMs,
    formatMatchStatusLabel: storyFormatMatchStatusLabel,
    onTimer: fn(),
    onSaveScore: fn(),
    onUpdateDraft: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof TournamentMatchCard>;

export const EditableScheduled: Story = {
  render: (args) => ({
    components: { TournamentMatchCard },
    setup()
    {
      return { args };
    },
    template: `
      <div class="p-4">
        <TournamentMatchCard
          v-bind="args"
          @timer="args.onTimer"
          @save-score="args.onSaveScore"
          @update-draft="args.onUpdateDraft"
        />
      </div>
    `,
  }),
};

export const FinishedReadonly: Story = {
  args: {
    canEdit: false,
    draftHome: "3",
    draftAway: "1",
    match: {
      ...baseScheduledMatch,
      status: "FINISHED",
      homeScore: 3,
      awayScore: 1,
    },
  },
  render: (args) => ({
    components: { TournamentMatchCard },
    setup()
    {
      return { args };
    },
    template: `
      <div class="p-4">
        <TournamentMatchCard
          v-bind="args"
          @timer="args.onTimer"
          @save-score="args.onSaveScore"
          @update-draft="args.onUpdateDraft"
        />
      </div>
    `,
  }),
};

export const Freilos: Story = {
  args: {
    match: {
      ...baseScheduledMatch,
      awayTeamId: null,
      awayTeam: null,
    },
  },
  render: (args) => ({
    components: { TournamentMatchCard },
    setup()
    {
      return { args };
    },
    template: `
      <div class="p-4">
        <TournamentMatchCard
          v-bind="args"
          @timer="args.onTimer"
          @save-score="args.onSaveScore"
          @update-draft="args.onUpdateDraft"
        />
      </div>
    `,
  }),
};

import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { fn } from "storybook/test";
import MatchTimer from "@/components/tournament/MatchTimer.vue";
import {
  baseScheduledMatch,
  storyFormatMs,
} from "../../fixtures/matchStoryHelpers";

const timerBtnClass =
  "rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100";

const meta: Meta<typeof MatchTimer> = {
  title: "Components/Tournament/MatchTimer",
  component: MatchTimer,
  args: {
    match: baseScheduledMatch,
    canEdit: true,
    timerBtnClass,
    formatMs: storyFormatMs,
    onTimer: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof MatchTimer>;

export const ScheduledEditable: Story = {
  render: (args) => ({
    components: { MatchTimer },
    setup()
    {
      return { args };
    },
    template: `
      <div class="max-w-md p-4 ui-card">
        <MatchTimer
          v-bind="args"
          @timer="args.onTimer"
        />
      </div>
    `,
  }),
};

export const LiveReadonly: Story = {
  args: {
    canEdit: false,
    match: {
      ...baseScheduledMatch,
      status: "LIVE",
      matchStartedAt: new Date().toISOString(),
      elapsedSnapshotMs: 125000,
    },
  },
  render: (args) => ({
    components: { MatchTimer },
    setup()
    {
      return { args };
    },
    template: `
      <div class="max-w-md p-4 ui-card">
        <MatchTimer v-bind="args" @timer="args.onTimer" />
      </div>
    `,
  }),
};

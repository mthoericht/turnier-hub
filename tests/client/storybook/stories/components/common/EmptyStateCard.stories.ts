import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { fn } from "storybook/test";
import AppIcon from "@/components/common/AppIcon.vue";
import EmptyStateCard from "@/components/common/EmptyStateCard.vue";

const meta: Meta<typeof EmptyStateCard> = {
  title: "Components/Common/EmptyStateCard",
  component: EmptyStateCard,
  args: {
    title: "Noch keine Daten vorhanden",
    actionLabel: "Aktion ausführen",
    actionDisabled: false,
    onAction: fn(),
  },
};

export default meta;

type Story = StoryObj<typeof EmptyStateCard>;

export const Default: Story = {
  render: (args) => ({
    components: { EmptyStateCard, AppIcon },
    setup()
    {
      return { args };
    },
    template: `
      <div class="p-8 bg-slate-50 min-h-[200px] flex items-center justify-center">
        <EmptyStateCard
          v-bind="args"
          @action="args.onAction"
        >
          <template #icon>
            <AppIcon name="trophy" class="mx-auto mb-4 h-12 w-12 text-slate-400" />
          </template>
        </EmptyStateCard>
      </div>
    `,
  }),
};

export const DisabledAction: Story = {
  args: {
    actionDisabled: true,
  },
  render: (args) => ({
    components: { EmptyStateCard, AppIcon },
    setup()
    {
      return { args };
    },
    template: `
      <div class="p-8 bg-slate-50 min-h-[200px] flex items-center justify-center">
        <EmptyStateCard v-bind="args" @action="args.onAction">
          <template #icon>
            <AppIcon name="calendar" class="mx-auto mb-4 h-12 w-12 text-slate-400" />
          </template>
        </EmptyStateCard>
      </div>
    `,
  }),
};

import type { Meta, StoryObj } from "@storybook/vue3-vite";
import AppIcon from "@/components/common/AppIcon.vue";
import DashboardCard from "@/components/dashboard/DashboardCard.vue";

const meta: Meta<typeof DashboardCard> = {
  title: "Components/Dashboard/DashboardCard",
  component: DashboardCard,
};

export default meta;

type Story = StoryObj<typeof DashboardCard>;

export const Klassen: Story = {
  args: {
    to: "/classes",
    title: "Klassen",
    value: 3,
    description: "Anzahl Klassen",
    pillClass:
      "rounded-full bg-blue-100 p-2 text-blue-700",
  },
  render: (args) => ({
    components: { DashboardCard, AppIcon },
    setup()
    {
      return { args };
    },
    template: `
      <div class="max-w-sm p-4">
        <DashboardCard v-bind="args">
          <template #icon>
            <AppIcon name="classes" class="h-6 w-6 text-blue-600" />
          </template>
        </DashboardCard>
      </div>
    `,
  }),
};

export const Turniere: Story = {
  args: {
    to: "/tournaments",
    title: "Turniere",
    value: 12,
    description: "Gesamt angelegt",
    pillClass:
      "rounded-full bg-emerald-100 p-2 text-emerald-800",
  },
  render: (args) => ({
    components: { DashboardCard, AppIcon },
    setup()
    {
      return { args };
    },
    template: `
      <div class="max-w-sm p-4">
        <DashboardCard v-bind="args">
          <template #icon>
            <AppIcon name="trophy" class="h-6 w-6 text-emerald-700" />
          </template>
        </DashboardCard>
      </div>
    `,
  }),
};

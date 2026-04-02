import type { Meta, StoryObj } from "@storybook/vue3-vite";
import AppIcon from "@/components/common/AppIcon.vue";

const iconNames = [
  "trophy",
  "classes",
  "players",
  "calendar",
  "sun",
  "moon",
  "menu",
  "close",
  "edit",
  "trash",
] as const;

const meta: Meta<typeof AppIcon> = {
  title: "Components/Common/AppIcon",
  component: AppIcon,
  argTypes: {
    name: { control: "select", options: [...iconNames] },
  },
  args: {
    name: "trophy",
    class: "h-10 w-10 text-slate-700",
  },
};

export default meta;

type Story = StoryObj<typeof AppIcon>;

/** Primary story; URL suffix `--default` matches Storybook / bookmarks. */
export const Default: Story = {};

export const AllIcons: Story = {
  render: () => ({
    components: { AppIcon },
    setup()
    {
      return { iconNames };
    },
    template: `
      <div class="flex flex-wrap gap-6 p-6 text-slate-800">
        <div v-for="n in iconNames" :key="n" class="flex flex-col items-center gap-2">
          <AppIcon :name="n" class="h-8 w-8" />
          <span class="text-xs">{{ n }}</span>
        </div>
      </div>
    `,
  }),
};

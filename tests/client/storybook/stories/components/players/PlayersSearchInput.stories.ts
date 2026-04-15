import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { ref } from "vue";
import PlayersSearchInput from "@/components/players/PlayersSearchInput.vue";

const meta: Meta<typeof PlayersSearchInput> = {
  title: "Components/Players/PlayersSearchInput",
  component: PlayersSearchInput,
  args: {
    modelValue: "",
    placeholder: "Vorname, Name oder Klasse",
  },
};

export default meta;

type Story = StoryObj<typeof PlayersSearchInput>;

export const Default: Story = {
  render: (args) => ({
    components: { PlayersSearchInput },
    setup()
    {
      const query = ref(args.modelValue ?? "");
      return { args, query };
    },
    template: `
      <div class="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6">
        <PlayersSearchInput
          v-model="query"
          :placeholder="args.placeholder"
        />
        <p class="mt-3 text-xs text-slate-600">
          Current value: <span class="font-mono">{{ query || "(empty)" }}</span>
        </p>
      </div>
    `,
  }),
};

export const Prefilled: Story = {
  args: {
    modelValue: "10a",
  },
  render: (args) => ({
    components: { PlayersSearchInput },
    setup()
    {
      const query = ref(args.modelValue ?? "");
      return { args, query };
    },
    template: `
      <div class="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6">
        <PlayersSearchInput
          v-model="query"
          :placeholder="args.placeholder"
        />
        <p class="mt-3 text-xs text-slate-600">
          Current value: <span class="font-mono">{{ query }}</span>
        </p>
      </div>
    `,
  }),
};

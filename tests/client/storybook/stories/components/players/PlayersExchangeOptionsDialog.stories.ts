import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { computed, ref } from "vue";
import PlayersExchangeOptionsDialog from "@/components/players/PlayersExchangeOptionsDialog.vue";
import type { PlayerImportMode } from "@/api/playersApi";

const meta: Meta<typeof PlayersExchangeOptionsDialog> = {
  title: "Components/Players/PlayersExchangeOptionsDialog",
  component: PlayersExchangeOptionsDialog,
};

export default meta;

type Story = StoryObj<typeof PlayersExchangeOptionsDialog>;

export const Default: Story = {
  render: () => ({
    components: { PlayersExchangeOptionsDialog },
    setup()
    {
      const open = ref(true);
      const mode = ref<PlayerImportMode>("append");
      const lastEvent = ref("none");
      const canReopen = computed(() => !open.value);

      function onSubmit(): void
      {
        lastEvent.value = `submit (${mode.value})`;
      }

      function onExport(): void
      {
        lastEvent.value = "export";
      }

      function onClose(): void
      {
        open.value = false;
        lastEvent.value = "close";
      }

      function reopen(): void
      {
        open.value = true;
      }

      return {
        open,
        mode,
        lastEvent,
        canReopen,
        onSubmit,
        onExport,
        onClose,
        reopen,
      };
    },
    template: `
      <div class="relative min-h-[34rem] w-full bg-slate-100 p-4">
        <button
          v-if="canReopen"
          type="button"
          class="ui-btn-secondary-blue"
          @click="reopen"
        >
          Dialog erneut öffnen
        </button>
        <p class="mb-4 mt-2 text-xs text-slate-600">
          Last event: <span class="font-mono">{{ lastEvent }}</span>
        </p>
        <PlayersExchangeOptionsDialog
          v-model="mode"
          :open="open"
          @close="onClose"
          @submit="onSubmit"
          @export="onExport"
        />
      </div>
    `,
  }),
};

export const ResetAllWarning: Story = {
  render: () => ({
    components: { PlayersExchangeOptionsDialog },
    setup()
    {
      const open = ref(true);
      const mode = ref<PlayerImportMode>("reset_all");
      return { open, mode };
    },
    template: `
      <div class="relative min-h-[34rem] w-full bg-slate-100 p-4">
        <PlayersExchangeOptionsDialog
          v-model="mode"
          :open="open"
          @close="open = false"
          @submit="() => undefined"
          @export="() => undefined"
        />
      </div>
    `,
  }),
};

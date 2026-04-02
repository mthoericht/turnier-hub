import type { Meta, StoryObj } from "@storybook/vue3-vite";
import { onBeforeUnmount, onMounted, ref } from "vue";
import GlobalTextPromptDialog from "@/components/common/GlobalTextPromptDialog.vue";
import { useTextPromptDialogStore } from "@/stores/textPromptDialog";

function resetTextPromptAfterStory(): void
{
  onBeforeUnmount(() =>
  {
    useTextPromptDialogStore().close();
  });
}

const meta: Meta<typeof GlobalTextPromptDialog> = {
  title: "Components/Common/GlobalTextPromptDialog",
  component: GlobalTextPromptDialog
};

export default meta;

type Story = StoryObj<typeof GlobalTextPromptDialog>;

/** Dialog sichtbar; URL-Suffix `--default` für Storybook / Lesezeichen. */
export const Default: Story = {
  render: () => ({
    components: { GlobalTextPromptDialog },
    setup()
    {
      resetTextPromptAfterStory();
      onMounted(() =>
      {
        const s = useTextPromptDialogStore();
        s.title = "Mannschaft umbenennen";
        s.description =
          "Neuer Anzeigename für die ausgewählte Mannschaft.";
        s.inputLabel = "Name";
        s.placeholder = "z. B. Team Blau";
        s.submitLabel = "Speichern";
        s.value = "Alte Kobras";
        s.open = true;
      });
      return {};
    },
    template: `
      <div class="relative min-h-[28rem] w-full bg-slate-100 p-4">
        <p class="mb-4 text-sm text-slate-600">
          Zustand kommt aus dem Pinia-Store (simuliert geöffneten Prompt).
        </p>
        <GlobalTextPromptDialog />
      </div>
    `,
  }),
};

/** Button ruft \`requestPrompt\` auf — zum manuellen Durchspielen des async-Flows. */
export const InteraktivOeffnen: Story = {
  render: () => ({
    components: { GlobalTextPromptDialog },
    setup()
    {
      resetTextPromptAfterStory();
      const lastResult = ref<string | null | undefined>(undefined);
      async function openPrompt(): Promise<void>
      {
        lastResult.value = await useTextPromptDialogStore().requestPrompt(
          {
            title: "Gruppe umbenennen",
            description: "Der neue Name erscheint in der Mannschaftsübersicht.",
            inputLabel: "Gruppenname",
            placeholder: "z. B. Gruppe A",
            initialValue: "",
            submitLabel: "Übernehmen",
          }
        );
      }
      return { openPrompt, lastResult };
    },
    template: `
      <div class="relative min-h-[28rem] w-full bg-slate-100 p-4 space-y-4">
        <button
          type="button"
          class="ui-btn-primary-blue"
          @click="openPrompt"
        >
          Text-Prompt öffnen
        </button>
        <p
          v-if="lastResult !== undefined"
          class="text-xs text-slate-600"
          data-testid="prompt-last-result"
        >
          Letztes Ergebnis:
          {{ lastResult === null ? "(abgebrochen)" : JSON.stringify(lastResult) }}
        </p>
        <GlobalTextPromptDialog />
      </div>
    `,
  }),
};

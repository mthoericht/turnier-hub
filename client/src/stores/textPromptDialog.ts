import { defineStore } from "pinia";
import { ref } from "vue";

export type TextPromptOptions = {
  title: string;
  description?: string;
  inputLabel: string;
  placeholder?: string;
  initialValue: string;
  submitLabel: string;
};

/**
 * Globaler Texteingabe-Dialog (Titel, Beschreibung, ein Zeilenfeld).
 *
 * - **UI:** `GlobalTextPromptDialog.vue`, gemountet in `App.vue`.
 * - **API:** `requestPrompt(opts)` → `Promise<string | null>` (Abbrechen / leer nach Trim → `null`).
 * - **Stories:** `tests/client/storybook/stories/components/common/GlobalTextPromptDialog.stories.ts`
 *
 * Wie beim globalen Bestätigungsdialog (`confirmDialog.ts`): nur eine Instanz gleichzeitig;
 * ein neuer Aufruf beendet einen noch offenen Prompt mit `null`.
 */
export const useTextPromptDialogStore = defineStore("textPromptDialog", () =>
{
  const open = ref(false);
  const title = ref("");
  const description = ref<string | undefined>(undefined);
  const inputLabel = ref("");
  const placeholder = ref<string | undefined>(undefined);
  const submitLabel = ref("Speichern");
  const value = ref("");

  let pendingResolve: ((value: string | null) => void) | null = null;

  function resolvePending(result: string | null): void
  {
    const resolve = pendingResolve;
    pendingResolve = null;
    open.value = false;
    resolve?.(result);
  }

  function close(): void
  {
    resolvePending(null);
  }

  function submit(): void
  {
    const next = value.value.trim();
    resolvePending(next ? next : null);
  }

  async function requestPrompt(opts: TextPromptOptions): Promise<string | null>
  {
    if (open.value)
    {
      pendingResolve?.(null);
      pendingResolve = null;
      open.value = false;
    }

    title.value = opts.title;
    description.value = opts.description;
    inputLabel.value = opts.inputLabel;
    placeholder.value = opts.placeholder;
    submitLabel.value = opts.submitLabel;
    value.value = opts.initialValue;

    return await new Promise<string | null>((resolve) =>
    {
      pendingResolve = resolve;
      open.value = true;
    });
  }

  return {
    open,
    title,
    description,
    inputLabel,
    placeholder,
    submitLabel,
    value,
    close,
    submit,
    requestPrompt,
  };
});

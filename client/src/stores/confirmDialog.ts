import { defineStore } from "pinia";
import { ref } from "vue";

export type ConfirmDialogActionOptions = {
  title: string;
  description?: string;
  submitLabel: string;
};

/**
 * Global bestätigungsdialog (nur Text + Fortfahren/Abbrechen).
 * Ein `EntityDialog` in `App.vue` bindet an diesen Store; Domain-Stores rufen
 * `requestConfirm` auf.
 */
export const useConfirmDialogStore = defineStore("confirmDialog", () =>
{
  const open = ref(false);
  const title = ref("");
  const description = ref<string | undefined>(undefined);
  const submitLabel = ref("Fortfahren");

  let pendingResolve: ((value: boolean) => void) | null = null;

  function resolvePending(value: boolean): void
  {
    const resolve = pendingResolve;
    pendingResolve = null;
    open.value = false;
    resolve?.(value);
  }

  function close(): void
  {
    resolvePending(false);
  }

  function submit(): void
  {
    resolvePending(true);
  }

  async function requestConfirm(
    opts: ConfirmDialogActionOptions
  ): Promise<boolean>
  {
    if (open.value)
    {
      pendingResolve?.(false);
      pendingResolve = null;
      open.value = false;
    }

    title.value = opts.title;
    description.value = opts.description;
    submitLabel.value = opts.submitLabel;

    return await new Promise<boolean>((resolve) =>
    {
      pendingResolve = resolve;
      open.value = true;
    });
  }

  return {
    open,
    title,
    description,
    submitLabel,
    close,
    submit,
    requestConfirm,
  };
});

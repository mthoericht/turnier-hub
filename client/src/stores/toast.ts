import { defineStore } from "pinia";
import { ref } from "vue";

export type ToastVariant = "error" | "success" | "info";

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

const DEFAULT_DURATION_MS: Record<ToastVariant, number> = {
  error: 12_000,
  success: 4000,
  info: 5000,
};

export const useToastStore = defineStore("toast", () => 
{
  const items = ref<ToastItem[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function dismiss(id: string): void 
  {
    const t = timers.get(id);
    if (t) clearTimeout(t);
    timers.delete(id);
    items.value = items.value.filter((x) => x.id !== id);
  }

  function push(
    message: string,
    options?: { variant?: ToastVariant; durationMs?: number | null }
  ): string 
  {
    const variant = options?.variant ?? "info";
    const id = crypto.randomUUID();
    items.value = [...items.value, { id, message, variant }];

    const rawDuration = options?.durationMs;
    const duration =
      rawDuration === undefined
        ? DEFAULT_DURATION_MS[variant]
        : rawDuration;

    if (duration != null && duration > 0) 
    {
      const timer = setTimeout(() => dismiss(id), duration);
      timers.set(id, timer);
    }
    return id;
  }

  function showError(
    message: string,
    durationMs?: number | null
  ): string 
  {
    return push(message, { variant: "error", durationMs });
  }

  function showSuccess(
    message: string,
    durationMs?: number | null
  ): string 
  {
    return push(message, { variant: "success", durationMs });
  }

  function showInfo(
    message: string,
    durationMs?: number | null
  ): string 
  {
    return push(message, { variant: "info", durationMs });
  }

  return { items, push, dismiss, showError, showSuccess, showInfo };
});

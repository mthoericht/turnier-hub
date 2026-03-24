<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useToastStore, type ToastVariant } from "@/stores/toast";

const toast = useToastStore();
const { items } = storeToRefs(toast);

function variantClass(variant: ToastVariant): string 
{
  if (variant === "error") 
  {
    return "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-50";
  }
  if (variant === "success") 
  {
    return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-50";
  }
  return "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
}
</script>

<template>
  <!-- Avoid Teleport + TransitionGroup: Vue can throw parentNode null while patching. -->
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-stretch gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:items-end sm:p-6"
    aria-label="Benachrichtigungen"
  >
    <TransitionGroup
      name="toast"
      tag="div"
      class="flex w-full flex-col gap-2 sm:max-w-md"
    >
      <div
        v-for="t in items"
        :key="t.id"
        :class="[
          'pointer-events-auto flex gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm',
          variantClass(t.variant),
        ]"
        :role="t.variant === 'error' ? 'alert' : 'status'"
      >
        <p class="min-w-0 flex-1 text-sm leading-snug">
          {{ t.message }}
        </p>
        <button
          type="button"
          class="shrink-0 rounded-lg p-1 text-current opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          aria-label="Meldung schließen"
          @click="toast.dismiss(t.id)"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-move,
.toast-enter-active,
.toast-leave-active 
{
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to 
{
  opacity: 0;
  transform: translateY(0.5rem);
}
</style>

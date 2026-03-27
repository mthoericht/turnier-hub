<script setup lang="ts">
defineProps<{
  open: boolean;
  title: string;
  description?: string;
  submitLabel: string;
  submitDisabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "submit"): void;
}>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-3"
    role="dialog"
    aria-modal="true"
    @click.self="emit('close')"
  >
    <div
      class="ui-card w-full max-w-md bg-white p-6 shadow-lg dark:bg-slate-950"
    >
      <div class="mb-4">
        <h2 class="font-display text-xl font-semibold text-slate-900 dark:text-white">
          {{ title }}
        </h2>
        <p v-if="description" class="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {{ description }}
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="emit('submit')">
        <slot />
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="ui-btn-secondary"
            @click="emit('close')"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            class="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600/90 disabled:opacity-50"
            :disabled="submitDisabled"
          >
            {{ submitLabel }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

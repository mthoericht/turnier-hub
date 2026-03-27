<script setup lang="ts">
defineProps<{
  title: string;
  actionLabel?: string;
  actionDisabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "action"): void;
}>();
</script>

<template>
  <div
    class="ui-empty-card"
  >
    <slot name="icon" />
    <p class="mb-4 text-slate-600 dark:text-slate-300">
      {{ title }}
    </p>
    <slot name="action">
      <button
        v-if="actionLabel"
        type="button"
        class="ui-btn-secondary inline-flex items-center justify-center px-5 py-3 disabled:opacity-50 dark:bg-slate-900/40"
        :disabled="actionDisabled"
        @click="emit('action')"
      >
        {{ actionLabel }}
      </button>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    /** `catalog`: list pages; `hero`: dashboard-sized title, no bottom margin (parent spacing). */
    variant?: "catalog" | "hero";
  }>(),
  { variant: "catalog" }
);

const rootClass = computed(() =>
  props.variant === "hero"
    ? "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    : "mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
);

const titleClass = computed(() =>
  props.variant === "hero"
    ? "font-display text-3xl font-bold text-slate-900 sm:text-4xl"
    : "font-display text-xl font-semibold text-slate-900 sm:text-2xl"
);
</script>

<template>
  <div :class="rootClass">
    <div class="min-w-0">
      <h1 :class="titleClass">
        {{ title }}
      </h1>
      <div
        v-if="$slots.description"
        class="mt-1 max-w-3xl"
      >
        <slot name="description" />
      </div>
    </div>
    <div
      v-if="$slots.actions"
      class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

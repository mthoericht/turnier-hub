<script setup lang="ts">
import { RouterLink } from "vue-router";

defineProps<{
  to: string;
  title: string;
  value: number;
  description: string;
  pillClass: string;
}>();
</script>

<template>
  <RouterLink :to="to" class="block">
    <div
      class="ui-card ui-card-hover cursor-pointer p-6"
    >
      <div class="flex items-center justify-between pb-2">
        <div class="text-sm font-medium text-slate-700 dark:text-slate-200">
          {{ title }}
        </div>
        <div :class="pillClass">
          <slot name="icon" />
        </div>
      </div>

      <div class="text-2xl font-bold text-slate-900 dark:text-white">
        {{ value }}
      </div>
      <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
        {{ description }}
      </p>
    </div>
  </RouterLink>
</template>


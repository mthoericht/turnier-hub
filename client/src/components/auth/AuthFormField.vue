<script setup lang="ts">
defineProps<{
  label: string;
  inputClass: string;
  helpText?: string;
}>();
</script>

<template>
  <div>
    <label class="mb-1 block text-sm text-slate-600 dark:text-slate-400">
      {{ label }}
    </label>
    <slot />
    <p v-if="helpText" class="mt-1 text-xs text-slate-500">
      {{ helpText }}
    </p>
  </div>
</template>

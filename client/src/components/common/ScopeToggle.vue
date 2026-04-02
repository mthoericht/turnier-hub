<script setup lang="ts">
type ScopeValue = "all" | "own";

const props = withDefaults(
  defineProps<{
    modelValue: ScopeValue;
    activeClass?: string;
  }>(),
  {
    activeClass: "bg-blue-600 text-white",
  }
);

const emit = defineEmits<{
  (e: "update:modelValue", value: ScopeValue): void;
}>();

const inactiveClass =
  "text-slate-600 hover:bg-slate-100";
</script>

<template>
  <div
    class="inline-flex rounded-lg border border-slate-200 p-0.5"
    role="group"
    aria-label="Ansicht"
  >
    <button
      type="button"
      :class="[
        'rounded-md px-3 py-2 text-sm font-medium transition sm:py-1.5',
        modelValue === 'all' ? props.activeClass : inactiveClass,
      ]"
      :aria-pressed="modelValue === 'all'"
      @click="emit('update:modelValue', 'all')"
    >
      Alle
    </button>
    <button
      type="button"
      :class="[
        'rounded-md px-3 py-2 text-sm font-medium transition sm:py-1.5',
        modelValue === 'own' ? props.activeClass : inactiveClass,
      ]"
      :aria-pressed="modelValue === 'own'"
      @click="emit('update:modelValue', 'own')"
    >
      Eigene
    </button>
  </div>
</template>

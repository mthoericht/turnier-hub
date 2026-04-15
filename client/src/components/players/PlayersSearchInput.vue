<script setup lang="ts">
type Props = {
  modelValue: string;
  placeholder?: string;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

function onInput(event: Event): void
{
  const target = event.target as HTMLInputElement;
  emit("update:modelValue", target.value);
}
</script>

<template>
  <label class="flex items-center gap-2 text-sm text-slate-600">
    <span class="shrink-0">Suche</span>
    <input
      type="search"
      :value="props.modelValue"
      :placeholder="props.placeholder ?? 'Vorname, Name oder Klasse'"
      class="ui-input-blue min-h-[44px] w-56 sm:min-h-0 sm:text-sm"
      @input="onInput"
    />
  </label>
</template>

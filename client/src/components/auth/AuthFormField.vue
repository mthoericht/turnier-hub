<script setup lang="ts">
import { computed, useId } from "vue";

const props = defineProps<{
  label: string;
  inputClass: string;
  helpText?: string;
}>();

const fieldId = useId();
const helpId = useId();

const describedBy = computed(() => (props.helpText ? helpId : undefined));
</script>

<template>
  <div>
    <label
      class="mb-1 block text-sm text-slate-600"
      :for="fieldId"
    >
      {{ label }}
    </label>
    <slot
      :field-id="fieldId"
      :described-by="describedBy"
    />
    <p
      v-if="helpText"
      :id="helpId"
      class="mt-1 text-xs text-slate-500"
    >
      {{ helpText }}
    </p>
  </div>
</template>

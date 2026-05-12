<script setup lang="ts">
import EntityDialog from "@/components/common/EntityDialog.vue";

const props = defineProps<{
  open: boolean;
  editingId: string | null;
  modelValue: string;
  inputClass: string;
}>();

defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "close"): void;
  (e: "submit"): void;
}>();
</script>

<template>
  <EntityDialog
    :open="open"
    :title="props.editingId ? 'Schule bearbeiten' : 'Schule anlegen'"
    :description="props.editingId ? 'Schulnamen aktualisieren' : 'Neue Schule hinzufügen'"
    :submit-label="props.editingId ? 'Speichern' : 'Anlegen'"
    @close="$emit('close')"
    @submit="$emit('submit')"
  >
    <div class="space-y-2">
      <label class="block text-sm font-medium text-slate-700" for="school-name">
        Schulname
      </label>
      <input
        id="school-name"
        :value="props.modelValue"
        :class="props.inputClass"
        required
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </EntityDialog>
</template>

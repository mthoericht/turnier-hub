<script setup lang="ts">
import type { PlayerImportMode } from "@/api/playersApi";
import EntityDialog from "@/components/common/EntityDialog.vue";

type Props = {
  open: boolean;
  modelValue: PlayerImportMode;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", value: PlayerImportMode): void;
  (e: "close"): void;
  (e: "submit"): void;
  (e: "export"): void;
}>();

const options: Array<{ value: PlayerImportMode; title: string; description: string }> = [
  {
    value: "reset_all",
    title: "Bisherige Spieler, Klassen und Turniere löschen",
    description: "Entfernt alle vorhandenen Spieler, Klassen und Turniere und importiert dann die Datei.",
  },
  {
    value: "append",
    title: "Spieler hinzufügen",
    description: "Fügt die Einträge aus der Datei zu den bestehenden Spielern hinzu.",
  },
  {
    value: "replace_players",
    title: "Spieler überschreiben",
    description: "Gleicht nach Vorname, Name und Klasse ab: nur nicht mehr enthaltene Spieler werden entfernt, fehlende Spieler werden ergänzt.",
  },
];
</script>

<template>
  <EntityDialog
    :open="props.open"
    title="Import/Export"
    description="Wähle aus, wie importiert oder exportiert werden soll."
    submit-label="Import starten"
    @close="emit('close')"
    @submit="emit('submit')"
  >
    <fieldset class="space-y-3">
      <legend class="sr-only">
        Importmodus
      </legend>
      <label
        v-for="option in options"
        :key="option.value"
        class="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
      >
        <input
          type="radio"
          name="players-import-mode"
          :value="option.value"
          :checked="props.modelValue === option.value"
          class="mt-1"
          @change="emit('update:modelValue', option.value)"
        />
        <span class="block">
          <span class="block text-sm font-medium text-slate-900">{{ option.title }}</span>
          <span class="block text-xs text-slate-600">{{ option.description }}</span>
        </span>
      </label>
    </fieldset>
    <p
      v-if="props.modelValue === 'reset_all'"
      class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"
      role="alert"
    >
      Achtung: Diese Option löscht bestehende Spieler, Klassen und Turniere. Dieser Schritt lässt sich nicht mehr rueckgängig machen!
    </p>

    <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <p class="text-sm font-medium text-slate-900">
        Aktuelle Spieler exportieren
      </p>
      <p class="mt-1 text-xs text-slate-600">
        Exportiert die vorhandenen Spieler als XLSX mit den Spalten Vorname, Name und Klasse.
      </p>
      <button
        type="button"
        class="mt-3 ui-btn-secondary-blue"
        @click="emit('export')"
      >
        XLSX exportieren
      </button>
    </div>
  </EntityDialog>
</template>

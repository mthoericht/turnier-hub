<script setup lang="ts">
import { computed } from "vue";
import type { Player } from "@/types";

const props = defineProps<{
  availablePlayers: Player[];
  selectedClassId: string;
  selectedPlayerId: string;
  fieldClass: string;
}>();

const emit = defineEmits<{
  "update:selectedClassId": [value: string];
  "update:selectedPlayerId": [value: string];
  add: [];
}>();

const classOptions = computed(() =>
{
  const map = new Map<string, string>();
  for (const p of props.availablePlayers)
  {
    if (p.schoolClass) map.set(p.schoolClass.id, p.schoolClass.name);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const filteredPlayers = computed(() =>
{
  if (!props.selectedClassId) return props.availablePlayers;
  return props.availablePlayers.filter((p) => p.schoolClass?.id === props.selectedClassId);
});

function playerLabel(p: Player): string
{
  return `${p.name}${p.schoolClass ? ` (${p.schoolClass.name})` : ""}`;
}

function onClassChange(value: string): void
{
  emit("update:selectedClassId", value);
  emit("update:selectedPlayerId", "");
}
</script>

<template>
  <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
    <div class="min-w-0 flex-1 sm:max-w-xs">
      <label class="mb-1 block text-xs text-slate-600 dark:text-slate-500">
        Klasse
      </label>
      <select
        :value="selectedClassId"
        :class="fieldClass"
        @change="onClassChange(($event.target as HTMLSelectElement).value)"
      >
        <option value="">Alle Klassen</option>
        <option
          v-for="c in classOptions"
          :key="c.id"
          :value="c.id"
        >
          {{ c.name }}
        </option>
      </select>
    </div>
    <div class="min-w-0 flex-1 sm:max-w-md">
      <label class="mb-1 block text-xs text-slate-600 dark:text-slate-500">
        Spieler als Teilnehmer hinzufügen
      </label>
      <select
        :value="selectedPlayerId"
        :class="fieldClass"
        @change="emit('update:selectedPlayerId', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">— Spieler wählen —</option>
        <option
          v-for="p in filteredPlayers"
          :key="p.id"
          :value="p.id"
        >
          {{ playerLabel(p) }}
        </option>
      </select>
    </div>
    <button
      type="button"
      class="min-h-[48px] rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-600/90 disabled:opacity-50 sm:min-h-0 sm:py-2 sm:text-sm"
      :disabled="!selectedPlayerId"
      @click="emit('add')"
    >
      Teilnehmer hinzufügen
    </button>
  </div>
</template>

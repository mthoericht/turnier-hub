<script setup lang="ts">
import { computed } from "vue";
import type { Player } from "@/types";
import type { TournamentTeam } from "@/tournament/tournamentContext";

const props = withDefaults(defineProps<{
  mode?: "participant" | "member";
  availablePlayers: Player[];
  selectedClassId?: string;
  selectedGroupLabel?: string;
  selectedTeamId?: string;
  hasGroups?: boolean;
  groupOptions?: string[];
  selectableTeams?: TournamentTeam[];
  selectedPlayerId: string;
  fieldClass: string;
}>(), {
  mode: "participant",
  selectedClassId: "",
  selectedGroupLabel: "",
  selectedTeamId: "",
  hasGroups: false,
  groupOptions: () => [],
  selectableTeams: () => [],
});

const emit = defineEmits<{
  "update:selectedClassId": [value: string];
  "update:selectedGroupLabel": [value: string];
  "update:selectedTeamId": [value: string];
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

const addDisabled = computed(() =>
{
  if (props.mode === "member")
  {
    return !props.selectedTeamId || !props.selectedPlayerId || props.selectableTeams.length === 0;
  }
  return !props.selectedPlayerId;
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
  <div
    :class="[
      props.mode === 'member'
        ? 'space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40'
        : '',
    ]"
  >
    <h3
      v-if="props.mode === 'member'"
      class="font-display font-semibold text-base text-slate-900 dark:text-white"
    >
      Spieler zur Mannschaft hinzufügen
    </h3>
    <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <div
        v-if="props.mode === 'member' && hasGroups && groupOptions.length > 0"
        class="min-w-0 flex-1 sm:max-w-xs"
      >
        <label class="mb-1 block text-xs text-slate-600 dark:text-slate-500">
          Gruppe
        </label>
        <select
          :value="selectedGroupLabel"
          :class="fieldClass"
          @change="emit('update:selectedGroupLabel', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">Alle Gruppen</option>
          <option
            v-for="g in groupOptions"
            :key="g"
            :value="g"
          >
            Gruppe {{ g }}
          </option>
        </select>
      </div>
      <div
        v-if="props.mode === 'member'"
        class="min-w-0 flex-1 sm:max-w-xs"
      >
        <label class="mb-1 block text-xs text-slate-600 dark:text-slate-500">
          Mannschaft
        </label>
        <select
          :value="selectedTeamId"
          :disabled="selectableTeams.length === 0"
          :class="fieldClass"
          @change="emit('update:selectedTeamId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>Wählen …</option>
          <option
            v-for="t in selectableTeams"
            :key="t.id"
            :value="t.id"
          >
            {{ t.name }}
          </option>
        </select>
      </div>
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
          {{ props.mode === "member" ? "Spieler" : "Spieler als Teilnehmer hinzufügen" }}
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
        class="ui-btn-primary-blue"
        :disabled="addDisabled"
        @click="emit('add')"
      >
        {{ props.mode === "member" ? "Hinzufügen" : "Teilnehmer hinzufügen" }}
      </button>
    </div>
  </div>
</template>

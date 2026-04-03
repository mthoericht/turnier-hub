<script setup lang="ts">
import { formatCreator } from "@/types";
import type { TournamentTeam } from "@/tournament/tournamentContext";

withDefaults(
  defineProps<{
    team: TournamentTeam;
    canEdit: boolean;
    showCreator?: boolean;
  }>(),
  {
    showCreator: false,
  }
);

const emit = defineEmits<{
  (e: "remove-member", teamId: string, playerId: string): void;
}>();
</script>

<template>
  <ul class="space-y-1 text-sm">
    <li
      v-for="mem in team.members"
      :key="mem.id"
      class="flex flex-wrap items-center justify-between gap-2"
    >
      <span class="text-slate-800">
        {{ mem.player.name
        }}<span
          v-if="mem.player.schoolClass"
          class="text-slate-500"
        >
          ({{ mem.player.schoolClass.name }})</span
        >
        <span
          v-if="showCreator"
          class="ml-2 text-xs text-slate-500"
          :title="mem.player.createdBy.email"
        >
          · {{ formatCreator(mem.player.createdBy) }}
        </span>
      </span>
      <button
        v-if="canEdit"
        type="button"
        class="text-xs font-medium text-rose-800 underline decoration-rose-800/80 underline-offset-2 hover:text-rose-900"
        @click="emit('remove-member', team.id, mem.playerId)"
      >
        Entfernen
      </button>
    </li>
    <li
      v-if="team.members.length === 0"
      class="text-slate-500"
    >
      Noch keine Spieler
    </li>
  </ul>
</template>

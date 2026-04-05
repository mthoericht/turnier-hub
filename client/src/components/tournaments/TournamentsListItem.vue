<script setup lang="ts">
import { RouterLink } from "vue-router";
import { formatCreator } from "@turnier-hub/shared";
import { formatTournamentMode } from "@/tournament/tournamentFormat";
import type { TournamentListRow } from "@/api/tournamentsApi";

defineProps<{
  t: TournamentListRow;
  remove: (id: string) => Promise<void>;
}>();
</script>

<template>
  <li
    class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
  >
    <div>
      <RouterLink
        :to="{ name: 'tournament-roster', params: { id: t.id } }"
        class="font-medium text-blue-800 hover:underline"
      >
        {{ t.name }}
      </RouterLink>
      <p class="text-sm text-slate-500">
        {{ t.sport }} · {{ formatTournamentMode(t.mode) }} · {{
          t._count.teams
        }}
        Mannschaften, {{ t._count.matches }} Spiele
      </p>
      <p
        class="mt-1 text-xs text-slate-500"
        :title="t.createdBy.email"
      >
        Von {{ formatCreator(t.createdBy) }}
      </p>
    </div>

    <div class="flex gap-3 text-sm shrink-0">
      <RouterLink
        :to="{ name: 'tournament-roster', params: { id: t.id } }"
        class="text-slate-600 hover:text-slate-900"
      >
        Öffnen
      </RouterLink>
      <button
        type="button"
        class="ui-link-danger"
        @click="() => void remove(t.id)"
      >
        Löschen
      </button>
    </div>
  </li>
</template>


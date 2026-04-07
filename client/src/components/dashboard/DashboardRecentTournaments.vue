<script setup lang="ts">
import { RouterLink } from "vue-router";
import { formatPhaseLabel } from "@/tournament/tournamentFormat";
import type { TournamentListRow } from "@/api/tournamentsApi";
import type { TournamentStatus } from "@/stores/dashboard";
import AppIcon from "@/components/common/AppIcon.vue";
import EmptyStateCard from "@/components/common/EmptyStateCard.vue";

defineProps<{
  tournaments: TournamentListRow[];
  activeTournamentsCount: number;
  getTournamentStatus: (t: TournamentListRow) => TournamentStatus;
  tournamentPillClass: (status: TournamentStatus) => string;
}>();
</script>

<template>
  <div class="ui-card space-y-4 p-6">
    <div>
      <h2 class="font-display text-lg font-semibold text-slate-900">
        Aktuelle Turniere
      </h2>
      <p class="text-sm text-slate-600 mt-1">
        {{
          activeTournamentsCount > 0
            ? `Laufende und bevorstehende Turniere`
            : "Keine aktiven Turniere"
        }}
      </p>
    </div>

    <EmptyStateCard
      v-if="tournaments.length === 0"
      title="Noch keine Turniere erstellt"
    >
      <template #icon>
        <AppIcon name="trophy" class="mx-auto mb-4 h-12 w-12 text-slate-400" />
      </template>
      <template #action>
        <RouterLink
          to="/tournaments"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Erstes Turnier erstellen
        </RouterLink>
      </template>
    </EmptyStateCard>

    <ul v-else class="m-0 list-none space-y-3 p-0">
      <li
        v-for="t in tournaments"
        :key="t.id"
      >
        <RouterLink
          :to="{ name: 'tournament-roster', params: { id: t.id } }"
          class="block rounded-xl transition-colors"
        >
          <div
            class="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50"
          >
            <div class="flex items-center gap-4 min-w-0">
              <div
                :class="[
                  'p-2 rounded-full',
                  tournamentPillClass(getTournamentStatus(t)),
                ]"
              >
                <AppIcon name="trophy" class="h-5 w-5" />
              </div>
              <div class="min-w-0">
                <p class="font-medium text-slate-900 truncate">
                  {{ t.name }}
                </p>
                <p class="text-sm text-slate-600 truncate">
                  {{ t.sport }} · {{ formatPhaseLabel(t.phase) }}
                </p>
              </div>
            </div>
            <span
              :class="[
                'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap',
                tournamentPillClass(getTournamentStatus(t)),
              ]"
            >
              {{
                getTournamentStatus(t) === 'ongoing'
                  ? 'Laufend'
                  : getTournamentStatus(t) === 'completed'
                    ? 'Beendet'
                    : 'Bevorstehend'
              }}
            </span>
          </div>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

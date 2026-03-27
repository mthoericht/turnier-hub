<script setup lang="ts">
import { RouterLink } from "vue-router";
import { useDashboardState } from "@/composables/dashboard/useDashboardState";
import { formatPhaseLabel } from "@/tournament/tournamentFormat";
import DashboardCard from "@/components/dashboard/DashboardCard.vue";
import AppIcon from "@/components/common/AppIcon.vue";
import EmptyStateCard from "@/components/common/EmptyStateCard.vue";

const {
  auth,
  loading,
  error,
  classesCount,
  playersCount,
  tournamentsCount,
  activeTournamentsCount,
  recentTournaments,
  getTournamentStatus,
  tournamentPillClass,
} = useDashboardState();
</script>

<template>
  <div v-if="auth.user" class="space-y-8">
    <div class="flex justify-between items-center gap-4">
      <div class="min-w-0">
        <h1
          class="font-display text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl"
        >
          Dashboard
        </h1>
        <p class="text-slate-600 dark:text-slate-400 mt-1">
          Übersicht über Klassen, Spieler und deine Turniere
        </p>
      </div>
      <RouterLink to="/tournaments" class="shrink-0">
        <button
          type="button"
          class="ui-btn-primary-blue inline-flex items-center gap-2 px-5 py-3"
        >
          Neues Turnier
        </button>
      </RouterLink>
    </div>

    <div v-if="loading" class="text-slate-500">Lade …</div>
    <div v-else>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardCard
          to="/classes"
          title="Klassen"
          :value="classesCount"
          description="Registrierte Klassen"
          pill-class="p-2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300"
        >
          <template #icon>
            <AppIcon name="classes" class="h-4 w-4" />
          </template>
        </DashboardCard>

        <DashboardCard
          to="/players"
          title="Spieler"
          :value="playersCount"
          description="Registrierte Spieler"
          pill-class="p-2 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
        >
          <template #icon>
            <AppIcon name="players" class="h-4 w-4" />
          </template>
        </DashboardCard>

        <DashboardCard
          to="/tournaments"
          title="Turniere"
          :value="tournamentsCount"
          :description="`${activeTournamentsCount} aktiv`"
          pill-class="p-2 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300"
        >
          <template #icon>
            <AppIcon name="trophy" class="h-4 w-4" />
          </template>
        </DashboardCard>
      </div>

      <div
        class="ui-card space-y-4 p-6"
      >
        <div>
          <h2 class="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Aktuelle Turniere
          </h2>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {{
              activeTournamentsCount > 0
                ? `Laufende und bevorstehende Turniere`
                : "Keine aktiven Turniere"
            }}
          </p>
        </div>

        <EmptyStateCard v-if="recentTournaments.length === 0" title="Noch keine Turniere erstellt">
          <template #icon>
            <AppIcon name="trophy" class="mx-auto mb-4 h-12 w-12 text-slate-400" />
          </template>
          <template #action>
            <RouterLink to="/tournaments">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Erstes Turnier erstellen
              </button>
            </RouterLink>
          </template>
        </EmptyStateCard>

        <div v-else class="space-y-3">
          <RouterLink
            v-for="t in recentTournaments"
            :key="t.id"
            :to="{ name: 'tournament-roster', params: { id: t.id } }"
          >
            <div
              class="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors dark:border-slate-800 dark:hover:bg-slate-800/30"
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
                  <p class="font-medium text-slate-900 dark:text-white truncate">
                    {{ t.name }}
                  </p>
                  <p class="text-sm text-slate-600 dark:text-slate-400 truncate">
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
        </div>
      </div>

      <p v-if="error" class="text-rose-600 dark:text-rose-400 text-sm">
        {{ error }}
      </p>
    </div>
  </div>

  <div
    v-else
    class="max-w-md rounded-2xl border border-slate-200 bg-white/60 p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900/40"
  >
    <p class="text-slate-700 mb-4 dark:text-slate-300">
      Melde dich an oder registriere dich mit dem Einladungscode.
    </p>
    <div class="flex flex-col gap-2 sm:flex-row sm:gap-3">
      <RouterLink
        to="/login"
        class="rounded-lg border border-slate-300 px-4 py-3 text-center text-slate-800 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 sm:py-2"
      >
        Login
      </RouterLink>
      <RouterLink
        to="/signup"
        class="rounded-lg bg-blue-600 px-4 py-3 text-center font-medium text-white transition hover:bg-blue-600/90 sm:py-2"
      >
        Registrieren
      </RouterLink>
    </div>
  </div>
</template>

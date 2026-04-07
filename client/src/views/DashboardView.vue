<script setup lang="ts">
import { RouterLink } from "vue-router";
import { useDashboardState } from "@/composables/dashboard/useDashboardState";
import DashboardCard from "@/components/dashboard/DashboardCard.vue";
import DashboardRecentTournaments from "@/components/dashboard/DashboardRecentTournaments.vue";
import CatalogPageHeader from "@/components/common/CatalogPageHeader.vue";
import AppIcon from "@/components/common/AppIcon.vue";

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
    <CatalogPageHeader title="Dashboard" variant="hero">
      <template #description>
        <p class="text-slate-600">
          Übersicht über Klassen, Spieler und deine Turniere
        </p>
      </template>
      <template #actions>
        <RouterLink
          to="/tournaments"
          class="ui-btn-primary-blue inline-flex shrink-0 items-center justify-center no-underline"
        >
          + Neues Turnier
        </RouterLink>
      </template>
    </CatalogPageHeader>

    <div v-if="loading" class="text-slate-500">Lade …</div>
    <div v-else>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardCard
          to="/classes"
          title="Klassen"
          :value="classesCount"
          description="Registrierte Klassen"
          pill-class="p-2 rounded-full bg-blue-100 text-blue-600"
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
          pill-class="p-2 rounded-full bg-emerald-100 text-emerald-700"
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
          pill-class="p-2 rounded-full bg-purple-100 text-purple-600"
        >
          <template #icon>
            <AppIcon name="trophy" class="h-4 w-4" />
          </template>
        </DashboardCard>
      </div>

      <DashboardRecentTournaments
        :tournaments="recentTournaments"
        :active-tournaments-count="activeTournamentsCount"
        :get-tournament-status="getTournamentStatus"
        :tournament-pill-class="tournamentPillClass"
      />

      <p
        v-if="error"
        class="text-sm text-rose-600"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
  </div>

  <div
    v-else
    class="max-w-md rounded-2xl border border-slate-200 bg-white/60 p-5 sm:p-6"
  >
    <p class="text-slate-700 mb-4">
      Melde dich an oder registriere dich mit dem Einladungscode.
    </p>
    <div class="flex flex-col gap-2 sm:flex-row sm:gap-3">
      <RouterLink
        to="/login"
        class="rounded-lg border border-slate-300 px-4 py-3 text-center text-slate-800 transition hover:bg-slate-100 sm:py-2"
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

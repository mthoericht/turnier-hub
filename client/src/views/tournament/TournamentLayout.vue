<script setup lang="ts">
import { computed, provide } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { tournamentLayoutKey } from "@/tournament/tournamentContext";
import {
  tournamentTabActiveClass,
  tournamentTabBaseClass,
  tournamentTabInactiveClass,
} from "@/tournament/tournamentUi";
import { useTournamentLayoutState } from "@/tournament/useTournamentLayoutState";
import { formatCreator } from "@/types";

const route = useRoute();
const tournamentId = computed(() => route.params.id as string);
const ctx = useTournamentLayoutState(tournamentId);
provide(tournamentLayoutKey, ctx);

const { tournament, loading, error, formatPhaseLabel } = ctx;
</script>

<template>
  <div v-if="loading" class="text-slate-500">Lade …</div>
  <div
    v-else-if="!tournament"
    class="text-rose-600 dark:text-rose-400"
  >
    {{ error || "Nicht gefunden" }}
  </div>
  <div v-else class="space-y-6 sm:space-y-8">
    <div class="min-w-0">
      <p class="mb-1 text-sm text-slate-500 dark:text-slate-500">
        <RouterLink
          to="/tournaments"
            class="text-blue-800 hover:underline dark:text-blue-100 dark:hover:text-blue-100"
          >Turniere</RouterLink
        >
        /
        <span class="break-words">{{ tournament.name }}</span>
      </p>
      <h1
        class="break-words font-display text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl"
      >
        {{ tournament.name }}
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-400 sm:text-base">
        {{ tournament.sport }} · Turnierphase:
          <span class="text-blue-800 dark:text-blue-100">{{
          formatPhaseLabel(tournament.phase)
        }}</span>
      </p>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Spiele laufen
        <strong class="font-medium">Mannschaft gegen Mannschaft</strong>.
        Mannschaften und Kader verwaltest du unter „Kader“.
      </p>
      <p
        class="mt-2 text-sm text-slate-500 dark:text-slate-500"
        :title="tournament.createdBy.email"
      >
        Erstellt von {{ formatCreator(tournament.createdBy) }}
      </p>
      <p
        v-if="!ctx.canEdit"
        class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100"
      >
        Nur-Lese-Ansicht — Steuerung und Bearbeiten nur für den Ersteller.
      </p>
    </div>

    <nav
      class="-mx-1 flex gap-4 border-b border-slate-200 px-1 dark:border-slate-800 sm:gap-8"
      aria-label="Turnier-Bereiche"
    >
      <RouterLink
        :to="{ name: 'tournament-roster', params: { id: tournamentId } }"
        :class="[
          tournamentTabBaseClass,
          route.name === 'tournament-roster'
            ? tournamentTabActiveClass
            : tournamentTabInactiveClass,
        ]"
      >
        Kader
      </RouterLink>
      <RouterLink
        :to="{ name: 'tournament-matches-overview', params: { id: tournamentId } }"
        :class="[
          tournamentTabBaseClass,
          route.name === 'tournament-matches-overview'
            || route.name === 'tournament-matches-setup'
            ? tournamentTabActiveClass
            : tournamentTabInactiveClass,
        ]"
      >
        Spiele
      </RouterLink>
    </nav>

    <RouterView />
  </div>
</template>

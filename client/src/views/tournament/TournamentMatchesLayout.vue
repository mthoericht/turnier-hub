<script setup lang="ts">
import { computed, inject } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import {
  tournamentTabActiveClass,
  tournamentTabBaseClass,
  tournamentTabInactiveClass,
} from "@/tournament/tournamentUi";
import { tournamentLayoutKey } from "@/tournament/tournamentContext";

const route = useRoute();
const tournamentId = computed(() => route.params.id as string);

const ctx = inject(tournamentLayoutKey);
if (!ctx) 
{
  throw new Error("TournamentMatchesLayout must be used inside TournamentLayout");
}

const { canEdit } = ctx;

const subTabClass = (name: string) =>
  [
    tournamentTabBaseClass,
    route.name === name
      ? tournamentTabActiveClass
      : tournamentTabInactiveClass,
    "!pb-2 !pt-1 !text-sm",
  ];
</script>

<template>
  <div class="space-y-4 sm:space-y-5">
    <nav
      class="-mx-1 flex flex-wrap gap-2 border-b border-slate-200 px-1 dark:border-slate-800 sm:gap-4"
      aria-label="Spiele-Untermenü"
    >
      <RouterLink
        :to="{ name: 'tournament-matches-overview', params: { id: tournamentId } }"
        :class="subTabClass('tournament-matches-overview')"
      >
        Übersicht
      </RouterLink>
      <RouterLink
        v-if="canEdit"
        :to="{ name: 'tournament-matches-setup', params: { id: tournamentId } }"
        :class="subTabClass('tournament-matches-setup')"
      >
        Spielbetrieb
      </RouterLink>
    </nav>
    <RouterView />
  </div>
</template>

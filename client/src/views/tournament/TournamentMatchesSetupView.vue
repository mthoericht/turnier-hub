<script setup lang="ts">
import { computed, inject } from "vue";
import { tournamentLayoutKey } from "@/tournament/tournamentContext";

const ctx = inject(tournamentLayoutKey);
if (!ctx) 
{
  throw new Error(
    "TournamentMatchesSetupView must be used inside TournamentLayout"
  );
}

const { tournament, canEdit, cardClass, matchesByPhase, generateGroup, advance } = ctx;

const hasGroupMatches = computed(() =>
  matchesByPhase.value.some((b) => b.phase === "GROUP" && b.matches.length > 0)
);

const hasQuarterMatches = computed(() =>
  matchesByPhase.value.some(
    (b) => b.phase === "QUARTER" && b.matches.length > 0
  )
);

const hasSemiMatches = computed(() =>
  matchesByPhase.value.some((b) => b.phase === "SEMI" && b.matches.length > 0)
);

const hasFinalMatches = computed(() =>
  matchesByPhase.value.some((b) => b.phase === "FINAL" && b.matches.length > 0)
);
</script>

<template>
  <div v-if="tournament" class="space-y-8 sm:space-y-10">
    <p
      v-if="!canEdit"
      class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100"
    >
      Nur der Ersteller kann Vorrunde und K.-o.-Runden anlegen.
    </p>
    <section v-if="canEdit" :class="[cardClass, 'space-y-6']">
      <h2
        class="font-display font-semibold text-lg text-slate-900 dark:text-white"
      >
        Spielbetrieb
      </h2>

      <div class="space-y-2">
        <h3
          class="text-sm font-medium text-slate-800 dark:text-slate-200"
        >
          1. Vorrunde
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-500">
          Erst Mannschaften unter „Kader“ anlegen, dann die Vorrunde erzeugen
          (alle gegen alle).
        </p>
        <button
          type="button"
          class="w-full rounded-lg bg-slate-200 px-4 py-3 text-left text-sm text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 sm:w-auto sm:py-2"
          @click="generateGroup"
        >
          Vorrunden-Spiele erzeugen (alle gegen alle)
        </button>
      </div>

      <div
        class="space-y-3 border-t border-slate-200 pt-6 dark:border-slate-800"
      >
        <h3
          class="text-sm font-medium text-slate-800 dark:text-slate-200"
        >
          2. K.-o.-Runden
        </h3>
        <p v-if="!hasGroupMatches" class="text-xs text-slate-500 dark:text-slate-500">
          Erzeuge zuerst die Vorrunde, damit die passenden Tabellenplätze für die
          K.-o.-Runden feststehen.
        </p>

        <template v-else>
          <p class="text-xs text-slate-500 dark:text-slate-500">
            Nur sinnvoll, wenn die Vorrunde (oder die vorherige Runde) weitgehend
            beendet ist — sonst fehlen Paarungen oder Tabellenplätze.
          </p>

          <p class="text-xs text-slate-500 dark:text-slate-500">
            Es werden nur Phasen angeboten, die noch nicht angelegt sind.
          </p>

          <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            v-if="!hasQuarterMatches"
            type="button"
            class="min-h-[44px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-left text-sm text-amber-950 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50 sm:min-h-0 sm:py-1.5"
            @click="advance('QUARTER')"
          >
            <span class="font-medium">Viertelfinale</span>
            <span class="block text-xs opacity-90">8 Mannschaften</span>
          </button>
          <button
            v-if="!hasSemiMatches"
            type="button"
            class="min-h-[44px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-left text-sm text-amber-950 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50 sm:min-h-0 sm:py-1.5"
            @click="advance('SEMI')"
          >
            <span class="font-medium">Halbfinale</span>
            <span class="block text-xs opacity-90">aus VF oder direkt</span>
          </button>
          <button
            v-if="!hasFinalMatches"
            type="button"
            class="min-h-[44px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-left text-sm text-amber-950 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50 sm:min-h-0 sm:py-1.5"
            @click="advance('FINAL')"
          >
            <span class="font-medium">Finale</span>
            <span class="block text-xs opacity-90">2 Teams</span>
          </button>
          </div>

          <p
            v-if="hasQuarterMatches && hasSemiMatches && hasFinalMatches"
            class="mt-3 text-xs text-slate-600 dark:text-slate-400"
          >
            K.-o.-Spiele sind bereits angelegt.
          </p>
        </template>
      </div>
    </section>
  </div>
</template>

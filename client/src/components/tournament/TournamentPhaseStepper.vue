<script setup lang="ts">
import { RouterLink } from "vue-router";
import type { MatchPhase } from "@/tournament/tournamentContext";
import type { PhaseFlowStep, PhaseStepState } from "@/tournament/tournamentPhaseFlow";

defineProps<{
  phaseFlow: PhaseFlowStep[];
  stepState: (index: number) => PhaseStepState;
  tournamentId: string;
  tournamentPhase: string;
  mode: "GROUP_KO" | "DIRECT_KO" | "ROUND_ROBIN";
  canEdit: boolean;
  cardClass: string;
  formatPhaseLabel: (phase: MatchPhase | string) => string;
}>();
</script>

<template>
  <section :class="[cardClass, '!py-4 sm:!py-5']">
    <h2
      class="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500"
    >
      Phasen
    </h2>
    <div
      class="flex flex-wrap items-stretch justify-center gap-2 sm:flex-nowrap sm:justify-between sm:gap-1"
    >
      <template v-for="(step, index) in phaseFlow" :key="step.phaseKey">
        <div
          class="flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center sm:min-w-0 sm:flex-[1_1_0] sm:px-3 sm:py-2"
          :class="{
            'border-emerald-500/70 bg-emerald-50/90':
              stepState(index) === 'done',
            'border-blue-600 bg-blue-50 shadow-sm':
              stepState(index) === 'current',
            'border-slate-200 bg-slate-50/50':
              stepState(index) === 'upcoming',
          }"
        >
          <span
            class="text-xs font-semibold sm:text-sm"
            :class="{
              'text-emerald-800':
                stepState(index) === 'done',
              'text-blue-900':
                stepState(index) === 'current',
              'text-slate-500':
                stepState(index) === 'upcoming',
            }"
          >
            {{ step.shortLabel }}
          </span>
          <span
            class="hidden text-[10px] leading-tight sm:block"
            :class="{
              'text-slate-700': stepState(index) === 'current',
              'text-emerald-900': stepState(index) === 'done',
              'text-slate-600': stepState(index) === 'upcoming',
            }"
          >
            {{ step.hint }}
          </span>
        </div>
        <span
          v-if="index < phaseFlow.length - 1"
          class="hidden shrink-0 self-center px-0.5 text-slate-300 sm:inline"
          aria-hidden="true"
          >→</span
        >
      </template>
    </div>
    <p class="mt-3 text-xs text-slate-500">
      Aktuell: <strong class="font-medium text-slate-700">{{
        formatPhaseLabel(tournamentPhase)
      }}</strong>
      <template v-if="mode !== 'ROUND_ROBIN'">
        — K.-o.-Runden erzeugen die nächsten Spiele aus den Tabellen bzw.
        Siegern der Vorstufe.
      </template>
      <template v-if="canEdit">
        Aktionen unter
        <RouterLink
          :to="{
            name: 'tournament-matches-setup',
            params: { id: tournamentId },
          }"
          class="text-blue-800 underline hover:no-underline"
          >Spielbetrieb</RouterLink
        >.</template
      >
    </p>
  </section>
</template>

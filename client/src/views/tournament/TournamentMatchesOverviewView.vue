<script setup lang="ts">
import { inject } from "vue";
import { RouterLink } from "vue-router";
import {
  tournamentLayoutKey,
  type MatchPhase,
  type StandingTeamRow,
} from "@/tournament/tournamentContext";
import { useTournamentPhaseStepper } from "@/tournament/useTournamentPhaseStepper";

const ctx = inject(tournamentLayoutKey);
if (!ctx) 
{
  throw new Error(
    "TournamentMatchesOverviewView must be used inside TournamentLayout"
  );
}

const {
  tournament,
  canEdit,
  standingsGroups,
  matchesByPhase,
  formatPhaseLabel,
  formatMatchStatusLabel,
  formatMs,
  scoreDraft,
  patchScores,
  timerAction,
  fieldSmClass,
  cardClass,
  matchCardClass,
  timerBtnClass,
} = ctx;

function isKnockoutPhase(phase: MatchPhase): boolean 
{
  return phase === "QUARTER" || phase === "SEMI" || phase === "FINAL";
}

const { phaseFlow, stepState } = useTournamentPhaseStepper(tournament);
</script>

<template>
  <div v-if="tournament" class="space-y-8 sm:space-y-10">
    <section :class="[cardClass, '!py-4 sm:!py-5']">
      <h2
        class="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
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
              'border-emerald-500/70 bg-emerald-50/90 dark:border-emerald-600/50 dark:bg-emerald-950/30':
                stepState(index) === 'done',
              'border-court-600 bg-court-50 shadow-sm dark:border-court-400 dark:bg-court-950/40':
                stepState(index) === 'current',
              'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/30':
                stepState(index) === 'upcoming',
            }"
          >
            <span
              class="text-xs font-semibold sm:text-sm"
              :class="{
                'text-emerald-800 dark:text-emerald-200':
                  stepState(index) === 'done',
                'text-court-900 dark:text-court-100':
                  stepState(index) === 'current',
                'text-slate-500 dark:text-slate-400':
                  stepState(index) === 'upcoming',
              }"
            >
              {{ step.shortLabel }}
            </span>
            <span
              class="hidden text-[10px] leading-tight text-slate-500 sm:block dark:text-slate-500"
            >
              {{ step.hint }}
            </span>
          </div>
          <span
            v-if="index < phaseFlow.length - 1"
            class="hidden shrink-0 self-center px-0.5 text-slate-300 dark:text-slate-600 sm:inline"
            aria-hidden="true"
            >→</span
          >
        </template>
      </div>
      <p class="mt-3 text-xs text-slate-500 dark:text-slate-500">
        Aktuell: <strong class="font-medium text-slate-700 dark:text-slate-300">{{
          formatPhaseLabel(tournament.phase)
        }}</strong>
        — K.-o.-Runden erzeugen die nächsten Spiele aus den Tabellen bzw.
        Siegern der Vorstufe.
        <template v-if="canEdit">
          Aktionen unter
          <RouterLink
            :to="{
              name: 'tournament-matches-setup',
              params: { id: tournament.id },
            }"
            class="text-court-800 underline hover:no-underline dark:text-court-100"
          >Spielbetrieb</RouterLink
          >.</template
        >
      </p>
    </section>

    <section
      v-if="Object.keys(standingsGroups).length"
      :class="[cardClass, 'space-y-4']"
    >
      <h2
        class="font-display font-semibold text-lg text-slate-900 dark:text-white"
      >
        Tabellen (Vorrunde)
      </h2>
      <div
        v-for="(rows, poolName) in standingsGroups"
        :key="poolName"
        class="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0"
      >
        <h3
          v-if="Object.keys(standingsGroups).length > 1"
          class="mb-2 text-sm text-court-800 dark:text-court-100"
        >
          {{ poolName }}
        </h3>
        <table
          class="w-full min-w-[18rem] text-left text-sm text-slate-900 dark:text-slate-100"
        >
          <thead>
            <tr
              class="border-b border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-500"
            >
              <th class="py-2 pr-4">#</th>
              <th class="py-2 pr-4">Mannschaft</th>
              <th class="py-2 pr-2">Sp</th>
              <th class="py-2 pr-2">S</th>
              <th class="py-2 pr-2">U</th>
              <th class="py-2 pr-2">N</th>
              <th class="py-2 pr-2">Tore</th>
              <th class="py-2">Pkt</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in rows as StandingTeamRow[]"
              :key="row.team.id"
              class="border-b border-slate-200/90 dark:border-slate-800/80"
            >
              <td class="py-2 pr-4 text-slate-500 dark:text-slate-500">
                {{ idx + 1 }}
              </td>
              <td class="py-2 pr-4 font-medium text-slate-900 dark:text-white">
                {{ row.team.name }}
              </td>
              <td class="py-2 pr-2">{{ row.played }}</td>
              <td class="py-2 pr-2">{{ row.wins }}</td>
              <td class="py-2 pr-2">{{ row.draws }}</td>
              <td class="py-2 pr-2">{{ row.losses }}</td>
              <td class="py-2 pr-2">{{ row.goalsFor }}:{{ row.goalsAgainst }}</td>
              <td
                class="py-2 font-medium text-court-800 dark:text-court-100"
              >
                {{ row.points }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-for="block in matchesByPhase"
      :key="block.phase"
      :class="[
        cardClass,
        'space-y-4',
        isKnockoutPhase(block.phase as MatchPhase)
          ? 'border-court-200/80 bg-court-50/40 dark:border-court-800/50 dark:bg-court-950/25'
          : '',
      ]"
    >
      <h2
        class="font-display font-semibold text-xl text-slate-900 dark:text-white"
      >
        {{ formatPhaseLabel(block.phase as MatchPhase) }}
      </h2>
      <p
        v-if="block.matches.length === 0"
        class="text-sm text-slate-600 dark:text-slate-400"
      >
        Noch keine Spiele für diese Runde.
      </p>
      <div
        v-for="m in block.matches"
        :key="m.id"
        :class="matchCardClass"
      >
        <div
          class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"
        >
          <div
            class="min-w-0 break-words font-medium text-slate-900 dark:text-white"
          >
            <span class="block sm:inline">{{
              m.homeTeam?.name ?? "—"
            }}</span>
            <span
              class="mx-0 my-1 block text-center text-slate-500 sm:mx-2 sm:my-0 sm:inline dark:text-slate-500"
              >vs</span
            >
            <span class="block sm:inline">{{
              m.awayTeam?.name ?? "—"
            }}</span>
          </div>
          <span
            class="w-fit shrink-0 rounded bg-slate-200 px-2 py-1 text-xs uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {{ formatMatchStatusLabel(m.status) }}
          </span>
        </div>
        <div
          class="font-mono text-3xl text-court-800 tabular-nums dark:text-court-100 sm:text-2xl"
        >
          {{ formatMs(m.elapsedMs) }}
        </div>
        <div
          class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2"
        >
          <button
            type="button"
            :class="[timerBtnClass, 'bg-emerald-700 hover:bg-emerald-600']"
            :disabled="
              !canEdit || (m.status !== 'SCHEDULED' && m.status !== 'CANCELLED')
            "
            @click="timerAction(m.id, 'start')"
          >
            Start
          </button>
          <button
            type="button"
            :class="[timerBtnClass, 'bg-amber-700 hover:bg-amber-600']"
            :disabled="!canEdit || m.status !== 'LIVE'"
            @click="timerAction(m.id, 'pause')"
          >
            Pause
          </button>
          <button
            type="button"
            :class="[timerBtnClass, 'bg-sky-700 hover:bg-sky-600']"
            :disabled="!canEdit || m.status !== 'PAUSED'"
            @click="timerAction(m.id, 'resume')"
          >
            Weiter
          </button>
          <button
            type="button"
            :class="[timerBtnClass, 'bg-slate-600 hover:bg-slate-500']"
            :disabled="
              !canEdit
                || (
                  m.status !== 'LIVE'
                  && m.status !== 'PAUSED'
                  && m.status !== 'SCHEDULED'
                )
            "
            @click="timerAction(m.id, 'end')"
          >
            Beenden
          </button>
          <button
            type="button"
            class="col-span-2 min-h-[44px] rounded-lg bg-rose-900/60 px-3 py-2.5 text-sm text-rose-100 hover:bg-rose-800 disabled:opacity-40 sm:col-span-1 sm:min-h-0 sm:py-1.5"
            :disabled="!canEdit"
            @click="timerAction(m.id, 'cancel')"
          >
            Abbrechen
          </button>
        </div>
        <div
          v-if="canEdit && scoreDraft[m.id]"
          class="flex flex-wrap items-center gap-2"
        >
          <span class="text-sm text-slate-600 dark:text-slate-500"
            >Ergebnis</span
          >
          <input
            v-model="scoreDraft[m.id].home"
            type="number"
            min="0"
            :class="fieldSmClass"
            placeholder="0"
          />
          <span class="text-slate-500 dark:text-slate-500">:</span>
          <input
            v-model="scoreDraft[m.id].away"
            type="number"
            min="0"
            :class="fieldSmClass"
            placeholder="0"
          />
          <button
            type="button"
            class="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 sm:min-h-0 sm:px-3 sm:py-1"
            @click="patchScores(m.id)"
          >
            Speichern
          </button>
        </div>
        <div
          v-else-if="canEdit"
          class="text-sm text-slate-600 dark:text-slate-400"
        >
          Ergebnis:
          <span class="ml-1 font-medium tabular-nums text-slate-900 dark:text-white">
            {{ m.homeScore ?? "—" }} : {{ m.awayScore ?? "—" }}
          </span>
        </div>
        <div v-else class="text-sm text-slate-600 dark:text-slate-400">
          Ergebnis:
          <span class="ml-1 font-medium tabular-nums text-slate-900 dark:text-white">
            {{ m.homeScore ?? "—" }} : {{ m.awayScore ?? "—" }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { MatchRow, MatchStatus } from "@/tournament/tournamentContext";

type TimerAction = "start" | "pause" | "resume" | "end" | "cancel";

defineProps<{
  match: MatchRow;
  canEdit: boolean;
  draftHome?: string;
  draftAway?: string;
  matchCardClass: string;
  timerBtnClass: string;
  fieldSmClass: string;
  formatMs: (ms: number) => string;
  formatMatchStatusLabel: (status: MatchStatus) => string;
}>();

const emit = defineEmits<{
  timer: [action: TimerAction];
  saveScore: [];
  updateDraft: [side: "home" | "away", value: string];
}>();

function groupLabelText(label: string | null | undefined): string
{
  return `Gruppe ${label ?? "-"}`;
}
</script>

<template>
  <div :class="matchCardClass">
    <div
      class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"
    >
      <div
        class="min-w-0 break-words font-medium text-slate-900 dark:text-white"
      >
        <span
          v-if="match.groupLabel"
          class="mr-0 mb-1 inline-flex rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 sm:mr-2 sm:mb-0 dark:bg-blue-900/40 dark:text-blue-200"
        >
          {{ groupLabelText(match.groupLabel) }}
        </span>
        <span class="block sm:inline">{{ match.homeTeam?.name ?? "—" }}</span>
        <span
          class="mx-0 my-1 block text-center text-slate-500 sm:mx-2 sm:my-0 sm:inline dark:text-slate-500"
          >vs</span
        >
        <span class="block sm:inline">{{ match.awayTeam?.name ?? "Freilos" }}</span>
      </div>
      <span
        class="w-fit shrink-0 rounded bg-slate-200 px-2 py-1 text-xs uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      >
        {{ formatMatchStatusLabel(match.status) }}
      </span>
    </div>
    <div
      class="font-mono text-3xl text-blue-800 tabular-nums dark:text-blue-100 sm:text-2xl"
    >
      {{ formatMs(match.elapsedMs) }}
    </div>
    <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2">
      <button
        type="button"
        :class="[timerBtnClass, 'bg-emerald-700 hover:bg-emerald-600']"
        :disabled="
          !canEdit || (match.status !== 'SCHEDULED' && match.status !== 'CANCELLED')
        "
        @click="emit('timer', 'start')"
      >
        Start
      </button>
      <button
        type="button"
        :class="[timerBtnClass, 'bg-amber-700 hover:bg-amber-600']"
        :disabled="!canEdit || match.status !== 'LIVE'"
        @click="emit('timer', 'pause')"
      >
        Pause
      </button>
      <button
        type="button"
        :class="[timerBtnClass, 'bg-sky-700 hover:bg-sky-600']"
        :disabled="!canEdit || match.status !== 'PAUSED'"
        @click="emit('timer', 'resume')"
      >
        Weiter
      </button>
      <button
        type="button"
        :class="[timerBtnClass, 'bg-slate-600 hover:bg-slate-500']"
        :disabled="
          !canEdit
            || (
              match.status !== 'LIVE'
              && match.status !== 'PAUSED'
              && match.status !== 'SCHEDULED'
            )
        "
        @click="emit('timer', 'end')"
      >
        Beenden
      </button>
      <button
        type="button"
        class="col-span-2 min-h-[44px] rounded-lg bg-rose-900/60 px-3 py-2.5 text-sm text-rose-100 hover:bg-rose-800 disabled:opacity-40 sm:col-span-1 sm:min-h-0 sm:py-1.5"
        :disabled="!canEdit"
        @click="emit('timer', 'cancel')"
      >
        Abbrechen
      </button>
    </div>
    <div
      v-if="canEdit && draftHome !== undefined && draftAway !== undefined"
      class="flex flex-wrap items-center gap-2"
    >
      <span class="text-sm text-slate-600 dark:text-slate-500">Ergebnis</span>
      <input
        :value="draftHome"
        type="number"
        min="0"
        :class="fieldSmClass"
        placeholder="0"
        @input="emit('updateDraft', 'home', ($event.target as HTMLInputElement).value)"
      />
      <span class="text-slate-500 dark:text-slate-500">:</span>
      <input
        :value="draftAway"
        type="number"
        min="0"
        :class="fieldSmClass"
        placeholder="0"
        @input="emit('updateDraft', 'away', ($event.target as HTMLInputElement).value)"
      />
      <button
        type="button"
        class="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 sm:min-h-0 sm:px-3 sm:py-1"
        @click="emit('saveScore')"
      >
        Speichern
      </button>
    </div>
    <div v-else class="text-sm text-slate-600 dark:text-slate-400">
      Ergebnis:
      <span class="ml-1 font-medium tabular-nums text-slate-900 dark:text-white">
        {{ match.homeScore ?? "—" }} : {{ match.awayScore ?? "—" }}
      </span>
    </div>
  </div>
</template>

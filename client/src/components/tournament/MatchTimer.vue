<script setup lang="ts">
import { useMatchTimerDisplay } from "@/composables/tournaments/useMatchTimerDisplay";
import type { MatchRow } from "@/tournament/tournamentContext";

export type MatchTimerAction =
  | "start"
  | "pause"
  | "resume"
  | "end"
  | "cancel";

const props = defineProps<{
  match: MatchRow;
  canEdit: boolean;
  timerBtnClass: string;
  formatMs: (ms: number) => string;
}>();

const emit = defineEmits<{
  timer: [action: MatchTimerAction];
}>();

const { displayElapsedMs } = useMatchTimerDisplay(() => props.match);
</script>

<template>
  <div>
    <div
      class="font-mono text-3xl text-blue-800 tabular-nums sm:text-2xl"
    >
      {{ formatMs(displayElapsedMs) }}
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
  </div>
</template>

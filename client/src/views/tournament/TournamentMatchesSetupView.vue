<script setup lang="ts">
import { computed, inject } from "vue";
import { tournamentLayoutKey } from "@/tournament/tournamentContext";
import KnockoutStageActionList from "@/components/tournament/KnockoutStageActionList.vue";

const ctx = inject(tournamentLayoutKey);
if (!ctx)
{
  throw new Error(
    "TournamentMatchesSetupView must be used inside TournamentLayout"
  );
}

const {
  tournament,
  canEdit,
  cardClass,
  fieldClass,
  groupCountInput,
  advancesInput,
  saveGroupCount,
  saveAdvances,
  matchesByPhase,
  generateGroup,
  generateKnockout,
  deleteAllMatches,
  advance,
} = ctx;

const mode = computed(() => tournament.value?.mode ?? "GROUP_KO");
const showGroupSection = computed(() => mode.value === "GROUP_KO" || mode.value === "ROUND_ROBIN");
const showKoSection = computed(() => mode.value === "GROUP_KO" || mode.value === "DIRECT_KO");

const hasGroupMatches = computed(() =>
  matchesByPhase.value.some((b) => b.phase === "GROUP" && b.matches.length > 0)
);

const hasR16Matches = computed(() =>
  matchesByPhase.value.some((b) => b.phase === "ROUND_OF_16" && b.matches.length > 0)
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

const currentTournamentPhase = computed(
  () => tournament.value?.phase ?? "GROUP"
);

const isR16Current = computed(
  () => currentTournamentPhase.value === "ROUND_OF_16"
);
const isQuarterCurrent = computed(
  () => currentTournamentPhase.value === "QUARTER"
);
const isSemiCurrent = computed(() => currentTournamentPhase.value === "SEMI");
const isFinalCurrent = computed(
  () => currentTournamentPhase.value === "FINAL"
);

const hasAnyKoMatches = computed(() =>
  hasR16Matches.value || hasQuarterMatches.value || hasSemiMatches.value || hasFinalMatches.value
);

const groupQualifierSlots = computed(() =>
{
  const t = tournament.value;
  if (!t) return 0;
  if (t.groupCount <= 1) return Math.min(t.teams.length, t.advancesPerGroup);
  const byGroup = new Map<string, number>();
  for (const team of t.teams)
  {
    const key = team.groupLabel ?? "UNGROUPED";
    byGroup.set(key, (byGroup.get(key) ?? 0) + 1);
  }
  let slots = 0;
  for (const count of byGroup.values())
  {
    slots += Math.min(count, t.advancesPerGroup);
  }
  return slots;
});

const r16MatchCount = computed(() =>
  matchesByPhase.value.find((b) => b.phase === "ROUND_OF_16")?.matches.length ?? 0
);
const r16HasScores = computed(() =>
  matchesByPhase.value
    .find((b) => b.phase === "ROUND_OF_16")
    ?.matches.some((m) => m.homeScore != null || m.awayScore != null) ?? false
);
const quarterMatchCount = computed(() =>
  matchesByPhase.value.find((b) => b.phase === "QUARTER")?.matches.length ?? 0
);
const quarterHasScores = computed(() =>
  matchesByPhase.value
    .find((b) => b.phase === "QUARTER")
    ?.matches.some((m) => m.homeScore != null || m.awayScore != null) ?? false
);
const semiMatchCount = computed(() =>
  matchesByPhase.value.find((b) => b.phase === "SEMI")?.matches.length ?? 0
);
const semiHasScores = computed(() =>
  matchesByPhase.value
    .find((b) => b.phase === "SEMI")
    ?.matches.some((m) => m.homeScore != null || m.awayScore != null) ?? false
);
const finalHasScores = computed(() =>
  matchesByPhase.value
    .find((b) => b.phase === "FINAL")
    ?.matches.some((m) => m.homeScore != null || m.awayScore != null) ?? false
);

const participantsForQuarter = computed(() =>
  hasR16Matches.value ? r16MatchCount.value : groupQualifierSlots.value
);
const participantsForSemi = computed(() =>
  hasQuarterMatches.value ? quarterMatchCount.value : participantsForQuarter.value
);
const participantsForFinal = computed(() =>
  hasSemiMatches.value ? semiMatchCount.value : participantsForSemi.value
);

const canCreateR16 = computed(() =>
  !hasQuarterMatches.value
  && !hasSemiMatches.value
  && !hasFinalMatches.value
  && (isR16Current.value
    || (!hasR16Matches.value && groupQualifierSlots.value >= 16))
);
const canCreateQuarter = computed(() =>
  isQuarterCurrent.value
  || (!hasQuarterMatches.value && participantsForQuarter.value >= 8)
);
const canCreateSemi = computed(() =>
  isSemiCurrent.value
  || (!hasSemiMatches.value && participantsForSemi.value >= 4)
);
const canCreateFinal = computed(() =>
  isFinalCurrent.value
  || (!hasFinalMatches.value && participantsForFinal.value >= 2)
);

const hasAnyMatches = computed(() =>
  hasGroupMatches.value || hasAnyKoMatches.value
);

const groupActionLabel = computed(() =>
  mode.value === "ROUND_ROBIN" ? "Spiele erzeugen (Jeder gegen Jeden)" : "Gruppenspiele erzeugen"
);

async function generateGroupWithCurrentSettings(): Promise<void>
{
  if (mode.value === "GROUP_KO")
  {
    await saveGroupCount();
  }
  await generateGroup();
}
</script>

<template>
  <div v-if="tournament" class="space-y-8 sm:space-y-10">
    <section v-if="canEdit" :class="[cardClass, 'space-y-6']">
      <h2
        class="font-display font-semibold text-lg text-slate-900"
      >
        Spielbetrieb
      </h2>

      <div v-if="showGroupSection" class="space-y-2">
        <h3
          class="text-sm font-medium text-slate-800"
        >
          {{ mode === 'ROUND_ROBIN' ? '1. Jeder gegen Jeden' : '1. Gruppenspiele' }}
        </h3>
        <p class="text-xs text-slate-500">
          Erst Mannschaften unter „Mannschaften" anlegen, dann die Spiele erzeugen.
          <template v-if="mode === 'GROUP_KO' && tournament.groupCount > 1">
            Mannschaften werden zufällig auf {{ tournament.groupCount }} Gruppen verteilt.
          </template>
          Spiele werden in parallele Spielrunden eingeteilt.
        </p>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div v-if="mode === 'GROUP_KO'" class="min-w-0 sm:w-44">
            <label class="mb-1 block text-xs text-slate-600">
              Anzahl Gruppen
            </label>
            <input
              v-model.number="groupCountInput"
              type="number"
              min="1"
              max="16"
              :class="fieldClass"
            />
          </div>
          <button
            type="button"
            class="w-full rounded-lg bg-slate-200 px-4 py-3 text-left text-sm text-slate-900 hover:bg-slate-300 sm:w-auto sm:py-2"
            @click="generateGroupWithCurrentSettings"
          >
            {{ groupActionLabel }}
          </button>
        </div>
      </div>

      <div v-if="mode === 'GROUP_KO'" class="space-y-3 border-t border-slate-200 pt-6">
        <h3 class="text-sm font-medium text-slate-800">
          Gruppen-Einstellungen
        </h3>
        <div class="sm:max-w-xs">
          <label class="mb-1 block text-xs text-slate-600">
            Weiterkommen pro Gruppe
          </label>
          <input
            v-model.number="advancesInput"
            type="number"
            min="1"
            max="8"
            :class="fieldClass"
          />
        </div>
        <button
          type="button"
          class="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
          @click="saveAdvances"
        >
          Einstellungen speichern
        </button>
      </div>

      <div v-if="mode === 'DIRECT_KO'" class="space-y-2">
        <h3
          class="text-sm font-medium text-slate-800"
        >
          1. K.O.-Runde erzeugen
        </h3>
        <p class="text-xs text-slate-500">
          Erst Mannschaften unter „Mannschaften" anlegen, dann die K.O.-Runde erzeugen.
          Bei ungerader Teamzahl erhalten die bestgesetzten Teams ein Freilos.
        </p>
        <button
          type="button"
          class="w-full rounded-lg bg-slate-200 px-4 py-3 text-left text-sm text-slate-900 hover:bg-slate-300 sm:w-auto sm:py-2"
          @click="generateKnockout"
        >
          K.O.-Runde erzeugen
        </button>
      </div>

      <div
        v-if="showKoSection && (hasGroupMatches || hasAnyKoMatches)"
        class="space-y-3 border-t border-slate-200 pt-6"
      >
        <h3
          class="text-sm font-medium text-slate-800"
        >
          {{ mode === 'DIRECT_KO' ? '2. Nächste K.O.-Runde' : '2. K.O.-Runden' }}
        </h3>

        <p v-if="!hasGroupMatches && !hasAnyKoMatches" class="text-xs text-slate-500">
          Erzeuge zuerst die Spiele, damit die passenden Tabellenplätze für die
          K.-o.-Runden feststehen.
        </p>

        <template v-else>
          <p class="text-xs text-slate-500">
            Nur sinnvoll, wenn die vorherige Runde beendet ist — sonst fehlen Paarungen.
          </p>

          <KnockoutStageActionList
            :can-create-r16="canCreateR16"
            :can-create-quarter="canCreateQuarter"
            :can-create-semi="canCreateSemi"
            :can-create-final="canCreateFinal"
            :has-r16-matches="hasR16Matches"
            :is-r16-current="isR16Current"
            :r16-has-scores="r16HasScores"
            :has-quarter-matches="hasQuarterMatches"
            :is-quarter-current="isQuarterCurrent"
            :quarter-has-scores="quarterHasScores"
            :has-semi-matches="hasSemiMatches"
            :is-semi-current="isSemiCurrent"
            :semi-has-scores="semiHasScores"
            :has-final-matches="hasFinalMatches"
            :is-final-current="isFinalCurrent"
            :final-has-scores="finalHasScores"
            @advance="advance"
          />

          <p
            v-if="!canCreateR16 && !canCreateQuarter && !canCreateSemi && !canCreateFinal"
            class="mt-3 text-xs text-slate-600"
          >
            Aktuell kann keine weitere K.-o.-Runde erzeugt werden
            (bereits angelegt oder zu wenige Mannschaften/Sieger).
          </p>
        </template>
      </div>

      <div
        v-if="mode === 'ROUND_ROBIN' && hasGroupMatches"
        class="space-y-3 border-t border-slate-200 pt-6"
      >
        <h3 class="text-sm font-medium text-slate-800">
          2. Turnier abschließen
        </h3>
        <p class="text-xs text-slate-500">
          Wenn alle Spiele beendet sind, kann das Turnier als abgeschlossen markiert werden.
        </p>
        <button
          type="button"
          class="rounded-lg border border-emerald-400 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          @click="advance('COMPLETED')"
        >
          Turnier abschließen
        </button>
      </div>

      <div
        v-if="hasAnyMatches"
        class="space-y-2 border-t border-slate-200 pt-6"
      >
        <h3 class="text-sm font-medium text-red-700">
          Gefahrenzone
        </h3>
        <p class="text-xs text-slate-500">
          Löscht alle erzeugten Spiele (inkl. Ergebnisse) unwiderruflich.
        </p>
        <button
          type="button"
          class="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          @click="deleteAllMatches"
        >
          Alle Spiele und Gruppen löschen
        </button>
      </div>
    </section>
  </div>
</template>

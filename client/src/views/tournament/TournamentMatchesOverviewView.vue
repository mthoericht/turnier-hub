<script setup lang="ts">
import { computed, inject, ref } from "vue";
import TournamentMatchCard from "@/components/tournament/TournamentMatchCard.vue";
import TournamentPhaseStepper from "@/components/tournament/TournamentPhaseStepper.vue";
import TournamentPhaseTabs from "@/components/tournament/TournamentPhaseTabs.vue";
import TournamentStandingsTable from "@/components/tournament/TournamentStandingsTable.vue";
import {
  tournamentLayoutKey,
  type MatchPhase,
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
  updateScoreDraft,
  patchScores,
  timerAction,
  fieldSmClass,
  cardClass,
  matchCardClass,
  timerBtnClass,
} = ctx;

type MatchesTab = "overview" | "group" | "r16" | "quarter" | "semi" | "final";

const activeMatchesTab = ref<MatchesTab>("overview");

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
  matchesByPhase.value.some(
    (b) => b.phase === "SEMI" && b.matches.length > 0
  )
);

const hasFinalMatches = computed(() =>
  matchesByPhase.value.some(
    (b) => b.phase === "FINAL" && b.matches.length > 0
  )
);

const tabToPhases: Record<MatchesTab, MatchPhase[] | null> = {
  overview: null,
  group: ["GROUP"],
  r16: ["ROUND_OF_16"],
  quarter: ["QUARTER"],
  semi: ["SEMI"],
  final: ["FINAL"],
};

const visibleMatchesByPhase = computed(() =>
{
  const phases = tabToPhases[activeMatchesTab.value];
  if (!phases) return matchesByPhase.value;
  const phaseSet = new Set(phases);
  return matchesByPhase.value.filter((b) => phaseSet.has(b.phase));
});

function isKnockoutPhase(phase: MatchPhase): boolean
{
  return phase === "ROUND_OF_16" || phase === "QUARTER" || phase === "SEMI" || phase === "FINAL";
}

const mode = computed(() => tournament.value?.mode ?? "GROUP_KO");

const showStandingsTable = computed(() =>
  hasGroupMatches.value
  && (activeMatchesTab.value === "overview" || activeMatchesTab.value === "group")
);

const groupMatchesByRound = computed(() =>
{
  const groupBlock = matchesByPhase.value.find((b) => b.phase === "GROUP");
  if (!groupBlock || groupBlock.matches.length === 0) return null;

  const roundMap = new Map<number, typeof groupBlock.matches>();
  for (const m of groupBlock.matches)
  {
    const key = m.roundOrder ?? 0;
    if (!roundMap.has(key)) roundMap.set(key, []);
    roundMap.get(key)!.push(m);
  }
  if (roundMap.size <= 1) return null;
  return [...roundMap.entries()].sort(([a], [b]) => a - b);
});

const { phaseFlow, stepState } = useTournamentPhaseStepper(tournament);
</script>

<template>
  <div v-if="tournament" class="space-y-8 sm:space-y-10">
    <TournamentPhaseStepper
      :phase-flow="phaseFlow"
      :step-state="stepState"
      :tournament-id="tournament.id"
      :tournament-phase="tournament.phase"
      :mode="mode"
      :can-edit="canEdit"
      :card-class="cardClass"
      :format-phase-label="formatPhaseLabel"
    />

    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <TournamentPhaseTabs
        v-model="activeMatchesTab"
        :mode="mode"
        :has-group-matches="hasGroupMatches"
        :has-r16-matches="hasR16Matches"
        :has-quarter-matches="hasQuarterMatches"
        :has-semi-matches="hasSemiMatches"
        :has-final-matches="hasFinalMatches"
        :format-phase-label="formatPhaseLabel"
      />
    </div>

    <TournamentStandingsTable
      v-if="showStandingsTable"
      :standings-groups="standingsGroups"
      :card-class="cardClass"
    />

    <template v-if="groupMatchesByRound && (activeMatchesTab === 'overview' || activeMatchesTab === 'group')">
      <section
        v-for="[roundIdx, roundMatches] in groupMatchesByRound"
        :key="`round-${roundIdx}`"
        :class="[cardClass, 'space-y-4']"
      >
        <h2
          class="font-display font-semibold text-lg text-slate-900"
        >
          Spielrunde {{ roundIdx + 1 }}
          <span class="text-sm font-normal text-slate-500">
            ({{ roundMatches.length }} {{ roundMatches.length === 1 ? 'Spiel' : 'Spiele' }} parallel)
          </span>
        </h2>
        <TournamentMatchCard
          v-for="m in roundMatches"
          :key="m.id"
          :match="m"
          :can-edit="canEdit"
          :draft-home="scoreDraft[m.id]?.home"
          :draft-away="scoreDraft[m.id]?.away"
          :match-card-class="matchCardClass"
          :timer-btn-class="timerBtnClass"
          :field-sm-class="fieldSmClass"
          :format-ms="formatMs"
          :format-match-status-label="formatMatchStatusLabel"
          @timer="(action) => timerAction(m.id, action)"
          @update-draft="(side, value) => updateScoreDraft(m.id, side, value)"
          @save-score="patchScores(m.id)"
        />
      </section>
    </template>

    <section
      v-for="block in visibleMatchesByPhase"
      :key="block.phase"
      :class="[
        cardClass,
        'space-y-4',
        isKnockoutPhase(block.phase as MatchPhase)
          ? 'border-blue-200/80 bg-blue-50/40'
          : '',
      ]"
    >
      <template v-if="block.phase !== 'GROUP' || !groupMatchesByRound">
        <h2
          class="font-display font-semibold text-xl text-slate-900"
        >
          {{ formatPhaseLabel(block.phase as MatchPhase) }}
        </h2>
        <p
          v-if="block.matches.length === 0"
          class="text-sm text-slate-600"
        >
          Noch keine Spiele für diese Runde.
        </p>
        <TournamentMatchCard
          v-for="m in block.matches"
          :key="m.id"
          :match="m"
          :can-edit="canEdit"
          :draft-home="scoreDraft[m.id]?.home"
          :draft-away="scoreDraft[m.id]?.away"
          :match-card-class="matchCardClass"
          :timer-btn-class="timerBtnClass"
          :field-sm-class="fieldSmClass"
          :format-ms="formatMs"
          :format-match-status-label="formatMatchStatusLabel"
          @timer="(action) => timerAction(m.id, action)"
          @update-draft="(side, value) => updateScoreDraft(m.id, side, value)"
          @save-score="patchScores(m.id)"
        />
      </template>
    </section>
  </div>
</template>

import { computed, type Ref } from "vue";
import type { TournamentDetail } from "@/tournament/tournamentContext";
import {
  phaseFlowForMode,
  phaseFlowIndexForTournamentPhase,
  phaseStepState,
} from "@/tournament/tournamentPhaseFlow";

export function useTournamentPhaseStepper(
  tournament: Ref<TournamentDetail | null>
)
{
  const phaseFlow = computed(() =>
    phaseFlowForMode(tournament.value?.mode)
  );

  const currentPhaseIndex = computed(() =>
    phaseFlowIndexForTournamentPhase(tournament.value?.phase, tournament.value?.mode)
  );

  function stepState(index: number)
  {
    return phaseStepState(index, currentPhaseIndex.value);
  }

  return {
    phaseFlow,
    currentPhaseIndex,
    stepState,
  };
}

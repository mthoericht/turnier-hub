import { computed, type Ref } from "vue";
import type { TournamentDetail } from "@/tournament/tournamentContext";
import {
  PHASE_FLOW_STEPS,
  phaseFlowIndexForTournamentPhase,
  phaseStepState,
} from "@/tournament/tournamentPhaseFlow";

export function useTournamentPhaseStepper(
  tournament: Ref<TournamentDetail | null>
) 
{
  const currentPhaseIndex = computed(() =>
    phaseFlowIndexForTournamentPhase(tournament.value?.phase)
  );

  function stepState(index: number) 
  {
    return phaseStepState(index, currentPhaseIndex.value);
  }

  return {
    phaseFlow: PHASE_FLOW_STEPS,
    currentPhaseIndex,
    stepState,
  };
}

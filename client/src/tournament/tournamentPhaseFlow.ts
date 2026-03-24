export type PhaseFlowStep = {
  phaseKey: string;
  shortLabel: string;
  hint: string;
};

export const PHASE_FLOW_STEPS: PhaseFlowStep[] = [
  { phaseKey: "GROUP", shortLabel: "Vorrunde", hint: "Alle gegen alle" },
  { phaseKey: "QUARTER", shortLabel: "VF", hint: "8 Teams" },
  { phaseKey: "SEMI", shortLabel: "HF", hint: "Halbfinale" },
  { phaseKey: "FINAL", shortLabel: "Finale", hint: "Sieger" },
  { phaseKey: "COMPLETED", shortLabel: "Ende", hint: "Turnier beendet" },
];

export function phaseFlowIndexForTournamentPhase(
  tournamentPhase: string | undefined
): number 
{
  const p = tournamentPhase ?? "GROUP";
  const i = PHASE_FLOW_STEPS.findIndex((s) => s.phaseKey === p);
  return i >= 0 ? i : 0;
}

export type PhaseStepState = "done" | "current" | "upcoming";

export function phaseStepState(
  stepIndex: number,
  currentPhaseIndex: number
): PhaseStepState 
{
  if (stepIndex < currentPhaseIndex) return "done";
  if (stepIndex === currentPhaseIndex) return "current";
  return "upcoming";
}

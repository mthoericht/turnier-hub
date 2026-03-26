import type { TournamentMode } from "@/tournament/tournamentContext";

export type PhaseFlowStep = {
  phaseKey: string;
  shortLabel: string;
  hint: string;
};

const FLOW_GROUP_KO: PhaseFlowStep[] = [
  { phaseKey: "GROUP", shortLabel: "Gruppen", hint: "Gruppenspiele" },
  { phaseKey: "ROUND_OF_16", shortLabel: "Achtel", hint: "Achtelfinale" },
  { phaseKey: "QUARTER", shortLabel: "Viertel", hint: "Viertelfinale" },
  { phaseKey: "SEMI", shortLabel: "Halb", hint: "Halbfinale" },
  { phaseKey: "FINAL", shortLabel: "Finale", hint: "Finale" },
  { phaseKey: "COMPLETED", shortLabel: "Ende", hint: "Turnier beendet" },
];

const FLOW_DIRECT_KO: PhaseFlowStep[] = [
  { phaseKey: "ROUND_OF_16", shortLabel: "Achtel", hint: "Achtelfinale" },
  { phaseKey: "QUARTER", shortLabel: "Viertel", hint: "Viertelfinale" },
  { phaseKey: "SEMI", shortLabel: "Halb", hint: "Halbfinale" },
  { phaseKey: "FINAL", shortLabel: "Finale", hint: "Finale" },
  { phaseKey: "COMPLETED", shortLabel: "Ende", hint: "Turnier beendet" },
];

const FLOW_ROUND_ROBIN: PhaseFlowStep[] = [
  { phaseKey: "GROUP", shortLabel: "Spiele", hint: "Jeder gegen Jeden" },
  { phaseKey: "COMPLETED", shortLabel: "Ende", hint: "Turnier beendet" },
];

export const PHASE_FLOW_STEPS = FLOW_GROUP_KO;

export function phaseFlowForMode(mode: TournamentMode | undefined): PhaseFlowStep[]
{
  if (mode === "DIRECT_KO") return FLOW_DIRECT_KO;
  if (mode === "ROUND_ROBIN") return FLOW_ROUND_ROBIN;
  return FLOW_GROUP_KO;
}

export function phaseFlowIndexForTournamentPhase(
  tournamentPhase: string | undefined,
  mode?: TournamentMode
): number
{
  const p = tournamentPhase ?? "GROUP";
  const flow = phaseFlowForMode(mode);
  const i = flow.findIndex((s) => s.phaseKey === p);
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

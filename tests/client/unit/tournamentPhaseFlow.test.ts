import { describe, expect, it } from "vitest";
import {
  phaseFlowForMode,
  phaseFlowIndexForTournamentPhase,
  phaseStepState,
} from "../../../client/src/tournament/tournamentPhaseFlow";

describe("tournamentPhaseFlow", () =>
{
  it("returns flow by mode", () =>
  {
    expect(phaseFlowForMode("GROUP_KO").map((s) => s.phaseKey)).toEqual([
      "GROUP",
      "KNOCKOUT",
      "COMPLETED",
    ]);
    expect(phaseFlowForMode("DIRECT_KO").map((s) => s.phaseKey)).toEqual([
      "KNOCKOUT",
      "COMPLETED",
    ]);
    expect(phaseFlowForMode("ROUND_ROBIN").map((s) => s.phaseKey)).toEqual([
      "GROUP",
      "COMPLETED",
    ]);
  });

  it("maps tournament phase to flow index", () =>
  {
    expect(phaseFlowIndexForTournamentPhase("GROUP", "GROUP_KO")).toBe(0);
    expect(phaseFlowIndexForTournamentPhase("QUARTER", "GROUP_KO")).toBe(1);
    expect(phaseFlowIndexForTournamentPhase("FINAL", "DIRECT_KO")).toBe(0);
    expect(phaseFlowIndexForTournamentPhase("COMPLETED", "ROUND_ROBIN")).toBe(1);
  });

  it("computes step state", () =>
  {
    expect(phaseStepState(0, 1)).toBe("done");
    expect(phaseStepState(1, 1)).toBe("current");
    expect(phaseStepState(2, 1)).toBe("upcoming");
  });
});

import { MatchPhase, TournamentPhase } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  collectKoRoundWinners,
  generateKoBracketFirstRound,
  koPhaseForBracketSize,
  tournamentPhaseForMatchPhase,
} from "../../../server/src/services/knockoutBracket.js";

describe("knockoutBracket", () =>
{
  it("maps bracket size to correct knockout phase", () =>
  {
    expect(koPhaseForBracketSize(16)).toBe(MatchPhase.ROUND_OF_16);
    expect(koPhaseForBracketSize(8)).toBe(MatchPhase.QUARTER);
    expect(koPhaseForBracketSize(4)).toBe(MatchPhase.SEMI);
    expect(koPhaseForBracketSize(2)).toBe(MatchPhase.FINAL);
  });

  it("maps match phase to tournament phase", () =>
  {
    expect(tournamentPhaseForMatchPhase(MatchPhase.ROUND_OF_16)).toBe(TournamentPhase.ROUND_OF_16);
    expect(tournamentPhaseForMatchPhase(MatchPhase.QUARTER)).toBe(TournamentPhase.QUARTER);
    expect(tournamentPhaseForMatchPhase(MatchPhase.SEMI)).toBe(TournamentPhase.SEMI);
    expect(tournamentPhaseForMatchPhase(MatchPhase.FINAL)).toBe(TournamentPhase.FINAL);
  });

  it("generates first round with byes for non-power-of-2 team count", () =>
  {
    const teams = ["1", "2", "3", "4", "5", "6"];
    const result = generateKoBracketFirstRound(teams);

    expect(result.phase).toBe(MatchPhase.QUARTER);
    expect(result.matches).toHaveLength(4);
    expect(result.matches.some((m) => m.awayTeamId === null)).toBe(true);
  });

  it("collects winners from regular matches and byes", () =>
  {
    const winners = collectKoRoundWinners([
      { homeTeamId: "A", awayTeamId: null, homeScore: null, awayScore: null },
      { homeTeamId: "B", awayTeamId: "C", homeScore: 1, awayScore: 0 },
      { homeTeamId: "D", awayTeamId: "E", homeScore: 0, awayScore: 2 },
    ]);
    expect(winners).toEqual(["A", "B", "E"]);
  });
});

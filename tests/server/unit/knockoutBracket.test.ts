import { MatchPhase, TournamentPhase } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  collectKoRoundWinners,
  generateKoBracketFirstRound,
  generatePairingsWithByes,
  interleavedPairings,
  koPhaseForBracketSize,
  randomizeTeamIds,
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

  it("randomizes team ids before creating bracket", () =>
  {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    try
    {
      const randomized = randomizeTeamIds(["1", "2", "3", "4"]);
      expect(randomized).toEqual(["2", "3", "4", "1"]);
    }
    finally
    {
      spy.mockRestore();
    }
  });

  it("builds top-vs-bottom pairings from ordered ids", () =>
  {
    const pairs = interleavedPairings(["A", "B", "C", "D"]);
    expect(pairs).toEqual([
      ["A", "D"],
      ["B", "C"],
    ]);
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

  describe("generatePairingsWithByes", () =>
  {
    it("creates even pairings without byes for power-of-2 count", () =>
    {
      const pairs = generatePairingsWithByes(["A", "B", "C", "D"]);
      expect(pairs).toHaveLength(2);
      expect(pairs.every((p) => p.away !== null)).toBe(true);
      const allTeams = pairs.flatMap((p) => [p.home, p.away]);
      expect(new Set(allTeams).size).toBe(4);
    });

    it("creates bye pairings for 3 teams", () =>
    {
      const pairs = generatePairingsWithByes(["A", "B", "C"]);
      expect(pairs).toHaveLength(2);
      const byeMatches = pairs.filter((p) => p.away === null);
      const realMatches = pairs.filter((p) => p.away !== null);
      expect(byeMatches).toHaveLength(1);
      expect(realMatches).toHaveLength(1);
    });

    it("creates bye pairings for 5 teams", () =>
    {
      const pairs = generatePairingsWithByes(["A", "B", "C", "D", "E"]);
      expect(pairs).toHaveLength(4);
      const byeMatches = pairs.filter((p) => p.away === null);
      const realMatches = pairs.filter((p) => p.away !== null);
      expect(byeMatches).toHaveLength(3);
      expect(realMatches).toHaveLength(1);
    });

    it("creates bye pairings for 7 teams", () =>
    {
      const pairs = generatePairingsWithByes(["A", "B", "C", "D", "E", "F", "G"]);
      expect(pairs).toHaveLength(4);
      const byeMatches = pairs.filter((p) => p.away === null);
      expect(byeMatches).toHaveLength(1);
    });

    it("throws for fewer than 2 teams", () =>
    {
      expect(() => generatePairingsWithByes(["A"])).toThrow();
    });

    it("creates a single final match for exactly 2 teams", () =>
    {
      const pairs = generatePairingsWithByes(["A", "B"]);
      expect(pairs).toHaveLength(1);
      expect(pairs[0]!.home).toBe("A");
      expect(pairs[0]!.away).toBe("B");
    });
  });
});

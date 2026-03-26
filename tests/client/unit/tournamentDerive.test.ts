import { describe, expect, it } from "vitest";
import type {
  MatchRow,
  TournamentTeam,
} from "../../../client/src/tournament/tournamentContext";
import {
  advanceTargetRisksDataLoss,
  buildScoreDraftFromMatches,
  collectAssignedPlayerIds,
  getMatchesByPhase,
  groupRegenerateRisksDataLoss,
  mergeScoreDraftFromMatches,
  parseScoreDraftForPatch,
  resolveMemberTeamSelection,
} from "../../../client/src/tournament/tournamentDerive";

function makeMatch(overrides: Partial<MatchRow>): MatchRow
{
  return {
    id: "m1",
    phase: "GROUP",
    roundOrder: 0,
    groupLabel: null,
    homeTeamId: "t1",
    awayTeamId: "t2",
    homeTeam: { id: "t1", name: "Team 1" },
    awayTeam: { id: "t2", name: "Team 2" },
    homeScore: null,
    awayScore: null,
    status: "SCHEDULED",
    elapsedMs: 0,
    ...overrides,
  };
}

describe("tournamentDerive", () =>
{
  it("detects data-loss risks on group regenerate", () =>
  {
    const matches = [
      makeMatch({ id: "a", phase: "GROUP", status: "LIVE" }),
      makeMatch({ id: "b", phase: "QUARTER", status: "SCHEDULED" }),
    ];
    expect(groupRegenerateRisksDataLoss(matches)).toBe(true);
  });

  it("detects data-loss risks when advancing target would clear KO data", () =>
  {
    const matches = [
      makeMatch({ id: "q1", phase: "QUARTER", homeScore: 1, awayScore: 0, status: "FINISHED" }),
      makeMatch({ id: "s1", phase: "SEMI", status: "SCHEDULED" }),
    ];
    expect(advanceTargetRisksDataLoss(matches, "QUARTER", "GROUP")).toBe(true);
  });

  it("builds and merges score drafts", () =>
  {
    const matches = [
      makeMatch({ id: "m1", homeScore: 2, awayScore: 1 }),
      makeMatch({ id: "m2", homeScore: null, awayScore: null }),
    ];
    const built = buildScoreDraftFromMatches(matches);
    expect(built.m1).toEqual({ home: "2", away: "1" });
    expect(built.m2).toEqual({ home: "0", away: "0" });

    const merged = mergeScoreDraftFromMatches(matches, {
      m1: { home: "9", away: "9" },
      m2: { home: "0", away: "0" },
    });
    expect(merged.m1).toEqual({ home: "9", away: "9" });
    expect(merged.m2).toEqual({ home: "0", away: "0" });
  });

  it("parses score draft for patch rules", () =>
  {
    expect(parseScoreDraftForPatch({ home: "", away: "" }).kind).toBe("empty");
    expect(parseScoreDraftForPatch({ home: "1", away: "" }).kind).toBe("partial");
    expect(parseScoreDraftForPatch({ home: "-1", away: "0" }).kind).toBe("invalid");
    expect(parseScoreDraftForPatch({ home: "3", away: "2" })).toEqual({
      kind: "ok",
      homeScore: 3,
      awayScore: 2,
    });
  });

  it("groups visible matches by phase and current KO phase", () =>
  {
    const matches = [
      makeMatch({ id: "g1", phase: "GROUP" }),
      makeMatch({ id: "q1", phase: "QUARTER" }),
    ];
    const byPhase = getMatchesByPhase(matches, "SEMI");
    expect(byPhase.map((x) => x.phase)).toContain("SEMI");
  });

  it("collects assigned players and resolves current team selection", () =>
  {
    const teams = [
      {
        id: "t1",
        name: "A",
        sortOrder: 0,
        groupLabel: null,
        members: [{ playerId: "p1" }, { playerId: "p2" }],
      },
      {
        id: "t2",
        name: "B",
        sortOrder: 1,
        groupLabel: null,
        members: [{ playerId: "p3" }],
      },
    ] as unknown as TournamentTeam[];

    const assigned = collectAssignedPlayerIds(teams);
    expect(assigned.has("p1")).toBe(true);
    expect(assigned.has("p3")).toBe(true);

    expect(resolveMemberTeamSelection(teams, "t2")).toBe("t2");
    expect(resolveMemberTeamSelection(teams, "missing")).toBe("t1");
    expect(resolveMemberTeamSelection([], "missing")).toBe("");
  });
});

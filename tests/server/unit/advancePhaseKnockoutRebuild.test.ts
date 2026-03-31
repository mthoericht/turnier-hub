import { MatchPhase, MatchStatus, TournamentPhase } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { advanceTournamentPhase } from "../../../server/src/services/advancePhase.js";


function makeKoMatch(
  id: string,
  phase: MatchPhase,
  roundOrder: number,
  homeTeamId: string,
  awayTeamId: string
): any
{
  return {
    id,
    tournamentId: "t1",
    phase,
    groupLabel: null,
    roundOrder,
    slotIndex: roundOrder,
    homeTeamId,
    awayTeamId,
    homeTeam: null,
    awayTeam: null,
    homeScore: 2,
    awayScore: 0,
    status: MatchStatus.FINISHED,
    matchStartedAt: null,
    totalPausedMs: 0,
    pausedAt: null,
    elapsedSnapshotMs: null,
  };
}

describe("advancePhase knockout rebuild", () =>
{
  it("deletes target and later phases and recreates target when advancing from previous KO round", async () =>
  {
    // Make the bracket deterministic.
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    try
    {
      const deletedCalls: any[] = [];
      const created: any[] = [];
      const updatedPhases: any[] = [];

      const tx = {
        match: {
          deleteMany: vi.fn(async (args) =>
          {
            deletedCalls.push(args);
          }),
          create: vi.fn(async ({ data }: any) =>
          {
            created.push(data);
            return data;
          }),
        },
        tournament: {
          update: vi.fn(async (args: any) =>
          {
            updatedPhases.push(args);
            return args;
          }),
        },
      };

      const prismaMock: any = {
        $transaction: async (fn: any) => fn(tx),
      };

      const roundOf16 = Array.from({ length: 8 }, (_, i) =>
        makeKoMatch(`r16-${i}`, MatchPhase.ROUND_OF_16, i, `T${i}`, `U${i}`)
      );
      const existingQuarter = [
        makeKoMatch("q-old-1", MatchPhase.QUARTER, 0, "Q1", "Q2"),
      ];
      const existingSemi = [
        makeKoMatch("s-old-1", MatchPhase.SEMI, 0, "S1", "S2"),
      ];
      const existingFinal = [
        makeKoMatch("f-old-1", MatchPhase.FINAL, 0, "F1", "F2"),
      ];

      const tournament: any = {
        id: "t1",
        phase: TournamentPhase.QUARTER,
        groupCount: 1,
        advancesPerGroup: 2,
        teams: [],
        matches: [...roundOf16, ...existingQuarter, ...existingSemi, ...existingFinal],
      };

      await advanceTournamentPhase(prismaMock, tournament, "QUARTER");

      // Expect deleteMany for target + later phases: QUARTER, SEMI, FINAL
      const lastDelete = deletedCalls[0];
      expect(lastDelete.where.tournamentId).toBe("t1");
      expect(lastDelete.where.phase.in).toEqual([
        MatchPhase.QUARTER,
        MatchPhase.SEMI,
        MatchPhase.FINAL,
      ]);

      // Expect 4 created matches for QUARTER (8 winners => 4 pairs)
      expect(created).toHaveLength(4);
      expect(created.every((m) => m.phase === MatchPhase.QUARTER)).toBe(true);
      expect(created.map((m) => m.roundOrder)).toEqual([0, 1, 2, 3]);

      // Tournament phase updated to QUARTER
      expect(updatedPhases).toHaveLength(1);
      expect(updatedPhases[0].data.phase).toBe(TournamentPhase.QUARTER);
    }
    finally
    {
      spy.mockRestore();
    }
  });

  it("deletes all KO phases at or after target and recreates target when no previous KO round exists", async () =>
  {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    try
    {
      const deletedCalls: any[] = [];
      const created: any[] = [];
      const updatedPhases: any[] = [];

      const tx = {
        match: {
          deleteMany: vi.fn(async (args) => deletedCalls.push(args)),
          create: vi.fn(async ({ data }: any) =>
          {
            created.push(data);
            return data;
          }),
        },
        tournament: {
          update: vi.fn(async (args: any) =>
          {
            updatedPhases.push(args);
            return args;
          }),
        },
      };

      const prismaMock: any = { $transaction: async (fn: any) => fn(tx) };

      const existingQuarter = [makeKoMatch("q-old", MatchPhase.QUARTER, 0, "Q1", "Q2")];
      const existingSemi = [makeKoMatch("s-old", MatchPhase.SEMI, 0, "S1", "S2")];
      const existingFinal = [makeKoMatch("f-old", MatchPhase.FINAL, 0, "F1", "F2")];

      const teams = Array.from({ length: 16 }, (_, i) =>
        ({
          id: `T${i}`,
          name: `Team ${i}`,
          sortOrder: i,
          groupLabel: null,
        }) as any
      );

      const tournament: any = {
        id: "t1",
        phase: TournamentPhase.ROUND_OF_16,
        groupCount: 1,
        advancesPerGroup: 16,
        teams,
        // No ROUND_OF_16 matches => it falls back to group qualifiers
        matches: [...existingQuarter, ...existingSemi, ...existingFinal],
      };

      await advanceTournamentPhase(prismaMock, tournament, "ROUND_OF_16");

      const deleteAllKo = deletedCalls[0];
      expect(deleteAllKo.where.phase.in).toEqual([
        MatchPhase.ROUND_OF_16,
        MatchPhase.QUARTER,
        MatchPhase.SEMI,
        MatchPhase.FINAL,
      ]);

      // 16 qualifiers => 8 pairs => 8 created ROUND_OF_16 matches
      expect(created).toHaveLength(8);
      expect(created.every((m) => m.phase === MatchPhase.ROUND_OF_16)).toBe(true);
      expect(created.map((m) => m.roundOrder)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      expect(updatedPhases[0].data.phase).toBe(TournamentPhase.ROUND_OF_16);
    }
    finally
    {
      spy.mockRestore();
    }
  });

  it("creates bye matches as FINISHED when advancing with odd qualifier count from groups", async () =>
  {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    try
    {
      const created: any[] = [];

      const tx = {
        match: {
          deleteMany: vi.fn(async () => {}),
          create: vi.fn(async ({ data }: any) =>
          {
            created.push(data);
            return data;
          }),
        },
        tournament: {
          update: vi.fn(async (args: any) => args),
        },
      };

      const prismaMock: any = { $transaction: async (fn: any) => fn(tx) };

      const teams = Array.from({ length: 3 }, (_, i) =>
        ({
          id: `T${i}`,
          name: `Team ${i}`,
          sortOrder: i,
          groupLabel: null,
        }) as any
      );

      const tournament: any = {
        id: "t1",
        phase: TournamentPhase.GROUP,
        groupCount: 1,
        advancesPerGroup: 4,
        teams,
        matches: [],
      };

      await advanceTournamentPhase(prismaMock, tournament, "SEMI");

      // 3 qualifiers → padded to 4 → 2 matches (1 real + 1 bye)
      expect(created).toHaveLength(2);
      const byeMatches = created.filter((m) => m.awayTeamId === null);
      const realMatches = created.filter((m) => m.awayTeamId !== null);
      expect(byeMatches).toHaveLength(1);
      expect(realMatches).toHaveLength(1);

      // Bye match must be FINISHED
      expect(byeMatches[0].status).toBe(MatchStatus.FINISHED);
      // Real match must be SCHEDULED
      expect(realMatches[0].status).toBe(MatchStatus.SCHEDULED);
    }
    finally
    {
      spy.mockRestore();
    }
  });

  it("creates bye matches as FINISHED when advancing from previous KO round with odd winner count", async () =>
  {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    try
    {
      const created: any[] = [];

      const tx = {
        match: {
          deleteMany: vi.fn(async () => {}),
          create: vi.fn(async ({ data }: any) =>
          {
            created.push(data);
            return data;
          }),
        },
        tournament: {
          update: vi.fn(async (args: any) => args),
        },
      };

      const prismaMock: any = { $transaction: async (fn: any) => fn(tx) };

      // 3 SEMI matches (2 real + 1 bye) → 3 winners
      const semiMatches = [
        makeKoMatch("s-0", MatchPhase.SEMI, 0, "A", "B"),
        makeKoMatch("s-1", MatchPhase.SEMI, 1, "C", "D"),
        { ...makeKoMatch("s-2", MatchPhase.SEMI, 2, "E", "F"), awayTeamId: null, awayScore: null },
      ];

      const tournament: any = {
        id: "t1",
        phase: TournamentPhase.SEMI,
        groupCount: 1,
        advancesPerGroup: 2,
        teams: [],
        matches: semiMatches,
      };

      await advanceTournamentPhase(prismaMock, tournament, "FINAL");

      // 3 winners → padded to 4 → 2 matches (some may have byes)
      expect(created).toHaveLength(2);
      expect(created.every((m) => m.phase === MatchPhase.FINAL)).toBe(true);

      const byeMatches = created.filter((m) => m.awayTeamId === null);
      const realMatches = created.filter((m) => m.awayTeamId !== null);

      // At least 1 real match for the final
      expect(realMatches.length).toBeGreaterThanOrEqual(1);

      // Bye matches must be FINISHED, real ones SCHEDULED
      for (const m of byeMatches) expect(m.status).toBe(MatchStatus.FINISHED);
      for (const m of realMatches) expect(m.status).toBe(MatchStatus.SCHEDULED);
    }
    finally
    {
      spy.mockRestore();
    }
  });
});


import { MatchPhase, MatchStatus, type Match } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeElapsedMs, MAX_MATCH_DURATION_MS } from "../../../server/src/services/matchTimer.js";

function makeMatch(overrides: Partial<Match>): Match
{
  return {
    id: "m1",
    tournamentId: "t1",
    phase: MatchPhase.GROUP,
    groupLabel: null,
    roundOrder: 0,
    slotIndex: 0,
    homeTeamId: null,
    awayTeamId: null,
    homeScore: null,
    awayScore: null,
    status: MatchStatus.SCHEDULED,
    matchStartedAt: null,
    totalPausedMs: 0,
    pausedAt: null,
    elapsedSnapshotMs: null,
    ...overrides,
  };
}

describe("matchTimer", () =>
{
  it("caps live elapsed time at five hours", () =>
  {
    const now = new Date("2026-01-01T10:00:00.000Z");
    const match = makeMatch({
      status: MatchStatus.LIVE,
      matchStartedAt: new Date("2026-01-01T04:00:00.000Z"),
    });
    expect(computeElapsedMs(match, now)).toBe(MAX_MATCH_DURATION_MS);
  });

  it("caps finished snapshots at five hours", () =>
  {
    const now = new Date("2026-01-01T10:00:00.000Z");
    const match = makeMatch({
      status: MatchStatus.FINISHED,
      elapsedSnapshotMs: MAX_MATCH_DURATION_MS + 60_000,
    });
    expect(computeElapsedMs(match, now)).toBe(MAX_MATCH_DURATION_MS);
  });
});

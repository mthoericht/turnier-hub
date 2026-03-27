import { describe, expect, it } from "vitest";
import {
  computeMatchElapsedMs,
  MAX_MATCH_DURATION_MS,
} from "../../../client/src/tournament/matchElapsed";

describe("computeMatchElapsedMs", () =>
{
  it("caps live elapsed time at five hours", () =>
  {
    const now = new Date("2026-01-01T10:00:00.000Z");
    const match = {
      status: "LIVE" as const,
      matchStartedAt: "2026-01-01T04:00:00.000Z",
      totalPausedMs: 0,
      pausedAt: null,
      elapsedSnapshotMs: null,
    };
    expect(computeMatchElapsedMs(match, now)).toBe(MAX_MATCH_DURATION_MS);
  });

  it("caps finished snapshots at five hours", () =>
  {
    const now = new Date("2026-01-01T10:00:00.000Z");
    const match = {
      status: "FINISHED" as const,
      matchStartedAt: "2026-01-01T04:00:00.000Z",
      totalPausedMs: 0,
      pausedAt: null,
      elapsedSnapshotMs: MAX_MATCH_DURATION_MS + 60_000,
    };
    expect(computeMatchElapsedMs(match, now)).toBe(MAX_MATCH_DURATION_MS);
  });

  it("freezes elapsed while paused using pausedAt", () =>
  {
    const match = {
      status: "PAUSED" as const,
      matchStartedAt: "2026-01-01T10:00:00.000Z",
      totalPausedMs: 0,
      pausedAt: "2026-01-01T10:05:00.000Z",
      elapsedSnapshotMs: null,
    };
    const later = new Date("2026-01-01T11:00:00.000Z");
    expect(computeMatchElapsedMs(match, later)).toBe(5 * 60 * 1000);
  });
});

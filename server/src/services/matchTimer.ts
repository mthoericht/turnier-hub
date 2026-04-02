import type { Match } from "@prisma/client";

export const MAX_MATCH_DURATION_MS = 5 * 60 * 60 * 1000;

function clampMatchDuration(ms: number): number
{
  return Math.min(MAX_MATCH_DURATION_MS, Math.max(0, ms));
}

/**
 * Computes elapsed match time in milliseconds for the current state.
 *
 * Uses persisted snapshots for finished/cancelled matches and derives
 * live elapsed time for running/paused matches from timestamps.
 */
export function computeElapsedMs(m: Match, now: Date): number
{
  if (
    m.elapsedSnapshotMs != null
    && (m.status === "FINISHED" || m.status === "CANCELLED")
  )
  {
    return clampMatchDuration(m.elapsedSnapshotMs);
  }
  if (!m.matchStartedAt) return 0;
  const start = m.matchStartedAt.getTime();
  const pause = m.totalPausedMs ?? 0;
  if (m.status === "SCHEDULED") return 0;
  if (m.status === "PAUSED" && m.pausedAt)
  {
    return clampMatchDuration(m.pausedAt.getTime() - start - pause);
  }
  if (m.status === "LIVE")
  {
    return clampMatchDuration(now.getTime() - start - pause);
  }
  if (m.status === "FINISHED" || m.status === "CANCELLED")
  {
    return clampMatchDuration(m.elapsedSnapshotMs ?? 0);
  }
  return 0;
}

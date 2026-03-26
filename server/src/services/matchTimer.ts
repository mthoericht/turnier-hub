import type { Match } from "@prisma/client";
import { MatchStatus } from "@prisma/client";

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
    && (m.status === MatchStatus.FINISHED || m.status === MatchStatus.CANCELLED)
  )
  {
    return m.elapsedSnapshotMs;
  }
  if (!m.matchStartedAt) return 0;
  const start = m.matchStartedAt.getTime();
  const pause = m.totalPausedMs ?? 0;
  if (m.status === MatchStatus.SCHEDULED) return 0;
  if (m.status === MatchStatus.PAUSED && m.pausedAt)
  {
    return Math.max(0, m.pausedAt.getTime() - start - pause);
  }
  if (m.status === MatchStatus.LIVE)
  {
    return Math.max(0, now.getTime() - start - pause);
  }
  if (m.status === MatchStatus.FINISHED || m.status === MatchStatus.CANCELLED)
  {
    return m.elapsedSnapshotMs ?? 0;
  }
  return 0;
}

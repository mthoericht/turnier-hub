import type { MatchStatus } from "@/tournament/tournamentContext";

/** Same cap as `server/src/services/matchTimer.ts`. */
export const MAX_MATCH_DURATION_MS = 5 * 60 * 60 * 1000;

function clampMatchDuration(ms: number): number
{
  return Math.min(MAX_MATCH_DURATION_MS, Math.max(0, ms));
}

export type MatchTimerApiShape = {
  status: MatchStatus;
  matchStartedAt?: string | null;
  totalPausedMs?: number | null;
  pausedAt?: string | null;
  elapsedSnapshotMs?: number | null;
};

function parseMs(iso: string | null | undefined): number | null
{
  if (iso == null || iso === "") return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Elapsed match time for display — mirrors `server/src/services/matchTimer.ts`
 * using ISO date strings from the JSON API.
 *
 * For LIVE matches the UI should re-run this with a current `now` on a local
 * interval; state changes arrive via REST / WebSocket, not per-second polling.
 */
export function computeMatchElapsedMs(m: MatchTimerApiShape, now: Date): number
{
  if (
    m.elapsedSnapshotMs != null
    && (m.status === "FINISHED" || m.status === "CANCELLED")
  )
  {
    return clampMatchDuration(m.elapsedSnapshotMs);
  }

  const startMs = parseMs(m.matchStartedAt ?? null);
  if (startMs == null) return 0;

  const pause = m.totalPausedMs ?? 0;
  if (m.status === "SCHEDULED") return 0;

  if (m.status === "PAUSED")
  {
    const pausedAtMs = parseMs(m.pausedAt ?? null);
    if (pausedAtMs == null) return 0;
    return clampMatchDuration(pausedAtMs - startMs - pause);
  }

  if (m.status === "LIVE")
  {
    return clampMatchDuration(now.getTime() - startMs - pause);
  }

  if (m.status === "FINISHED" || m.status === "CANCELLED")
  {
    return clampMatchDuration(m.elapsedSnapshotMs ?? 0);
  }

  return 0;
}

import {
  computed,
  onUnmounted,
  ref,
  watch,
  type ComputedRef,
} from "vue";
import { computeMatchElapsedMs } from "@/tournament/matchElapsed";
import type { MatchRow } from "@/tournament/tournamentContext";

/**
 * Elapsed time for the match stopwatch UI. For **LIVE** matches, bumps once per second
 * locally (no HTTP/WebSocket polling); timer fields still come from the API/WebSocket.
 */
export function useMatchTimerDisplay(getMatch: () => MatchRow): { displayElapsedMs: ComputedRef<number> }
{
  const clockTick = ref(0);
  let liveInterval: ReturnType<typeof setInterval> | null = null;

  function clearLiveInterval(): void
  {
    if (liveInterval != null)
    {
      clearInterval(liveInterval);
      liveInterval = null;
    }
  }

  function syncLiveClock(): void
  {
    clearLiveInterval();
    clockTick.value = Date.now();
    if (getMatch().status === "LIVE")
    {
      liveInterval = setInterval(() =>
      {
        clockTick.value = Date.now();
      }, 1000);
    }
  }

  watch(
    () =>
    {
      const m = getMatch();
      return { id: m.id, status: m.status };
    },
    () => syncLiveClock(),
    { immediate: true }
  );

  watch(
    () =>
    {
      const m = getMatch();
      return [
        m.matchStartedAt,
        m.totalPausedMs,
        m.pausedAt,
        m.elapsedSnapshotMs,
        m.status,
      ] as const;
    },
    () =>
    {
      clockTick.value = Date.now();
    }
  );

  onUnmounted(clearLiveInterval);

  const displayElapsedMs = computed(() =>
  {
    void clockTick.value;
    return computeMatchElapsedMs(getMatch(), new Date());
  });

  return { displayElapsedMs };
}

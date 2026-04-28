import type { RealtimeEventBus } from "./eventBus.js";

let bus: RealtimeEventBus | null = null;

/**
 * Registers the active realtime bus instance used by `notify*` calls.
 *
 * `createApp()` wires this up automatically. Tests may override the bus to
 * substitute a mock, and pass `null` to disable publishing entirely.
 */
export function setRealtimeEventBus(instance: RealtimeEventBus | null): void
{
  bus = instance;
}

/**
 * Pushes a single-tournament change to clients that subscribed to that
 * tournament's id via `GET /api/sse?tournaments=…`.
 */
export function notifyTournamentChanged(tournamentId: string): void
{
  bus?.publish({ type: "tournamentChanged", tournamentId });
}

/**
 * Broadcasts a catalog change (`players` and/or `classes`) to all SSE clients.
 */
export function notifyCatalogChanged(
  kinds: Array<"players" | "classes">
): void
{
  if (kinds.length === 0)
  {
    return;
  }
  bus?.publish({ type: "catalogChanged", kinds });
}

/**
 * Broadcasts a tournament-list change to all SSE clients.
 */
export function notifyTournamentsListChanged(): void
{
  bus?.publish({ type: "tournamentsChanged" });
}

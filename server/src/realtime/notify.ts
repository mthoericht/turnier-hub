import type { RealtimeHub } from "./hub.js";

let hub: RealtimeHub | null = null;

export function setRealtimeHub(instance: RealtimeHub | null): void
{
  hub = instance;
}

export function notifyTournamentChanged(tournamentId: string): void
{
  hub?.notifyTournamentChanged(tournamentId);
}

export function notifyCatalogChanged(
  kinds: Array<"players" | "classes">
): void
{
  hub?.notifyCatalogChanged(kinds);
}

export function notifyTournamentsListChanged(): void
{
  hub?.notifyTournamentsListChanged();
}

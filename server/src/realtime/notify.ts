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

export function notifyUserCatalog(
  userId: string,
  kinds: Array<"players" | "classes">
): void
{
  hub?.notifyUserCatalog(userId, kinds);
}

export function notifyUserTournamentsChanged(userId: string): void
{
  hub?.notifyUserTournamentsChanged(userId);
}

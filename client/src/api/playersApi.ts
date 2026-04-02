import { api } from "./http";
import type { Player } from "@/types";

export type PlayersScope = "all" | "own";

export async function fetchPlayers(
  scope: PlayersScope
): Promise<Player[]> 
{
  return api<Player[]>(`/api/players?scope=${scope}`);
}

/** All players visible to the user (for tournament roster assignment). */
export async function fetchPlayersAll(): Promise<Player[]> 
{
  return fetchPlayers("all");
}

export async function postPlayer(body: {
  name: string;
  schoolClassId: string | null;
}): Promise<Player> 
{
  return api<Player>("/api/players", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchPlayer(
  id: string,
  body: { name: string; schoolClassId: string | null }
): Promise<void> 
{
  await api(`/api/players/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deletePlayer(id: string): Promise<void> 
{
  await api(`/api/players/${id}`, { method: "DELETE" });
}

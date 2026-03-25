import { api } from "@/api/http";
import type { MatchRow, TournamentDetail } from "@/tournament/tournamentContext";
import type { CreatedBy } from "@/types";

export type TournamentsScope = "all" | "own";

export type TournamentListRow = {
  id: string;
  name: string;
  sport: string;
  phase: string;
  createdBy: CreatedBy;
  _count: { teams: number; matches: number };
};

export async function fetchTournaments(
  scope: TournamentsScope
): Promise<TournamentListRow[]> 
{
  return api<TournamentListRow[]>(`/api/tournaments?scope=${scope}`);
}

export async function postTournament(body: {
  name: string;
  sport: string;
}): Promise<void> 
{
  await api("/api/tournaments", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteTournament(id: string): Promise<void> 
{
  await api(`/api/tournaments/${id}`, { method: "DELETE" });
}

export async function fetchTournamentDetail(
  tournamentId: string
): Promise<TournamentDetail> 
{
  return api<TournamentDetail>(`/api/tournaments/${tournamentId}`);
}

export async function fetchTournamentStandings(
  tournamentId: string
): Promise<Record<string, unknown>> 
{
  return api<Record<string, unknown>>(
    `/api/tournaments/${tournamentId}/standings`
  );
}

export async function createTournamentTeam(
  tournamentId: string,
  body: { name: string }
): Promise<void> 
{
  await api(`/api/tournaments/${tournamentId}/teams`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteTournamentTeam(
  tournamentId: string,
  teamId: string
): Promise<void> 
{
  await api(`/api/tournaments/${tournamentId}/teams/${teamId}`, {
    method: "DELETE",
  });
}

export async function addTeamMember(
  tournamentId: string,
  teamId: string,
  playerId: string
): Promise<void> 
{
  await api(
    `/api/tournaments/${tournamentId}/teams/${teamId}/members`,
    {
      method: "POST",
      body: JSON.stringify({ playerId }),
    }
  );
}

export async function removeTeamMember(
  tournamentId: string,
  teamId: string,
  playerId: string
): Promise<void> 
{
  await api(
    `/api/tournaments/${tournamentId}/teams/${teamId}/members/${playerId}`,
    { method: "DELETE" }
  );
}

export type TransferKaderResult = {
  createdTeams: number;
  addedMembers: number;
};

export async function transferTournamentKader(
  tournamentId: string,
  sourceTournamentId: string,
  body?: { overwriteExistingMembers?: boolean }
): Promise<TransferKaderResult> 
{
  return api<TransferKaderResult>(
    `/api/tournaments/${tournamentId}/transfer-kader-from/${sourceTournamentId}`,
    {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }
  );
}

export async function patchTournamentAdvances(
  tournamentId: string,
  advancesPerGroup: number
): Promise<void> 
{
  await api(`/api/tournaments/${tournamentId}`, {
    method: "PATCH",
    body: JSON.stringify({ advancesPerGroup }),
  });
}

export async function postGenerateGroupMatches(
  tournamentId: string
): Promise<TournamentDetail> 
{
  return api<TournamentDetail>(
    `/api/tournaments/${tournamentId}/generate-group-matches`,
    { method: "POST" }
  );
}

export async function postAdvancePhase(
  tournamentId: string,
  target: "QUARTER" | "SEMI" | "FINAL"
): Promise<TournamentDetail> 
{
  return api<TournamentDetail>(
    `/api/tournaments/${tournamentId}/advance`,
    { method: "POST", body: JSON.stringify({ target }) }
  );
}

export async function patchMatchScores(
  tournamentId: string,
  matchId: string,
  body: { homeScore?: number; awayScore?: number }
): Promise<MatchRow> 
{
  return api<MatchRow>(
    `/api/tournaments/${tournamentId}/matches/${matchId}/scores`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
}

export async function postMatchTimer(
  tournamentId: string,
  matchId: string,
  action: "start" | "pause" | "resume" | "end" | "cancel"
): Promise<MatchRow> 
{
  return api<MatchRow>(
    `/api/tournaments/${tournamentId}/matches/${matchId}/timer`,
    {
      method: "POST",
      body: JSON.stringify({ action }),
    }
  );
}

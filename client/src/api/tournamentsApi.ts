import { api } from "./http";
import type { MatchRow, TournamentDetail, TournamentMode } from "@/tournament/tournamentContext";
import type { CreatedBy } from "@turnier-hub/shared";

export type TournamentsScope = "all" | "own";

export type TournamentListRow = {
  id: string;
  name: string;
  sport: string;
  mode: TournamentMode;
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
  mode?: TournamentMode;
  groupCount?: number;
  advancesPerGroup?: number;
  teamsAreIndividuals?: boolean;
}): Promise<TournamentListRow>
{
  return api<TournamentListRow>("/api/tournaments", {
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

export async function patchTournamentTeam(
  tournamentId: string,
  teamId: string,
  body: { name?: string; sortOrder?: number }
): Promise<{ id: string; name: string; sortOrder: number }>
{
  return api<{ id: string; name: string; sortOrder: number }>(
    `/api/tournaments/${tournamentId}/teams/${teamId}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
}

export async function deleteTournamentTeam(
  tournamentId: string,
  teamId: string
): Promise<{ deletedTeamId: string; removedGroupMatches: number }>
{
  return api<{ deletedTeamId: string; removedGroupMatches: number }>(`/api/tournaments/${tournamentId}/teams/${teamId}`, {
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

export async function patchTournamentGroupLabel(
  tournamentId: string,
  oldLabel: string,
  newLabel: string
): Promise<TournamentDetail>
{
  return api<TournamentDetail>(
    `/api/tournaments/${tournamentId}/groups/rename`,
    {
      method: "PATCH",
      body: JSON.stringify({ oldLabel, newLabel }),
    }
  );
}

export type TransferTeamResult = {
  createdTeams: number;
  addedMembers: number;
};

export async function transferTournamentTeam(
  tournamentId: string,
  sourceTournamentId: string,
  body?: { overwriteExistingMembers?: boolean }
): Promise<TransferTeamResult> 
{
  return api<TransferTeamResult>(
    `/api/tournaments/${tournamentId}/transfer-team-from/${sourceTournamentId}`,
    {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }
  );
}

export async function patchTournamentSettings(
  tournamentId: string,
  body: {
    groupCount?: number;
    advancesPerGroup?: number;
  }
): Promise<TournamentDetail> 
{
  return api<TournamentDetail>(`/api/tournaments/${tournamentId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
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

export async function deleteAllMatches(
  tournamentId: string
): Promise<TournamentDetail>
{
  return api<TournamentDetail>(
    `/api/tournaments/${tournamentId}/matches`,
    { method: "DELETE" }
  );
}

export async function postAdvancePhase(
  tournamentId: string,
  target: "ROUND_OF_16" | "QUARTER" | "SEMI" | "FINAL" | "COMPLETED"
): Promise<TournamentDetail>
{
  return api<TournamentDetail>(
    `/api/tournaments/${tournamentId}/advance`,
    { method: "POST", body: JSON.stringify({ target }) }
  );
}

export async function postGenerateKnockout(
  tournamentId: string
): Promise<TournamentDetail>
{
  return api<TournamentDetail>(
    `/api/tournaments/${tournamentId}/generate-knockout`,
    { method: "POST" }
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

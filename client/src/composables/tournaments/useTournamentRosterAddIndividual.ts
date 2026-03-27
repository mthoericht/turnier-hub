import type { TournamentLayoutContext } from "@/tournament/tournamentContext";

type RosterAddIndividualDeps = Pick<
  TournamentLayoutContext,
  | "tournament"
  | "newTeamName"
  | "addMemberTeamId"
  | "addPlayerId"
  | "availablePlayers"
  | "createTeam"
  | "addMember"
>;

export function useTournamentRosterAddIndividual(
  deps: RosterAddIndividualDeps
): { addIndividualAsTeam: () => Promise<void> }
{
  async function addIndividualAsTeam(): Promise<void>
  {
    if (!deps.addPlayerId.value) return;
    const player = deps.availablePlayers.value.find((p) => p.id === deps.addPlayerId.value);
    if (!player || !deps.tournament.value) return;

    deps.newTeamName.value = player.name;
    await deps.createTeam();

    const t = deps.tournament.value;
    if (!t) return;
    const team = t.teams.find((tm) => tm.name === player.name);
    if (team)
    {
      deps.addMemberTeamId.value = team.id;
      deps.addPlayerId.value = player.id;
      await deps.addMember();
    }
    deps.addPlayerId.value = "";
  }

  return { addIndividualAsTeam };
}

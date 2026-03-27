import type { TournamentLayoutContext, TournamentTeam } from "@/tournament/tournamentContext";

type RosterRenamePromptsDeps = Pick<
  TournamentLayoutContext,
  "canEdit" | "renameGroupLabel" | "renameTeam"
>;

export function useTournamentRosterRenamePrompts(
  deps: RosterRenamePromptsDeps
): {
  promptRenameGroup: (label: string) => Promise<void>;
  promptRenameTeam: (team: TournamentTeam) => Promise<void>;
}
{
  async function promptRenameGroup(label: string): Promise<void>
  {
    if (!deps.canEdit.value) return;
    const next = prompt("Neuer Gruppenname", label);
    if (!next) return;
    await deps.renameGroupLabel(label, next);
  }

  async function promptRenameTeam(team: TournamentTeam): Promise<void>
  {
    if (!deps.canEdit.value) return;
    const next = prompt("Neuer Mannschaftsname", team.name);
    if (!next) return;
    await deps.renameTeam(team.id, next);
  }

  return {
    promptRenameGroup,
    promptRenameTeam,
  };
}

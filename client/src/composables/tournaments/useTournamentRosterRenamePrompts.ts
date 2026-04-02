import type { TournamentLayoutContext, TournamentTeam } from "@/tournament/tournamentContext";

type RosterRenamePromptsDeps = Pick<
  TournamentLayoutContext,
  "canEdit" | "renameGroupLabel" | "renameTeam" | "promptText"
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
    const next = await deps.promptText({
      title: "Neuer Gruppenname",
      inputLabel: "Gruppenname",
      placeholder: label,
      initialValue: label,
      submitLabel: "Speichern",
    });
    if (!next) return;
    await deps.renameGroupLabel(label, next);
  }

  async function promptRenameTeam(team: TournamentTeam): Promise<void>
  {
    if (!deps.canEdit.value) return;
    const next = await deps.promptText({
      title: "Neuer Mannschaftsname",
      inputLabel: "Mannschaftsname",
      placeholder: team.name,
      initialValue: team.name,
      submitLabel: "Speichern",
    });
    if (!next) return;
    await deps.renameTeam(team.id, next);
  }

  return {
    promptRenameGroup,
    promptRenameTeam,
  };
}

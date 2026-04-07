/**
 * Roster-scoped tournament layout actions: teams, members, group labels, and team transfer from another tournament.
 */
import type { Ref } from "vue";
import type { TournamentDetail, ConfirmDialogActionOptions } from "@/tournament/tournamentContext";
import {
  addTeamMember,
  createTournamentTeam,
  deleteTournamentTeam,
  patchTournamentGroupLabel,
  patchTournamentTeam,
  removeTeamMember,
  transferTournamentTeam,
} from "@/api/tournamentsApi";

/** Dependencies injected from `tournamentLayout` for roster CRUD and related UI refs. */
export type RosterActionsContext = {
  activeTournamentId: Ref<string | null>;
  tournament: Ref<TournamentDetail | null>;
  newTeamName: Ref<string>;
  addMemberTeamId: Ref<string>;
  addPlayerId: Ref<string>;
  load: (opts?: { silent?: boolean }) => Promise<void>;
  loadStandings: () => Promise<void>;
  toast: {
    showSuccess: (msg: string) => void;
    showInfo: (msg: string) => void;
  };
  confirmAction: (opts: ConfirmDialogActionOptions) => Promise<boolean>;
  notifyActionError: (e: unknown) => void;
};

/** Returns action functions bound to the given store context (spread into the layout store public API). */
export function createRosterActions(ctx: RosterActionsContext)
{
  const {
    activeTournamentId,
    tournament,
    newTeamName,
    addMemberTeamId,
    addPlayerId,
    load,
    loadStandings,
    toast,
    confirmAction,
    notifyActionError,
  } = ctx;

  /** Creates a team from trimmed `newTeamName` and clears the input on success. */
  async function createTeam(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const name = newTeamName.value.trim();
    if (!name) return;
    try
    {
      await createTournamentTeam(id, { name });
      newTeamName.value = "";
      await load();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  /** Deletes a team or individual entry after confirm; refetches detail and standings and may toast about removed group matches. */
  async function removeTeam(teamId: string): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const isIndividuals = tournament.value?.teamsAreIndividuals ?? false;
    const ok = await confirmAction(
      {
        title: isIndividuals ? "Teilnehmer entfernen" : "Mannschaft löschen",
        description: isIndividuals
          ? "Teilnehmer entfernen? Zugeordnete Gruppenspiele werden mit gelöscht."
          : "Mannschaft löschen? Zugeordnete Gruppenspiele werden mit gelöscht.",
        submitLabel: isIndividuals ? "Entfernen" : "Löschen",
      }
    );
    if (!ok) return;
    try
    {
      const result = await deleteTournamentTeam(id, teamId);
      await load();
      await loadStandings();
      if (result.removedGroupMatches > 0)
      {
        toast.showInfo(
          `${result.removedGroupMatches} ${
            result.removedGroupMatches === 1 ? "Gruppenspiel" : "Gruppenspiele"
          } mit dieser Mannschaft wurden mit entfernt.`
        );
      }
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  /** Renames a team when `newName` is non-empty after trim. */
  async function renameTeam(teamId: string, newName: string): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const next = newName.trim();
    if (!next) return;
    try
    {
      await patchTournamentTeam(id, teamId, { name: next });
      await load();
      await loadStandings();
      toast.showSuccess("Mannschaft wurde umbenannt.");
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  /** Renames a group label via API, assigns returned detail, and refreshes standings. */
  async function renameGroupLabel(oldLabel: string, newLabel: string): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const next = newLabel.trim();
    if (!next || next === oldLabel) return;
    try
    {
      const detail = await patchTournamentGroupLabel(id, oldLabel, next);
      tournament.value = detail;
      await loadStandings();
      toast.showSuccess(`Gruppe ${oldLabel} wurde in ${next} umbenannt.`);
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  /** Adds the selected catalog player to the selected team; clears `addPlayerId` on success. */
  async function addMember(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    if (!addMemberTeamId.value || !addPlayerId.value) return;
    try
    {
      await addTeamMember(id, addMemberTeamId.value, addPlayerId.value);
      addPlayerId.value = "";
      await load();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  /** Removes a player from a team roster and refetches tournament detail. */
  async function removeMember(teamId: string, playerId: string): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    try
    {
      await removeTeamMember(id, teamId, playerId);
      await load();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  /** Copies roster from another tournament into the active one; no-op when source equals target. */
  async function transferTeamFromTournament(
    sourceTournamentId: string
  ): Promise<void>
  {
    const targetId = activeTournamentId.value;
    if (!targetId || !sourceTournamentId) return;
    if (sourceTournamentId === targetId) return;
    try
    {
      await transferTournamentTeam(targetId, sourceTournamentId);
      await load();
      toast.showSuccess("Team aus Turnier übertragen.");
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  return {
    createTeam,
    removeTeam,
    renameTeam,
    renameGroupLabel,
    addMember,
    removeMember,
    transferTeamFromTournament,
  };
}

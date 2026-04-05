import type { Ref } from "vue";
import type { TournamentDetail, ConfirmDialogActionOptions } from "@/tournament/tournamentContext";
import {
  addTeamMember,
  createTournamentTeam,
  deleteTournamentTeam,
  patchTournamentGroupLabel,
  patchTournamentTeam,
  removeTeamMember,
  transferTournamentKader,
} from "@/api/tournamentsApi";

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

  async function transferKaderFromTournament(
    sourceTournamentId: string
  ): Promise<void>
  {
    const targetId = activeTournamentId.value;
    if (!targetId || !sourceTournamentId) return;
    if (sourceTournamentId === targetId) return;
    try
    {
      await transferTournamentKader(targetId, sourceTournamentId);
      await load();
      toast.showSuccess("Kader aus Turnier übertragen.");
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
    transferKaderFromTournament,
  };
}

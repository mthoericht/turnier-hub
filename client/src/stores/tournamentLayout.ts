import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useConfirmDialogStore } from "@/stores/confirmDialog";
import { useToastStore } from "@/stores/toast";
import {
  advanceTargetRisksDataLoss,
  buildScoreDraftFromMatches,
  canUserEditTournament,
  collectAssignedPlayerIds,
  filterAvailablePlayers,
  getMatchesByPhase,
  groupRegenerateRisksDataLoss,
  mergeScoreDraftFromMatches,
  parseScoreDraftForPatch,
  parseStandingsGroups,
  resolveMemberTeamSelection,
  type ScoreDraftMap,
} from "@/tournament/tournamentDerive";
import {
  formatMatchDurationMs,
  formatMatchStatusLabel,
  formatPhaseLabel,
} from "@/tournament/tournamentFormat";
import { buildKnockoutAdvancePrompt } from "@/tournament/knockoutAdvancePrompt";
import type {
  ConfirmDialogActionOptions,
  TournamentDetail,
} from "@/tournament/tournamentContext";
import { fetchPlayersAll } from "@/api/playersApi";
import {
  addTeamMember,
  createTournamentTeam,
  deleteAllMatches as apiDeleteAllMatches,
  deleteTournamentTeam,
  fetchTournamentDetail,
  fetchTournamentStandings,
  patchMatchScores,
  patchTournamentGroupLabel,
  patchTournamentSettings,
  patchTournamentTeam,
  postAdvancePhase,
  postGenerateGroupMatches,
  postGenerateKnockout,
  postMatchTimer,
  removeTeamMember,
  transferTournamentKader,
} from "@/api/tournamentsApi";
import {
  tournamentCardClass,
  tournamentFieldClass,
  tournamentFieldSmClass,
  tournamentMatchCardClass,
  tournamentTimerBtnClass,
} from "@/tournament/tournamentUi";
import type { Player } from "@turnier-hub/shared";

export const useTournamentLayoutStore = defineStore("tournamentLayout", () =>
{
  const auth = useAuthStore();
  const toast = useToastStore();

  function notifyActionError(e: unknown): void
  {
    const msg = e instanceof Error ? e.message : "Fehler";
    toast.showError(msg);
  }

  const activeTournamentId = ref<string | null>(null);
  const tournament = ref<TournamentDetail | null>(null);
  const loading = ref(true);
  const error = ref("");
  const allPlayers = ref<Player[]>([]);
  const newTeamName = ref("");
  const addMemberTeamId = ref("");
  const addPlayerId = ref("");
  const groupCountInput = ref(1);
  const advancesInput = ref(2);
  const standings = ref<Record<string, unknown> | null>(null);
  const scoreDraft = ref<ScoreDraftMap>({});
  const scoreDraftDirtyByMatchId = ref<Record<string, boolean>>({});

  function confirmAction(opts: ConfirmDialogActionOptions): Promise<boolean>
  {
    return useConfirmDialogStore().requestConfirm(opts);
  }

  let silentRefreshInFlight = false;

  async function load(opts?: { silent?: boolean }): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const silent = opts?.silent === true;
    if (!silent)
    {
      error.value = "";
    }
    try
    {
      const detail = await fetchTournamentDetail(id);
      tournament.value = detail;
      groupCountInput.value = detail.groupCount;
      advancesInput.value = detail.advancesPerGroup;
      addMemberTeamId.value = resolveMemberTeamSelection(
        detail.teams,
        addMemberTeamId.value
      );
      scoreDraft.value = mergeScoreDraftFromMatches(
        detail.matches,
        scoreDraft.value,
        scoreDraftDirtyByMatchId.value
      );
    }
    catch (e)
    {
      if (!silent)
      {
        error.value = e instanceof Error ? e.message : "Laden fehlgeschlagen";
        tournament.value = null;
      }
    }
    finally
    {
      if (!silent)
      {
        loading.value = false;
      }
    }
  }

  async function loadStandings(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    try
    {
      standings.value = await fetchTournamentStandings(id);
    }
    catch
    {
      standings.value = null;
    }
  }

  async function loadPlayers(): Promise<void>
  {
    try
    {
      allPlayers.value = await fetchPlayersAll();
    }
    catch
    {
      allPlayers.value = [];
    }
  }

  async function reloadPlayersIfActive(): Promise<void>
  {
    if (!activeTournamentId.value) return;
    await loadPlayers();
  }

  function updateScoreDraft(
    matchId: string,
    side: "home" | "away",
    value: string
  ): void
  {
    const existing = scoreDraft.value[matchId] ?? { home: "0", away: "0" };
    scoreDraft.value[matchId] = {
      ...existing,
      [side]: value,
    };
    scoreDraftDirtyByMatchId.value[matchId] = true;
  }

  async function syncRouteTournamentId(routeId: string): Promise<void>
  {
    activeTournamentId.value = routeId;
    loading.value = true;
    await loadPlayers();
    await load();
    await loadStandings();
  }

  function leaveTournamentView(): void
  {
    activeTournamentId.value = null;
    tournament.value = null;
    standings.value = null;
    scoreDraft.value = {};
    scoreDraftDirtyByMatchId.value = {};
    error.value = "";
    loading.value = true;
  }

  async function onRealtimeTournamentChanged(tournamentId: string): Promise<void>
  {
    if (tournamentId !== activeTournamentId.value) return;
    if (silentRefreshInFlight) return;
    silentRefreshInFlight = true;
    try
    {
      await load({ silent: true });
      await loadStandings();
    }
    finally
    {
      silentRefreshInFlight = false;
    }
  }

  const canEdit = computed(() =>
    canUserEditTournament(tournament.value, auth.user?.id)
  );

  const assignedPlayerIds = computed(() =>
    tournament.value
      ? collectAssignedPlayerIds(tournament.value.teams)
      : new Set<string>()
  );

  const availablePlayers = computed(() =>
    filterAvailablePlayers(allPlayers.value, assignedPlayerIds.value)
  );

  const standingsGroups = computed(() =>
    parseStandingsGroups(standings.value)
  );

  const matchesByPhase = computed(() =>
    tournament.value
      ? getMatchesByPhase(tournament.value.matches, tournament.value.phase)
      : []
  );

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

  async function saveAdvances(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    try
    {
      const detail = await patchTournamentSettings(id, {
        advancesPerGroup: advancesInput.value,
      });
      tournament.value = detail;
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function saveGroupCount(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    try
    {
      const detail = await patchTournamentSettings(id, {
        groupCount: groupCountInput.value,
      });
      tournament.value = detail;
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function generateGroup(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const t = tournament.value;
    if (t && groupRegenerateRisksDataLoss(t.matches))
    {
      const ok = await confirmAction(
        {
          title: "Gruppenspiele neu erzeugen",
          description:
            "Es gibt bereits Ergebnisse, laufende oder beendete Spiele. "
            + "Wenn du die Gruppenspiele neu erzeugst, werden alle Spiele "
            + "(inkl. K.-o.) und ihre Ergebnisse gelöscht. Fortfahren?",
          submitLabel: "Fortfahren",
        }
      );
      if (!ok) return;
    }
    try
    {
      const detail = await postGenerateGroupMatches(id);
      tournament.value = detail;
      scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
      scoreDraftDirtyByMatchId.value = {};
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function generateKnockout(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const t = tournament.value;
    if (t && t.matches.length > 0)
    {
      const ok = await confirmAction(
        {
          title: "K.O.-Spiele neu erzeugen",
          description: "Bestehende K.O.-Spiele werden gelöscht und neu erzeugt. Fortfahren?",
          submitLabel: "Fortfahren",
        }
      );
      if (!ok) return;
    }
    try
    {
      const detail = await postGenerateKnockout(id);
      tournament.value = detail;
      scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
      scoreDraftDirtyByMatchId.value = {};
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function deleteAllMatches(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const ok = await confirmAction(
      {
        title: "Alle Spiele löschen",
        description: "Alle Spiele unwiderruflich löschen?",
        submitLabel: "Löschen",
      }
    );
    if (!ok) return;
    try
    {
      const detail = await apiDeleteAllMatches(id);
      tournament.value = detail;
      scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
      scoreDraftDirtyByMatchId.value = {};
      standings.value = null;
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function advance(
    target: "ROUND_OF_16" | "QUARTER" | "SEMI" | "FINAL" | "COMPLETED"
  ): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const t = tournament.value;
    if (target === "COMPLETED")
    {
      const ok = await confirmAction(
        {
          title: "Turnier abschließen",
          description: "Turnier als abgeschlossen markieren?",
          submitLabel: "Abschließen",
        }
      );
      if (!ok) return;
    }
    else if (t)
    {
      const targetMatches = t.matches.filter((m) => m.phase === target);
      const alreadyGenerated = targetMatches.length > 0;
      const pointsGiven = targetMatches.some(
        (m) => m.homeScore != null || m.awayScore != null
      );

      const risks = advanceTargetRisksDataLoss(t.matches, target, t.phase);

      const phaseLabel = formatPhaseLabel(target);
      const prompt = buildKnockoutAdvancePrompt({
        phaseLabel,
        alreadyGenerated,
        pointsGiven,
        risks,
      });

      if (prompt?.kind === "confirm")
      {
        const ok = await confirmAction(
          {
            title: phaseLabel,
            description: prompt.message,
            submitLabel: "Fortfahren",
          }
        );
        if (!ok) return;
      }
      else if (prompt?.kind === "toastInfo")
      {
        toast.showInfo(prompt.message);
      }
    }
    try
    {
      const detail = await postAdvancePhase(id, target);
      tournament.value = detail;
      scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
      scoreDraftDirtyByMatchId.value = {};
      for (const notice of detail.notices ?? [])
      {
        toast.showInfo(notice);
      }
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function patchScores(matchId: string): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const d = scoreDraft.value[matchId];
    if (!d) return;
    const parsed = parseScoreDraftForPatch(d);
    if (parsed.kind === "empty")
    {
      toast.showInfo("Nichts zu speichern — beide Torfelder sind leer.");
      return;
    }
    if (parsed.kind === "partial")
    {
      toast.showError(
        "Bitte Heim- und Gast-Torzahl beide eintragen und speichern — sonst fehlt eine Seite in der Datenbank."
      );
      return;
    }
    if (parsed.kind === "invalid")
    {
      toast.showError("Bitte gültige Torzahlen (≥ 0) eintragen.");
      return;
    }
    const body = {
      homeScore: parsed.homeScore,
      awayScore: parsed.awayScore,
    };
    try
    {
      const m = await patchMatchScores(id, matchId, body);
      scoreDraft.value[matchId] = {
        home: m.homeScore != null ? String(m.homeScore) : "0",
        away: m.awayScore != null ? String(m.awayScore) : "0",
      };
      scoreDraftDirtyByMatchId.value[matchId] = false;
      await load();
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function timerAction(
    matchId: string,
    action: "start" | "pause" | "resume" | "end" | "cancel"
  ): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    try
    {
      await postMatchTimer(id, matchId, action);
      await load();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  return {
    activeTournamentId,
    tournament,
    loading,
    error,
    allPlayers,
    newTeamName,
    addMemberTeamId,
    addPlayerId,
    groupCountInput,
    advancesInput,
    standings,
    scoreDraft,
    canEdit,
    assignedPlayerIds,
    availablePlayers,
    standingsGroups,
    matchesByPhase,
    formatPhaseLabel,
    formatMatchStatusLabel,
    formatMs: formatMatchDurationMs,
    load,
    loadStandings,
    loadPlayers,
    syncRouteTournamentId,
    leaveTournamentView,
    onRealtimeTournamentChanged,
    reloadPlayersIfActive,
    updateScoreDraft,
    createTeam,
    removeTeam,
    renameTeam,
    renameGroupLabel,
    addMember,
    removeMember,
    transferKaderFromTournament,
    saveGroupCount,
    saveAdvances,
    generateGroup,
    generateKnockout,
    deleteAllMatches,
    advance,
    patchScores,
    timerAction,
    confirmAction,
    fieldClass: tournamentFieldClass,
    fieldSmClass: tournamentFieldSmClass,
    cardClass: tournamentCardClass,
    matchCardClass: tournamentMatchCardClass,
    timerBtnClass: tournamentTimerBtnClass,
  };
});

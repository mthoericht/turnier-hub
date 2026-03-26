import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type ComputedRef,
} from "vue";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";
import {
  advanceTargetRisksDataLoss,
  buildScoreDraftFromMatches,
  canUserEditTournament,
  collectAssignedPlayerIds,
  filterAvailablePlayers,
  getMatchesByPhase,
  groupRegenerateRisksDataLoss,
  matchNeedsTimerPoll,
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
import type {
  TournamentDetail,
  TournamentLayoutContext,
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
import type { Player } from "@/types";

export function useTournamentLayoutState(
  tournamentId: ComputedRef<string>
): TournamentLayoutContext 
{
  const auth = useAuthStore();
  const toast = useToastStore();

  function notifyActionError(e: unknown): void 
  {
    const msg = e instanceof Error ? e.message : "Fehler";
    toast.showError(msg);
  }

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

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function load(): Promise<void> 
  {
    error.value = "";
    try 
    {
      const detail = await fetchTournamentDetail(tournamentId.value);
      tournament.value = detail;
      groupCountInput.value = detail.groupCount;
      advancesInput.value = detail.advancesPerGroup;
      addMemberTeamId.value = resolveMemberTeamSelection(
        detail.teams,
        addMemberTeamId.value
      );
      scoreDraft.value = mergeScoreDraftFromMatches(
        detail.matches,
        scoreDraft.value
      );
    }
    catch (e) 
    {
      error.value = e instanceof Error ? e.message : "Laden fehlgeschlagen";
      tournament.value = null;
    }
    finally 
    {
      loading.value = false;
    }
  }

  async function loadStandings(): Promise<void> 
  {
    try 
    {
      standings.value = await fetchTournamentStandings(tournamentId.value);
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

  function setupPoll(): void 
  {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => 
    {
      const t = tournament.value;
      if (t?.matches.some(matchNeedsTimerPoll)) void load();
    }, 1000);
  }

  watch(tournamentId, () => 
  {
    loading.value = true;
    void loadPlayers();
    void load().then(() => loadStandings());
  });

  onMounted(async () => 
  {
    await loadPlayers();
    await load();
    await loadStandings();
    setupPoll();
  });

  onUnmounted(() => 
  {
    if (pollTimer) clearInterval(pollTimer);
  });

  async function createTeam(): Promise<void> 
  {
    const name = newTeamName.value.trim();
    if (!name) return;
    try 
    {
      await createTournamentTeam(tournamentId.value, {
        name,
      });
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
    const isIndividuals = tournament.value?.teamsAreIndividuals ?? false;
    if (
      !confirm(
        isIndividuals
          ? "Teilnehmer entfernen? Zugeordnete Gruppenspiele werden mit gelöscht."
          : "Mannschaft löschen? Zugeordnete Gruppenspiele werden mit gelöscht."
      )
    ) 
    {
      return;
    }
    try
    {
      const result = await deleteTournamentTeam(tournamentId.value, teamId);
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
    const next = newName.trim();
    if (!next) return;
    try
    {
      await patchTournamentTeam(tournamentId.value, teamId, { name: next });
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
    const next = newLabel.trim();
    if (!next || next === oldLabel) return;
    try
    {
      const detail = await patchTournamentGroupLabel(
        tournamentId.value,
        oldLabel,
        next
      );
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
    if (!addMemberTeamId.value || !addPlayerId.value) return;
    try 
    {
      await addTeamMember(
        tournamentId.value,
        addMemberTeamId.value,
        addPlayerId.value
      );
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
    try 
    {
      await removeTeamMember(tournamentId.value, teamId, playerId);
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
    const targetId = tournamentId.value;
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
    try 
    {
      const detail = await patchTournamentSettings(tournamentId.value, {
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
    try
    {
      const detail = await patchTournamentSettings(tournamentId.value, {
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
    const t = tournament.value;
    if (
      t
      && groupRegenerateRisksDataLoss(t.matches)
      && !confirm(
        "Es gibt bereits Ergebnisse, laufende oder beendete Spiele. "
          + "Wenn du die Gruppenspiele neu erzeugst, werden alle Gruppenspiele "
          + "und ihre Ergebnisse gelöscht. Fortfahren?"
      )
    )
    {
      return;
    }
    try
    {
      const detail = await postGenerateGroupMatches(tournamentId.value);
      tournament.value = detail;
      scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function generateKnockout(): Promise<void>
  {
    const t = tournament.value;
    if (
      t
      && t.matches.length > 0
      && !confirm("Bestehende K.O.-Spiele werden gelöscht und neu erzeugt. Fortfahren?")
    )
    {
      return;
    }
    try
    {
      const detail = await postGenerateKnockout(tournamentId.value);
      tournament.value = detail;
      scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function deleteAllMatches(): Promise<void>
  {
    if (!confirm("Alle Spiele unwiderruflich löschen?")) return;
    try
    {
      const detail = await apiDeleteAllMatches(tournamentId.value);
      tournament.value = detail;
      scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
      standings.value = null;
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function advance(target: "ROUND_OF_16" | "QUARTER" | "SEMI" | "FINAL" | "COMPLETED"): Promise<void>
  {
    const t = tournament.value;
    if (target === "COMPLETED")
    {
      if (!confirm("Turnier als abgeschlossen markieren?")) return;
    }
    else if (
      t
      && advanceTargetRisksDataLoss(t.matches, target, t.phase)
      && !confirm(
        "Es gibt bereits Ergebnisse oder Spielstände in K.-o.-Runden, die dabei "
          + "gelöscht oder überschrieben werden. Fortfahren?"
      )
    )
    {
      return;
    }
    try
    {
      const detail = await postAdvancePhase(tournamentId.value, target);
      tournament.value = detail;
      scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
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
      const m = await patchMatchScores(tournamentId.value, matchId, body);
      scoreDraft.value[matchId] = {
        home: m.homeScore != null ? String(m.homeScore) : "0",
        away: m.awayScore != null ? String(m.awayScore) : "0",
      };
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
    try
    {
      await postMatchTimer(tournamentId.value, matchId, action);
      await load();
    }
    catch (e) 
    {
      notifyActionError(e);
    }
  }

  return {
    tournamentId,
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
    fieldClass: tournamentFieldClass,
    fieldSmClass: tournamentFieldSmClass,
    cardClass: tournamentCardClass,
    matchCardClass: tournamentMatchCardClass,
    timerBtnClass: tournamentTimerBtnClass,
  };
}

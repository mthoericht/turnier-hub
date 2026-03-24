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
  deleteTournamentTeam,
  fetchTournamentDetail,
  fetchTournamentStandings,
  patchMatchScores,
  patchTournamentAdvances,
  postAdvancePhase,
  postGenerateGroupMatches,
  postMatchTimer,
  removeTeamMember,
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
    if (
      !confirm(
        "Mannschaft löschen? Nur ohne Kader und ohne zugeordnete Spiele möglich."
      )
    ) 
    {
      return;
    }
    try
    {
      await deleteTournamentTeam(tournamentId.value, teamId);
      await load();
      await loadStandings();
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

  async function saveAdvances(): Promise<void> 
  {
    try 
    {
      await patchTournamentAdvances(
        tournamentId.value,
        advancesInput.value
      );
      await load();
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
        "In der Vorrunde gibt es bereits Ergebnisse, laufende oder beendete Spiele. "
          + "Wenn du die Vorrunden-Spiele neu erzeugst, werden alle Vorrunden-Spiele "
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

  async function advance(target: "QUARTER" | "SEMI" | "FINAL"): Promise<void> 
  {
    const t = tournament.value;
    if (
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
    addMember,
    removeMember,
    saveAdvances,
    generateGroup,
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

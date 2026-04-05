import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useConfirmDialogStore } from "@/stores/confirmDialog";
import { useToastStore } from "@/stores/toast";
import {
  canUserEditTournament,
  collectAssignedPlayerIds,
  filterAvailablePlayers,
  getMatchesByPhase,
  mergeScoreDraftFromMatches,
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
  ConfirmDialogActionOptions,
  TournamentDetail,
} from "@/tournament/tournamentContext";
import { fetchPlayersAll } from "@/api/playersApi";
import {
  fetchTournamentDetail,
  fetchTournamentStandings,
} from "@/api/tournamentsApi";
import {
  tournamentCardClass,
  tournamentFieldClass,
  tournamentFieldSmClass,
  tournamentMatchCardClass,
  tournamentTimerBtnClass,
} from "@/tournament/tournamentUi";
import type { Player } from "@turnier-hub/shared";
import { createRosterActions } from "./rosterActions";
import { createMatchActions } from "./matchActions";
import { createPhaseActions } from "./phaseActions";

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

  const rosterActions = createRosterActions({
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
  });

  const matchActions = createMatchActions({
    activeTournamentId,
    tournament,
    scoreDraft,
    scoreDraftDirtyByMatchId,
    standings,
    load,
    loadStandings,
    toast,
    confirmAction,
    notifyActionError,
  });

  const phaseActions = createPhaseActions({
    activeTournamentId,
    tournament,
    groupCountInput,
    advancesInput,
    scoreDraft,
    scoreDraftDirtyByMatchId,
    load,
    loadStandings,
    toast,
    confirmAction,
    notifyActionError,
  });

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
    confirmAction,
    fieldClass: tournamentFieldClass,
    fieldSmClass: tournamentFieldSmClass,
    cardClass: tournamentCardClass,
    matchCardClass: tournamentMatchCardClass,
    timerBtnClass: tournamentTimerBtnClass,
    ...rosterActions,
    ...matchActions,
    ...phaseActions,
  };
});

/**
 * Pinia store for the active tournament detail layout (roster, matches, phase controls).
 * Owns route-synced tournament id, fetched detail, standings cache, catalog players for
 * roster pickers, score draft state, and delegates mutations to roster / match / phase action factories.
 */
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useConfirmDialogStore } from "@/stores/confirmDialog";
import { useToastStore } from "@/stores/toast";
import {
  buildScoreDraftFromMatches,
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

  /** Maps API or user errors to a toast for tournament actions that do not use the layout `error` ref. */
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

  /** Opens the global confirm dialog; resolves when the user accepts or dismisses. */
  function confirmAction(opts: ConfirmDialogActionOptions): Promise<boolean>
  {
    return useConfirmDialogStore().requestConfirm(opts);
  }

  let silentRefreshInFlight = false;

  /**
   * Replaces the in-memory tournament detail and rebuilds the score draft from server matches,
   * clearing per-match dirty flags. Use after mutations that replace the full match graph.
   */
  function replaceTournamentDetailAndRescoreDraft(detail: TournamentDetail): void
  {
    tournament.value = detail;
    scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
    scoreDraftDirtyByMatchId.value = {};
  }

  /**
   * Fetches tournament detail for `activeTournamentId` and merges into local state.
   * Non-silent loads clear `error` and drive `loading`; silent loads skip user-visible error reset and loading toggles (e.g. realtime refresh).
   */
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

  /** Loads standings JSON for the active tournament; failures clear `standings` to null. */
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

  /** Loads the full player catalog for roster add-member UI. */
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

  /** Refetches catalog players when a tournament view is active (e.g. after catalog realtime events). */
  async function reloadPlayersIfActive(): Promise<void>
  {
    if (!activeTournamentId.value) return;
    await loadPlayers();
  }

  /**
   * Binds the store to a tournament route id: sets `activeTournamentId`, shows loading, loads players, detail, and standings.
   */
  async function syncRouteTournamentId(routeId: string): Promise<void>
  {
    activeTournamentId.value = routeId;
    loading.value = true;
    await loadPlayers();
    await load();
    await loadStandings();
  }

  /** Clears tournament-scoped state when navigating away from tournament routes. */
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

  /**
   * Refetches detail and standings when the server signals a change for the subscribed tournament.
   * Coalesces overlapping calls with a single in-flight silent refresh.
   */
  async function onRealtimeTournamentChanged(tournamentId: string): Promise<void>
  {
    if (tournamentId !== activeTournamentId.value) return;

    //to avoid multiple simultaneous silent refreshes
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

  /** Whether the signed-in user may edit the loaded tournament (currently any authenticated user when detail exists). */
  const canEdit = computed(() =>
    canUserEditTournament(tournament.value, auth.user?.subject)
  );

  /** Catalog player ids already on a roster in the active tournament. */
  const assignedPlayerIds = computed(() =>
    tournament.value
      ? collectAssignedPlayerIds(tournament.value.teams)
      : new Set<string>()
  );

  /** Catalog players not yet assigned to any team in this tournament. */
  const availablePlayers = computed(() =>
    filterAvailablePlayers(allPlayers.value, assignedPlayerIds.value)
  );

  /** Parsed group standings rows from the cached standings payload, or empty when missing. */
  const standingsGroups = computed(() =>
    parseStandingsGroups(standings.value)
  );

  /** Matches filtered to the tournament’s current phase for the active detail view. */
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
    scoreDraft,
    scoreDraftDirtyByMatchId,
    standings,
    replaceTournamentDetailAndRescoreDraft,
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
    replaceTournamentDetailAndRescoreDraft,
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

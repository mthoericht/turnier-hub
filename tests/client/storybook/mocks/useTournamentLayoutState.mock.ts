import { useConfirmDialogStore } from "@/stores/confirmDialog";
import { useTextPromptDialogStore } from "@/stores/textPromptDialog";
import {
  buildScoreDraftFromMatches,
  collectAssignedPlayerIds,
  filterAvailablePlayers,
  getMatchesByPhase,
  parseStandingsGroups,
} from "@/tournament/tournamentDerive";
import type { TournamentLayoutContext } from "@/tournament/tournamentContext";
import {
  formatMatchDurationMs,
  formatMatchStatusLabel,
  formatPhaseLabel,
} from "@/tournament/tournamentFormat";
import {
  tournamentCardClass,
  tournamentFieldClass,
  tournamentFieldSmClass,
  tournamentMatchCardClass,
  tournamentTimerBtnClass,
} from "@/tournament/tournamentUi";
import type { ComputedRef } from "vue";
import { computed, ref } from "vue";
import { getTournamentStoryScenario } from "../stories/fixtures/tournamentDetailStory";
import { demoPlayers } from "../stories/fixtures/rosterStoryHelpers";

/**
 * Storybook stand-in for `useTournamentLayoutState`: static demo tournament, no API or WebSocket.
 * Realtime subscription is intentionally omitted.
 */
export function useTournamentLayoutState(
  tournamentId: ComputedRef<string>
): TournamentLayoutContext
{
  const scenario = getTournamentStoryScenario(tournamentId.value);
  const detail = scenario.detail;
  const tournament = ref(detail);
  const loading = ref(false);
  const error = ref("");
  const allPlayers = ref(demoPlayers);
  const newTeamName = ref("");
  const addMemberTeamId = ref(detail.teams[0]?.id ?? "");
  const addPlayerId = ref("");
  const groupCountInput = ref(detail.groupCount);
  const advancesInput = ref(detail.advancesPerGroup);
  const standings = ref<Record<string, unknown> | null>(scenario.standings);
  const scoreDraft = ref(buildScoreDraftFromMatches(detail.matches));
  const canEdit = ref(true);

  const assignedPlayerIds = computed(() =>
    tournament.value
      ? collectAssignedPlayerIds(tournament.value.teams)
      : new Set<string>()
  );

  const availablePlayers = computed(() =>
    filterAvailablePlayers(allPlayers.value, assignedPlayerIds.value)
  );

  const standingsGroups = computed(() => parseStandingsGroups(standings.value));

  const matchesByPhase = computed(() =>
    tournament.value
      ? getMatchesByPhase(tournament.value.matches, tournament.value.phase)
      : []
  );

  const confirmDialog = useConfirmDialogStore();
  const textPromptDialog = useTextPromptDialogStore();

  async function noopAsync(): Promise<void> {}

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
    confirmAction: confirmDialog.requestConfirm,
    promptText: textPromptDialog.requestPrompt,
    load: noopAsync,
    loadStandings: noopAsync,
    loadPlayers: noopAsync,
    updateScoreDraft: (matchId, side, value) =>
    {
      const cur = scoreDraft.value[matchId] ?? { home: "0", away: "0" };
      scoreDraft.value = {
        ...scoreDraft.value,
        [matchId]: { ...cur, [side]: value },
      };
    },
    createTeam: noopAsync,
    removeTeam: noopAsync,
    renameTeam: noopAsync,
    renameGroupLabel: noopAsync,
    addMember: noopAsync,
    removeMember: noopAsync,
    transferTeamFromTournament: noopAsync,
    saveGroupCount: noopAsync,
    saveAdvances: noopAsync,
    generateGroup: noopAsync,
    generateKnockout: noopAsync,
    deleteAllMatches: noopAsync,
    advance: noopAsync,
    patchScores: noopAsync,
    timerAction: noopAsync,
    fieldClass: tournamentFieldClass,
    fieldSmClass: tournamentFieldSmClass,
    cardClass: tournamentCardClass,
    matchCardClass: tournamentMatchCardClass,
    timerBtnClass: tournamentTimerBtnClass,
  };
}

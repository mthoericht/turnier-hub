import { storeToRefs } from "pinia";
import {
  onUnmounted,
  watch,
  type ComputedRef,
} from "vue";
import {
  subscribeTournamentRealtime,
  unsubscribeTournamentRealtime,
} from "@/realtime/realtimeClient";
import { useTournamentLayoutStore } from "@/stores/tournamentLayout";
import type { TournamentLayoutContext } from "@/tournament/tournamentContext";

export function useTournamentLayoutState(
  tournamentId: ComputedRef<string>
): TournamentLayoutContext
{
  const store = useTournamentLayoutStore();

  watch(
    tournamentId,
    (id, prev) =>
    {
      if (prev) unsubscribeTournamentRealtime(prev);
      subscribeTournamentRealtime(id);
      void store.syncRouteTournamentId(id);
    },
    { immediate: true }
  );

  onUnmounted(() =>
  {
    unsubscribeTournamentRealtime(tournamentId.value);
    store.leaveTournamentView();
  });

  const refs = storeToRefs(store);

  return {
    tournamentId,
    tournament: refs.tournament,
    loading: refs.loading,
    error: refs.error,
    allPlayers: refs.allPlayers,
    newTeamName: refs.newTeamName,
    addMemberTeamId: refs.addMemberTeamId,
    addPlayerId: refs.addPlayerId,
    groupCountInput: refs.groupCountInput,
    advancesInput: refs.advancesInput,
    standings: refs.standings,
    scoreDraft: refs.scoreDraft,
    canEdit: refs.canEdit,
    assignedPlayerIds: refs.assignedPlayerIds,
    availablePlayers: refs.availablePlayers,
    standingsGroups: refs.standingsGroups,
    matchesByPhase: refs.matchesByPhase,
    formatPhaseLabel: store.formatPhaseLabel,
    formatMatchStatusLabel: store.formatMatchStatusLabel,
    formatMs: store.formatMs,
    load: () => store.load(),
    loadStandings: () => store.loadStandings(),
    loadPlayers: () => store.loadPlayers(),
    updateScoreDraft: (matchId, side, value) =>
      store.updateScoreDraft(matchId, side, value),
    createTeam: () => store.createTeam(),
    removeTeam: (teamId: string) => store.removeTeam(teamId),
    renameTeam: (teamId: string, newName: string) =>
      store.renameTeam(teamId, newName),
    renameGroupLabel: (oldLabel: string, newLabel: string) =>
      store.renameGroupLabel(oldLabel, newLabel),
    addMember: () => store.addMember(),
    removeMember: (teamId: string, playerId: string) =>
      store.removeMember(teamId, playerId),
    transferKaderFromTournament: (sourceTournamentId: string) =>
      store.transferKaderFromTournament(sourceTournamentId),
    saveGroupCount: () => store.saveGroupCount(),
    saveAdvances: () => store.saveAdvances(),
    generateGroup: () => store.generateGroup(),
    generateKnockout: () => store.generateKnockout(),
    deleteAllMatches: () => store.deleteAllMatches(),
    advance: (target) => store.advance(target),
    patchScores: (matchId: string) => store.patchScores(matchId),
    timerAction: (matchId, action) => store.timerAction(matchId, action),
    fieldClass: store.fieldClass,
    fieldSmClass: store.fieldSmClass,
    cardClass: store.cardClass,
    matchCardClass: store.matchCardClass,
    timerBtnClass: store.timerBtnClass,
  };
}

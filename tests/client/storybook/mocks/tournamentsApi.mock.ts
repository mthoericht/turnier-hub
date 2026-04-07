/**
 * Storybook: stub `fetchTournaments` so roster transfer UI does not call the network.
 * Other exports pass through to the real client API module.
 */
export type {
  TournamentsScope,
  TournamentListRow,
  TransferTeamResult,
} from "../../../../client/src/api/tournamentsApi";

export {
  postTournament,
  deleteTournament,
  fetchTournamentDetail,
  fetchTournamentStandings,
  createTournamentTeam,
  patchTournamentTeam,
  deleteTournamentTeam,
  addTeamMember,
  removeTeamMember,
  patchTournamentGroupLabel,
  transferTournamentTeam,
  patchTournamentSettings,
  postGenerateGroupMatches,
  deleteAllMatches,
  postAdvancePhase,
  postGenerateKnockout,
  patchMatchScores,
  postMatchTimer,
} from "../../../../client/src/api/tournamentsApi";

import type {
  TournamentListRow,
  TournamentsScope,
} from "../../../../client/src/api/tournamentsApi";

export async function fetchTournaments(
  _scope: TournamentsScope
): Promise<TournamentListRow[]>
{
  return [];
}

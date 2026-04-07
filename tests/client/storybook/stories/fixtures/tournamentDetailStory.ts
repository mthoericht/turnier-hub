import type {
  MatchRow,
  StandingTeamRow,
  TournamentDetail,
  TournamentTeam,
} from "@turnier-hub/shared";
import { demoPlayers, demoTeamEmpty, demoTeamWithMembers } from "./rosterStoryHelpers";
import { baseScheduledMatch } from "./matchStoryHelpers";

/** Stable id aligned with Storybook tournament routes (`/tournaments/:id/...`). */
export const storyTournamentId = "story-demo-tournament";
export const storyTournamentIndividualsId = "story-demo-individuals";
export const storyTournamentDirectKoId = "story-demo-direct-ko";

function withStoryTournament(team: TournamentTeam, tournamentId: string): TournamentTeam
{
  return {
    ...team,
    members: team.members.map((m) => ({ ...m, tournamentId })),
  };
}

function withTeams(tournamentId: string): TournamentTeam[]
{
  return [
    withStoryTournament(demoTeamWithMembers, tournamentId),
    withStoryTournament(demoTeamEmpty, tournamentId),
  ];
}

function buildGroupMatch(
  tournamentId: string,
  overrides?: Partial<MatchRow>
): MatchRow
{
  return {
    ...baseScheduledMatch,
    tournamentId,
    homeTeamId: demoTeamWithMembers.id,
    awayTeamId: demoTeamEmpty.id,
    homeTeam: { id: demoTeamWithMembers.id, name: demoTeamWithMembers.name },
    awayTeam: { id: demoTeamEmpty.id, name: demoTeamEmpty.name },
    ...overrides,
  };
}

export const storyStandingsPayload: Record<string, unknown> = {
  groups: {
    A: [
      {
        teamId: demoTeamWithMembers.id,
        team: { id: demoTeamWithMembers.id, name: demoTeamWithMembers.name },
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      } satisfies StandingTeamRow,
      {
        teamId: demoTeamEmpty.id,
        team: { id: demoTeamEmpty.id, name: demoTeamEmpty.name },
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      } satisfies StandingTeamRow,
    ],
  },
};

const storyStandingsByTournamentId: Record<string, Record<string, unknown>> = {
  [storyTournamentId]: storyStandingsPayload,
  [storyTournamentIndividualsId]: {},
  [storyTournamentDirectKoId]: {},
};

function buildIndividualsTournamentDetail(): TournamentDetail
{
  const tournamentId = storyTournamentIndividualsId;
  const teams: TournamentTeam[] = demoPlayers.map((player, idx) => ({
    id: `ind-team-${idx + 1}`,
    name: player.name,
    sortOrder: idx,
    groupLabel: null,
    members: [
      {
        id: `ind-member-${idx + 1}`,
        tournamentId,
        teamId: `ind-team-${idx + 1}`,
        playerId: player.id,
        player,
      },
    ],
  }));

  return {
    id: tournamentId,
    name: "Einzelmodus Storybook",
    sport: "Badminton",
    mode: "ROUND_ROBIN",
    phase: "GROUP",
    groupCount: 1,
    advancesPerGroup: 1,
    teamsAreIndividuals: true,
    createdBy: demoPlayers[0]!.createdBy,
    teams,
    matches: [
      buildGroupMatch(tournamentId, {
        id: "ind-m1",
        groupLabel: null,
        homeTeamId: teams[0]?.id ?? null,
        awayTeamId: teams[1]?.id ?? null,
        homeTeam: teams[0] ? { id: teams[0].id, name: teams[0].name } : null,
        awayTeam: teams[1] ? { id: teams[1].id, name: teams[1].name } : null,
      }),
    ],
  };
}

function buildDirectKoTournamentDetail(): TournamentDetail
{
  const tournamentId = storyTournamentDirectKoId;
  const teams = withTeams(tournamentId);

  return {
    id: tournamentId,
    name: "Direkt-K.O. Storybook",
    sport: "Volleyball",
    mode: "DIRECT_KO",
    phase: "QUARTER",
    groupCount: 1,
    advancesPerGroup: 1,
    teamsAreIndividuals: false,
    createdBy: demoPlayers[0]!.createdBy,
    teams,
    matches: [
      buildGroupMatch(tournamentId, {
        id: "ko-m1",
        phase: "QUARTER",
        groupLabel: null,
        status: "FINISHED",
        homeScore: 2,
        awayScore: 1,
      }),
    ],
  };
}

export function buildDemoTournamentDetail(
  overrides?: Partial<TournamentDetail>
): TournamentDetail
{
  return {
    id: storyTournamentId,
    name: "Demo-Turnier Storybook",
    sport: "Fußball",
    mode: "GROUP_KO",
    phase: "GROUP",
    groupCount: 2,
    advancesPerGroup: 2,
    teamsAreIndividuals: false,
    createdBy: demoPlayers[0]!.createdBy,
    teams: withTeams(storyTournamentId),
    matches: [buildGroupMatch(storyTournamentId)],
    ...overrides,
  };
}

export function getTournamentStoryScenario(
  tournamentId: string
): { detail: TournamentDetail; standings: Record<string, unknown> }
{
  const detail =
    tournamentId === storyTournamentIndividualsId
      ? buildIndividualsTournamentDetail()
      : tournamentId === storyTournamentDirectKoId
        ? buildDirectKoTournamentDetail()
        : buildDemoTournamentDetail({
            id: tournamentId,
            teams: withTeams(tournamentId),
            matches: [buildGroupMatch(tournamentId)],
          });

  return {
    detail,
    standings: storyStandingsByTournamentId[tournamentId] ?? storyStandingsPayload,
  };
}

import type { CreatedBy, Player } from "./catalog.js";

export type TournamentMode = "GROUP_KO" | "DIRECT_KO" | "ROUND_ROBIN";

export type TournamentPhase =
  | "GROUP"
  | "ROUND_OF_16"
  | "QUARTER"
  | "SEMI"
  | "FINAL"
  | "COMPLETED";

export type MatchPhase =
  | "GROUP"
  | "ROUND_OF_16"
  | "QUARTER"
  | "SEMI"
  | "FINAL";

export type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "PAUSED"
  | "FINISHED"
  | "CANCELLED";

export type TeamRef = { id: string; name: string };

export type MatchRow = {
  id: string;
  /** Present on API payloads from Prisma; omitted only when building rows purely on the client. */
  tournamentId?: string;
  phase: MatchPhase;
  roundOrder: number;
  groupLabel: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeam: TeamRef | null;
  awayTeam: TeamRef | null;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  /** Snapshot from the server at fetch time; clients may recompute LIVE elapsed locally. */
  elapsedMs: number;
  matchStartedAt: string | null;
  totalPausedMs: number;
  pausedAt: string | null;
  elapsedSnapshotMs: number | null;
};

export type TournamentTeamMember = {
  id: string;
  tournamentId: string;
  teamId: string;
  playerId: string;
  player: Player;
};

export type TournamentTeam = {
  id: string;
  name: string;
  sortOrder: number;
  groupLabel: string | null;
  members: TournamentTeamMember[];
};

export type TournamentDetail = {
  id: string;
  name: string;
  sport: string;
  mode: TournamentMode;
  phase: string;
  groupCount: number;
  advancesPerGroup: number;
  teamsAreIndividuals: boolean;
  createdBy: CreatedBy;
  notices?: string[];
  teams: TournamentTeam[];
  matches: MatchRow[];
};

export type StandingTeamRow = {
  teamId: string;
  team: TeamRef;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

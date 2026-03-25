import type { ComputedRef, Ref } from "vue";
import type { CreatedBy, Player } from "@/types";

export type MatchPhase = "GROUP" | "QUARTER" | "SEMI" | "FINAL";
export type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "PAUSED"
  | "FINISHED"
  | "CANCELLED";

export type TeamRef = { id: string; name: string };

export type MatchRow = {
  id: string;
  phase: MatchPhase;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeam: TeamRef | null;
  awayTeam: TeamRef | null;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  elapsedMs: number;
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
  members: TournamentTeamMember[];
};

export type TournamentDetail = {
  id: string;
  name: string;
  sport: string;
  phase: string;
  advancesPerGroup: number;
  createdBy: CreatedBy;
  teams: TournamentTeam[];
  matches: MatchRow[];
};

export type StandingTeamRow = {
  teamId: string;
  team: { id: string; name: string };
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

export type TournamentLayoutContext = {
  tournamentId: ComputedRef<string>;
  tournament: Ref<TournamentDetail | null>;
  loading: Ref<boolean>;
  error: Ref<string>;
  allPlayers: Ref<Player[]>;
  newTeamName: Ref<string>;
  addMemberTeamId: Ref<string>;
  addPlayerId: Ref<string>;
  advancesInput: Ref<number>;
  standings: Ref<Record<string, unknown> | null>;
  scoreDraft: Ref<Record<string, { home: string; away: string }>>;
  canEdit: ComputedRef<boolean>;
  assignedPlayerIds: ComputedRef<Set<string>>;
  availablePlayers: ComputedRef<Player[]>;
  standingsGroups: ComputedRef<Record<string, StandingTeamRow[]>>;
  matchesByPhase: ComputedRef<{ phase: MatchPhase; matches: MatchRow[] }[]>;
  formatPhaseLabel: (phase: MatchPhase | string) => string;
  formatMatchStatusLabel: (status: MatchStatus) => string;
  formatMs: (ms: number) => string;
  load: () => Promise<void>;
  loadStandings: () => Promise<void>;
  loadPlayers: () => Promise<void>;
  createTeam: () => Promise<void>;
  removeTeam: (teamId: string) => Promise<void>;
  addMember: () => Promise<void>;
  removeMember: (teamId: string, playerId: string) => Promise<void>;
  transferKaderFromTournament: (sourceTournamentId: string) => Promise<void>;
  saveAdvances: () => Promise<void>;
  generateGroup: () => Promise<void>;
  advance: (target: "QUARTER" | "SEMI" | "FINAL") => Promise<void>;
  patchScores: (matchId: string) => Promise<void>;
  timerAction: (
    matchId: string,
    action: "start" | "pause" | "resume" | "end" | "cancel"
  ) => Promise<void>;
  fieldClass: string;
  fieldSmClass: string;
  cardClass: string;
  matchCardClass: string;
  timerBtnClass: string;
};

import type { InjectionKey } from "vue";

export const tournamentLayoutKey: InjectionKey<TournamentLayoutContext> =
  Symbol("tournamentLayout");

import type { ComputedRef, Ref } from "vue";
import type { CreatedBy, Player } from "@/types";

export type TournamentMode = "GROUP_KO" | "DIRECT_KO" | "ROUND_ROBIN";
export type MatchPhase = "GROUP" | "ROUND_OF_16" | "QUARTER" | "SEMI" | "FINAL";
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
  roundOrder: number;
  groupLabel: string | null;
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
  groupCountInput: Ref<number>;
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
  renameTeam: (teamId: string, newName: string) => Promise<void>;
  renameGroupLabel: (oldLabel: string, newLabel: string) => Promise<void>;
  addMember: () => Promise<void>;
  removeMember: (teamId: string, playerId: string) => Promise<void>;
  transferKaderFromTournament: (sourceTournamentId: string) => Promise<void>;
  saveGroupCount: () => Promise<void>;
  saveAdvances: () => Promise<void>;
  generateGroup: () => Promise<void>;
  generateKnockout: () => Promise<void>;
  deleteAllMatches: () => Promise<void>;
  advance: (target: "ROUND_OF_16" | "QUARTER" | "SEMI" | "FINAL" | "COMPLETED") => Promise<void>;
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

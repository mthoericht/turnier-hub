import type { ComputedRef, Ref } from "vue";
import type { ConfirmDialogActionOptions } from "@/stores/confirmDialog";
import type { TextPromptOptions } from "@/stores/textPromptDialog";
import type { Player } from "@/types";
import type {
  MatchPhase,
  MatchRow,
  MatchStatus,
  StandingTeamRow,
  TournamentDetail,
} from "@turnier-hub/shared";

export type { ConfirmDialogActionOptions, TextPromptOptions };

export type {
  MatchPhase,
  MatchRow,
  MatchStatus,
  StandingTeamRow,
  TeamRef,
  TournamentDetail,
  TournamentMode,
  TournamentTeam,
  TournamentTeamMember,
} from "@turnier-hub/shared";

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
  canEdit: Ref<boolean>;
  assignedPlayerIds: Ref<Set<string>>;
  availablePlayers: Ref<Player[]>;
  standingsGroups: Ref<Record<string, StandingTeamRow[]>>;
  matchesByPhase: Ref<{ phase: MatchPhase; matches: MatchRow[] }[]>;
  formatPhaseLabel: (phase: MatchPhase | string) => string;
  formatMatchStatusLabel: (status: MatchStatus) => string;
  formatMs: (ms: number) => string;

  confirmAction: (opts: ConfirmDialogActionOptions) => Promise<boolean>;

  promptText: (opts: TextPromptOptions) => Promise<string | null>;

  load: () => Promise<void>;
  loadStandings: () => Promise<void>;
  loadPlayers: () => Promise<void>;
  updateScoreDraft: (
    matchId: string,
    side: "home" | "away",
    value: string
  ) => void;
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
  advance: (
    target: "ROUND_OF_16" | "QUARTER" | "SEMI" | "FINAL" | "COMPLETED"
  ) => Promise<void>;
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

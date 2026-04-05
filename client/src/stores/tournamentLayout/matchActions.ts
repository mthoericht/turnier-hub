import type { Ref } from "vue";
import type { TournamentDetail, ConfirmDialogActionOptions } from "@/tournament/tournamentContext";
import {
  buildScoreDraftFromMatches,
  parseScoreDraftForPatch,
  type ScoreDraftMap,
} from "@/tournament/tournamentDerive";
import {
  deleteAllMatches as apiDeleteAllMatches,
  patchMatchScores,
  postMatchTimer,
} from "@/api/tournamentsApi";

export type MatchActionsContext = {
  activeTournamentId: Ref<string | null>;
  tournament: Ref<TournamentDetail | null>;
  scoreDraft: Ref<ScoreDraftMap>;
  scoreDraftDirtyByMatchId: Ref<Record<string, boolean>>;
  standings: Ref<Record<string, unknown> | null>;
  load: (opts?: { silent?: boolean }) => Promise<void>;
  loadStandings: () => Promise<void>;
  toast: {
    showError: (msg: string) => void;
    showInfo: (msg: string) => void;
  };
  confirmAction: (opts: ConfirmDialogActionOptions) => Promise<boolean>;
  notifyActionError: (e: unknown) => void;
};

export function createMatchActions(ctx: MatchActionsContext)
{
  const {
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
  } = ctx;

  function updateScoreDraft(
    matchId: string,
    side: "home" | "away",
    value: string
  ): void
  {
    const existing = scoreDraft.value[matchId] ?? { home: "0", away: "0" };
    scoreDraft.value[matchId] = {
      ...existing,
      [side]: value,
    };
    scoreDraftDirtyByMatchId.value[matchId] = true;
  }

  async function patchScores(matchId: string): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const d = scoreDraft.value[matchId];
    if (!d) return;
    const parsed = parseScoreDraftForPatch(d);
    if (parsed.kind === "empty")
    {
      toast.showInfo("Nichts zu speichern — beide Torfelder sind leer.");
      return;
    }
    if (parsed.kind === "partial")
    {
      toast.showError(
        "Bitte Heim- und Gast-Torzahl beide eintragen und speichern — sonst fehlt eine Seite in der Datenbank."
      );
      return;
    }
    if (parsed.kind === "invalid")
    {
      toast.showError("Bitte gültige Torzahlen (≥ 0) eintragen.");
      return;
    }
    const body = {
      homeScore: parsed.homeScore,
      awayScore: parsed.awayScore,
    };
    try
    {
      const m = await patchMatchScores(id, matchId, body);
      scoreDraft.value[matchId] = {
        home: m.homeScore != null ? String(m.homeScore) : "0",
        away: m.awayScore != null ? String(m.awayScore) : "0",
      };
      scoreDraftDirtyByMatchId.value[matchId] = false;
      await load();
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function timerAction(
    matchId: string,
    action: "start" | "pause" | "resume" | "end" | "cancel"
  ): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    try
    {
      await postMatchTimer(id, matchId, action);
      await load();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function deleteAllMatches(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const ok = await confirmAction(
      {
        title: "Alle Spiele löschen",
        description: "Alle Spiele unwiderruflich löschen?",
        submitLabel: "Löschen",
      }
    );
    if (!ok) return;
    try
    {
      const detail = await apiDeleteAllMatches(id);
      tournament.value = detail;
      scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
      scoreDraftDirtyByMatchId.value = {};
      standings.value = null;
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  return {
    updateScoreDraft,
    patchScores,
    timerAction,
    deleteAllMatches,
  };
}

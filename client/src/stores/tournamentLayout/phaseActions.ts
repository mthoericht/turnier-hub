import type { Ref } from "vue";
import type { TournamentDetail, ConfirmDialogActionOptions } from "@/tournament/tournamentContext";
import {
  advanceTargetRisksDataLoss,
  buildScoreDraftFromMatches,
  groupRegenerateRisksDataLoss,
  type ScoreDraftMap,
} from "@/tournament/tournamentDerive";
import { formatPhaseLabel } from "@/tournament/tournamentFormat";
import { buildKnockoutAdvancePrompt } from "@/tournament/knockoutAdvancePrompt";
import {
  patchTournamentSettings,
  postAdvancePhase,
  postGenerateGroupMatches,
  postGenerateKnockout,
} from "@/api/tournamentsApi";

export type PhaseActionsContext = {
  activeTournamentId: Ref<string | null>;
  tournament: Ref<TournamentDetail | null>;
  groupCountInput: Ref<number>;
  advancesInput: Ref<number>;
  scoreDraft: Ref<ScoreDraftMap>;
  scoreDraftDirtyByMatchId: Ref<Record<string, boolean>>;
  load: (opts?: { silent?: boolean }) => Promise<void>;
  loadStandings: () => Promise<void>;
  toast: {
    showInfo: (msg: string) => void;
  };
  confirmAction: (opts: ConfirmDialogActionOptions) => Promise<boolean>;
  notifyActionError: (e: unknown) => void;
};

export function createPhaseActions(ctx: PhaseActionsContext)
{
  const {
    activeTournamentId,
    tournament,
    groupCountInput,
    advancesInput,
    scoreDraft,
    scoreDraftDirtyByMatchId,
    loadStandings,
    toast,
    confirmAction,
    notifyActionError,
  } = ctx;

  async function saveGroupCount(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    try
    {
      const detail = await patchTournamentSettings(id, {
        groupCount: groupCountInput.value,
      });
      tournament.value = detail;
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function saveAdvances(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    try
    {
      const detail = await patchTournamentSettings(id, {
        advancesPerGroup: advancesInput.value,
      });
      tournament.value = detail;
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function generateGroup(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const t = tournament.value;
    if (t && groupRegenerateRisksDataLoss(t.matches))
    {
      const ok = await confirmAction(
        {
          title: "Gruppenspiele neu erzeugen",
          description:
            "Es gibt bereits Ergebnisse, laufende oder beendete Spiele. "
            + "Wenn du die Gruppenspiele neu erzeugst, werden alle Spiele "
            + "(inkl. K.-o.) und ihre Ergebnisse gelöscht. Fortfahren?",
          submitLabel: "Fortfahren",
        }
      );
      if (!ok) return;
    }
    try
    {
      const detail = await postGenerateGroupMatches(id);
      tournament.value = detail;
      scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
      scoreDraftDirtyByMatchId.value = {};
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function generateKnockout(): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const t = tournament.value;
    if (t && t.matches.length > 0)
    {
      const ok = await confirmAction(
        {
          title: "K.O.-Spiele neu erzeugen",
          description: "Bestehende K.O.-Spiele werden gelöscht und neu erzeugt. Fortfahren?",
          submitLabel: "Fortfahren",
        }
      );
      if (!ok) return;
    }
    try
    {
      const detail = await postGenerateKnockout(id);
      tournament.value = detail;
      scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
      scoreDraftDirtyByMatchId.value = {};
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  async function advance(
    target: "ROUND_OF_16" | "QUARTER" | "SEMI" | "FINAL" | "COMPLETED"
  ): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    const t = tournament.value;
    if (target === "COMPLETED")
    {
      const ok = await confirmAction(
        {
          title: "Turnier abschließen",
          description: "Turnier als abgeschlossen markieren?",
          submitLabel: "Abschließen",
        }
      );
      if (!ok) return;
    }
    else if (t)
    {
      const targetMatches = t.matches.filter((m) => m.phase === target);
      const alreadyGenerated = targetMatches.length > 0;
      const pointsGiven = targetMatches.some(
        (m) => m.homeScore != null || m.awayScore != null
      );

      const risks = advanceTargetRisksDataLoss(t.matches, target, t.phase);

      const phaseLabel = formatPhaseLabel(target);
      const prompt = buildKnockoutAdvancePrompt({
        phaseLabel,
        alreadyGenerated,
        pointsGiven,
        risks,
      });

      if (prompt?.kind === "confirm")
      {
        const ok = await confirmAction(
          {
            title: phaseLabel,
            description: prompt.message,
            submitLabel: "Fortfahren",
          }
        );
        if (!ok) return;
      }
      else if (prompt?.kind === "toastInfo")
      {
        toast.showInfo(prompt.message);
      }
    }
    try
    {
      const detail = await postAdvancePhase(id, target);
      tournament.value = detail;
      scoreDraft.value = buildScoreDraftFromMatches(detail.matches);
      scoreDraftDirtyByMatchId.value = {};
      for (const notice of detail.notices ?? [])
      {
        toast.showInfo(notice);
      }
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  return {
    saveGroupCount,
    saveAdvances,
    generateGroup,
    generateKnockout,
    advance,
  };
}

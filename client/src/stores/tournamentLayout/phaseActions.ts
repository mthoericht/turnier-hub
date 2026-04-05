/**
 * Phase and settings actions for the tournament layout: group count, advances per group,
 * regenerating group or knockout matches, and advancing the tournament phase.
 */
import type { Ref } from "vue";
import type { TournamentDetail, ConfirmDialogActionOptions } from "@/tournament/tournamentContext";
import {
  advanceTargetRisksDataLoss,
  groupRegenerateRisksDataLoss,
} from "@/tournament/tournamentDerive";
import { formatPhaseLabel } from "@/tournament/tournamentFormat";
import { buildKnockoutAdvancePrompt } from "@/tournament/knockoutAdvancePrompt";
import {
  patchTournamentSettings,
  postAdvancePhase,
  postGenerateGroupMatches,
  postGenerateKnockout,
} from "@/api/tournamentsApi";

/** Dependencies injected from `tournamentLayout` for phase transitions and tournament settings patches. */
export type PhaseActionsContext = {
  activeTournamentId: Ref<string | null>;
  tournament: Ref<TournamentDetail | null>;
  groupCountInput: Ref<number>;
  advancesInput: Ref<number>;
  /** Applies a new detail after the match list was replaced server-side (draft + dirty reset). */
  replaceTournamentDetailAndRescoreDraft: (detail: TournamentDetail) => void;
  loadStandings: () => Promise<void>;
  toast: {
    showInfo: (msg: string) => void;
  };
  confirmAction: (opts: ConfirmDialogActionOptions) => Promise<boolean>;
  notifyActionError: (e: unknown) => void;
};

/** Returns action functions bound to the given store context (spread into the layout store public API). */
export function createPhaseActions(ctx: PhaseActionsContext)
{
  const {
    activeTournamentId,
    tournament,
    groupCountInput,
    advancesInput,
    replaceTournamentDetailAndRescoreDraft,
    loadStandings,
    toast,
    confirmAction,
    notifyActionError,
  } = ctx;

  async function patchSettings(
    partial: { groupCount?: number; advancesPerGroup?: number }
  ): Promise<void>
  {
    const id = activeTournamentId.value;
    if (!id) return;
    try
    {
      const detail = await patchTournamentSettings(id, partial);
      tournament.value = detail;
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  /** Persists `groupCountInput` as the tournament group count and refreshes standings. */
  async function saveGroupCount(): Promise<void>
  {
    await patchSettings({ groupCount: groupCountInput.value });
  }

  /** Persists `advancesInput` as advances per group and refreshes standings. */
  async function saveAdvances(): Promise<void>
  {
    await patchSettings({ advancesPerGroup: advancesInput.value });
  }

  /** Regenerates group-stage matches; may confirm when existing results or KO matches would be wiped. */
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
      replaceTournamentDetailAndRescoreDraft(detail);
      await loadStandings();
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  /** Creates or replaces knockout bracket matches; confirms when matches already exist. */
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
      replaceTournamentDetailAndRescoreDraft(detail);
    }
    catch (e)
    {
      notifyActionError(e);
    }
  }

  /**
   * Advances phase toward a knockout round or completion; runs confirm/toast prompts from derived risk state,
   * then applies API detail, replays server notices, and refreshes standings.
   */
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
      replaceTournamentDetailAndRescoreDraft(detail);
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

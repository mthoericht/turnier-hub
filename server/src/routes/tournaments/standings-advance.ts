import type { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { advanceTournamentPhase } from "../../services/advancePhase.js";
import { computePoolStandings } from "../../services/standings.js";
import {
  loadTournamentById,
  requireTournamentExists,
  serializeTournamentDetail,
} from "./shared.js";
import { notifyTournamentChanged } from "../../realtime/notify.js";

const advanceSchema = z.object({
  target: z.enum(["ROUND_OF_16", "QUARTER", "SEMI", "FINAL", "COMPLETED"]),
});

export function registerTournamentStandingsAdvanceRoutes(router: Router): void
{
  router.get("/:id/standings", async (req, res) =>
  {
    const t = await loadTournamentById(req.params.id);
    if (!t)
    {
      res.status(404).json({ error: "Turnier nicht gefunden" });
      return;
    }

    const teamsById = new Map(
      t.teams.map((tm) => [tm.id, { id: tm.id, name: tm.name }] as const)
    );
    const groupMatches = t.matches.filter((m) => m.phase === "GROUP");

    if (t.groupCount > 1)
    {
      const labels = [...new Set(t.teams.map((tm) => tm.groupLabel).filter(Boolean))] as string[];
      labels.sort();
      const groups: Record<string, ReturnType<typeof computePoolStandings>> = {};
      for (const label of labels)
      {
        const gTeamIds = t.teams
          .filter((tm) => tm.groupLabel === label)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
          .map((tm) => tm.id);
        const gMatches = groupMatches.filter((m) => m.groupLabel === label);
        groups[`Gruppe ${label}`] = computePoolStandings(gTeamIds, teamsById, gMatches);
      }
      res.json({ groups });
      return;
    }

    const teamIds = [...t.teams]
      .sort((a, b) =>
        a.sortOrder !== b.sortOrder
          ? a.sortOrder - b.sortOrder
          : a.name.localeCompare(b.name)
      )
      .map((tm) => tm.id);
    const rows = computePoolStandings(teamIds, teamsById, groupMatches);
    const label = t.mode === "ROUND_ROBIN" ? "Jeder gegen Jeden" : "Gruppenspiele";
    res.json({ groups: { [label]: rows } });
  });

  router.post("/:id/advance", async (req, res) =>
  {
    const parsed = advanceSchema.safeParse(req.body);
    if (!parsed.success)
    {
      res.status(400).json({ error: "Ungültige Zielphase" });
      return;
    }
    const owned = await requireTournamentExists(res, req.params.id);
    if (!owned) return;
    const t = await loadTournamentById(req.params.id);
    if (!t)
    {
      res.status(404).json({ error: "Turnier nicht gefunden" });
      return;
    }
    if (parsed.data.target === "COMPLETED")
    {
      await prisma.tournament.update({
        where: { id: t.id },
        data: { phase: "COMPLETED" },
      });
      const full = await loadTournamentById(t.id);
      notifyTournamentChanged(t.id);
      res.json(serializeTournamentDetail(full!));
      return;
    }
    try
    {
      const result = await advanceTournamentPhase(
        prisma,
        {
          ...t,
          teams: t.teams.map((tm) => ({
            id: tm.id,
            name: tm.name,
            sortOrder: tm.sortOrder,
            groupLabel: tm.groupLabel,
          })),
          matches: t.matches,
        },
        parsed.data.target as "ROUND_OF_16" | "QUARTER" | "SEMI" | "FINAL"
      );
      const full = await loadTournamentById(t.id);
      notifyTournamentChanged(t.id);
      res.json({
        ...serializeTournamentDetail(full!),
        notices: result.notices,
      });
      return;
    }
    catch (e)
    {
      const msg = e instanceof Error ? e.message : "Fehler";
      res.status(400).json({ error: msg });
      return;
    }
  });
}
